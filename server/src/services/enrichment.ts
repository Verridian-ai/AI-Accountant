/**
 * Transaction Enrichment Pipeline
 *
 * Runs after statement parsing to enrich transactions:
 * 1. Merchant Intelligence Agent → resolve merchant name, ABN, GST status
 * 2. TransactionCategorizerAgent → categorize with enriched context
 * 3. GSTCalculatorAgent → determine GST treatment
 *
 * Stores enrichment results and tracks status (enriched/pending/unknown).
 */

import { db, transactions, merchantMemory } from '../schema.js';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { MerchantIntelligenceAgent } from './claude/agents/merchant-intelligence.js';
import { TransactionCategorizerAgent } from './claude/agents/transaction-categorizer.js';
import { GSTCalculatorAgent } from './claude/agents/gst-calculator.js';
import { isAgentEnabled } from './claude/config.js';
import { cogneeClient } from './cognee_client.js';
import { logger } from '../utils/logger.js';
import { events } from '../events.js';
import { calculateGstFromInclusive } from './bas.js';
import crypto from 'crypto';

/** Enrichment status for tracking */
export type EnrichmentStatus = 'enriched' | 'pending' | 'unknown' | 'failed';

/** GST category inference from transaction description (non-AI fallback) */
const GST_FREE_CATEGORIES = new Set([
  'Government & Tax', 'Internal Transfer', 'Transfer',
  'Interest & Dividends', 'Loan/Liability Payment',
  'Superannuation', 'Insurance', 'Medical & Health',
  'Education & Childcare', 'Donations & Charity',
  'Employment Income', 'Salary & Wages',
]);

const INPUT_TAXED_CATEGORIES = new Set([
  'Interest & Dividends', 'Financial Services',
]);

function inferGstCategory(category: string, amount: number): { gstCategory: string; gstAmount: number } {
  if (INPUT_TAXED_CATEGORIES.has(category)) {
    return { gstCategory: 'input_taxed', gstAmount: 0 };
  }
  if (GST_FREE_CATEGORIES.has(category)) {
    return { gstCategory: 'gst_free', gstAmount: 0 };
  }
  // Default: taxable at 10%
  return {
    gstCategory: 'taxable_10',
    gstAmount: calculateGstFromInclusive(amount),
  };
}

export class EnrichmentService {
  private merchantAgent: MerchantIntelligenceAgent;
  private categorizerAgent: TransactionCategorizerAgent;
  private gstAgent: GSTCalculatorAgent;

  constructor() {
    this.merchantAgent = new MerchantIntelligenceAgent();
    this.categorizerAgent = new TransactionCategorizerAgent();
    this.gstAgent = new GSTCalculatorAgent();
  }

  /**
   * Enrich a batch of transactions after parsing.
   * Runs the 3-stage pipeline: Merchant → Category → GST
   */
  async enrichTransactions(
    transactionIds: string[],
    userId: string
  ): Promise<{ enriched: number; failed: number; pending: number }> {
    const stats = { enriched: 0, failed: 0, pending: 0 };

    if (transactionIds.length === 0) return stats;

    // Fetch transactions
    const txList = [];
    for (const id of transactionIds) {
      const tx = await db.select().from(transactions).where(eq(transactions.id, id)).get();
      if (tx) txList.push(tx);
    }

    if (txList.length === 0) return stats;

    // Get existing merchant memory
    const memoryRecords = await db
      .select()
      .from(merchantMemory)
      .where(eq(merchantMemory.userId, userId))
      .all();

    const existingMappings = memoryRecords.map((m: any) => ({
      pattern: m.merchantPattern,
      displayName: m.merchantDisplayName || m.merchantPattern,
      category: m.category,
      gstRegistered: m.gstApplicable ?? false,
    }));

    // Stage 1: Merchant Intelligence (if agent enabled)
    let merchantResults: Array<{
      transactionId: number;
      canonicalName: string;
      gstRegistered: boolean;
      defaultCategory: string;
      confidence: number;
    }> = [];

    if (isAgentEnabled('merchant_intelligence')) {
      try {
        logger.info(`[Enrichment] Running Merchant Intelligence on ${txList.length} transactions`);

        const merchantInput = {
          merchants: txList.map((tx: any) => ({
            transactionId: parseInt(tx.id, 10) || 0,
            description: tx.description,
            amount: tx.amount,
            category: tx.category,
          })),
          existingMappings,
        };

        const result = await this.merchantAgent.invoke(merchantInput);
        merchantResults = result.results;

        // Store new merchant mappings
        for (const mapping of result.newMappings) {
          await this.storeMerchantMapping(userId, mapping);
        }

        logger.info(`[Enrichment] Merchant Intelligence resolved ${merchantResults.length} merchants`);
      } catch (err) {
        logger.warn('[Enrichment] Merchant Intelligence failed, continuing with fallback', err);
      }
    }

    // Stage 2 & 3: For each transaction, apply categorization and GST
    for (const tx of txList) {
      try {
        const txId = tx.id;
        const merchantInfo = merchantResults.find(
          (m) => m.transactionId === (parseInt(txId, 10) || 0)
        );

        // Apply merchant enrichment
        let category = tx.category || merchantInfo?.defaultCategory || '';
        let merchantNormalized = merchantInfo?.canonicalName || tx.merchantNormalized || '';
        let gstRegistered = merchantInfo?.gstRegistered ?? true;

        // If no category from merchant intelligence, try memory patterns
        if (!category) {
          const matched = existingMappings.find(
            (m) => (tx.description || '').toLowerCase().includes(m.pattern.toLowerCase())
          );
          if (matched) {
            category = matched.category;
            merchantNormalized = matched.displayName;
            gstRegistered = matched.gstRegistered;
          }
        }

        // Stage 3: GST calculation (non-AI, rule-based)
        const gstResult = category
          ? inferGstCategory(category, tx.amount)
          : { gstCategory: 'taxable_10', gstAmount: calculateGstFromInclusive(tx.amount) };

        if (!gstRegistered) {
          gstResult.gstCategory = 'gst_free';
          gstResult.gstAmount = 0;
        }

        // Update transaction
        const updateData: Record<string, any> = {
          gstCategory: gstResult.gstCategory,
          gstAmount: gstResult.gstAmount,
          gstApplicable: gstResult.gstCategory === 'taxable_10' || gstResult.gstCategory === 'capital',
        };

        if (merchantNormalized) {
          updateData.merchantNormalized = merchantNormalized;
        }
        if (category && !tx.category) {
          updateData.category = category;
        }

        await db
          .update(transactions)
          .set(updateData)
          .where(eq(transactions.id, txId));

        stats.enriched++;
      } catch (err) {
        logger.warn(`[Enrichment] Failed to enrich transaction ${tx.id}:`, err);
        stats.failed++;
      }
    }

    stats.pending = transactionIds.length - stats.enriched - stats.failed;

    // Emit enrichment completion event
    events.emit('update', {
      type: 'enrichment_complete',
      userId,
      stats,
    });

    return stats;
  }

  /**
   * Store a new merchant mapping in both local DB and Cognee.
   */
  private async storeMerchantMapping(
    userId: string,
    mapping: {
      abbreviatedName: string;
      canonicalName: string;
      abn?: string;
      gstRegistered: boolean;
      industry?: string;
      defaultCategory: string;
    }
  ): Promise<void> {
    try {
      // Check if pattern already exists
      const existing = await db
        .select()
        .from(merchantMemory)
        .where(
          and(
            eq(merchantMemory.userId, userId),
            eq(merchantMemory.merchantPattern, mapping.abbreviatedName.toLowerCase())
          )
        )
        .get();

      if (existing) {
        // Update existing
        await db
          .update(merchantMemory)
          .set({
            merchantDisplayName: mapping.canonicalName,
            category: mapping.defaultCategory,
            gstApplicable: mapping.gstRegistered,
            timesUsed: (existing.timesUsed || 0) + 1,
            lastUsed: new Date().toISOString(),
          })
          .where(eq(merchantMemory.id, existing.id));
      } else {
        // Insert new
        await db.insert(merchantMemory).values({
          id: crypto.randomUUID(),
          userId,
          merchantPattern: mapping.abbreviatedName.toLowerCase(),
          merchantDisplayName: mapping.canonicalName,
          category: mapping.defaultCategory,
          gstApplicable: mapping.gstRegistered,
          timesUsed: 1,
          lastUsed: new Date().toISOString(),
          isUserConfirmed: false,
          createdAt: new Date().toISOString(),
        });
      }

      // Also store in Cognee for semantic search
      await cogneeClient.storeMerchantMapping(
        mapping.abbreviatedName,
        mapping.canonicalName,
        mapping.abn,
        mapping.gstRegistered,
        mapping.industry,
        mapping.defaultCategory
      );
    } catch (err) {
      logger.warn('[Enrichment] Failed to store merchant mapping:', err);
    }
  }

  /**
   * Batch enrich all uncategorized transactions for a user.
   */
  async enrichUncategorized(userId: string): Promise<{ enriched: number; failed: number; pending: number }> {
    const uncategorized = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          sql`(${transactions.category} IS NULL OR ${transactions.category} = '' OR ${transactions.category} = 'Uncategorized')`
        )
      )
      .all();

    if (uncategorized.length === 0) {
      return { enriched: 0, failed: 0, pending: 0 };
    }

    const ids = uncategorized.map((tx: any) => tx.id);
    return this.enrichTransactions(ids, userId);
  }
}

export const enrichmentService = new EnrichmentService();
