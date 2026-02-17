/**
 * Transaction Enrichment Pipeline
 *
 * Runs after statement parsing to enrich transactions:
 * 0. Cache lookup -- check merchantMemory for existing mappings (skip AI if hit)
 * 1. Merchant Intelligence Agent -> resolve merchant name, ABN, GST status
 *    1a. ABN validation via ABR API (if ABN found)
 *    1b. Google Places lookup for address (if merchant name resolved)
 * 2. TransactionCategorizerAgent -> categorize with enriched context
 * 3. GSTCalculatorAgent -> determine GST treatment
 */

import { db, transactions, merchantMemory } from '../../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { MerchantIntelligenceAgent } from '../claude/agents/merchant-intelligence.js';
import { logger } from '../../utils/logger.js';
import { events } from '../../events.js';
import { calculateGstFromInclusive } from '../bas.js';
import { ABNLookupService } from './abn-lookup.js';
import { PlacesLookupService } from './places-lookup.js';
import { inferGstCategory, stripPaymentPrefix } from './types.js';
import { runMerchantPipeline } from './merchant-pipeline.js';

export class EnrichmentService {
  private merchantAgent: MerchantIntelligenceAgent;
  private abnLookup: ABNLookupService;
  private placesLookup: PlacesLookupService;

  constructor() {
    this.merchantAgent = new MerchantIntelligenceAgent();
    this.abnLookup = new ABNLookupService();
    this.placesLookup = new PlacesLookupService();
  }

  /**
   * Enrich a batch of transactions after parsing.
   */
  async enrichTransactions(
    transactionIds: string[],
    userId: string,
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

    const existingMappings = memoryRecords
      .filter(
        (m: any) =>
          !m.merchantPattern.startsWith('abn:') && !m.merchantPattern.startsWith('places:'),
      )
      .map((m: any) => ({
        pattern: m.merchantPattern,
        displayName: m.merchantDisplayName || m.merchantPattern,
        category: m.category,
        gstRegistered: m.gstApplicable ?? false,
      }));

    // Stage 0: Cache lookup
    const uncachedTxs: typeof txList = [];
    const cacheHits = new Map<
      string,
      { category: string; merchantNormalized: string; gstRegistered: boolean }
    >();

    for (const tx of txList) {
      const desc = stripPaymentPrefix((tx as any).description || '');
      const matched = existingMappings.find((m: any) =>
        desc.toLowerCase().includes(m.pattern.toLowerCase()),
      );
      if (matched && matched.category) {
        cacheHits.set(tx.id, {
          category: matched.category,
          merchantNormalized: matched.displayName,
          gstRegistered: matched.gstRegistered,
        });
      } else {
        uncachedTxs.push(tx);
      }
    }

    if (cacheHits.size > 0) {
      logger.info(`[Enrichment] Stage 0: ${cacheHits.size} transactions resolved from cache`);
    }

    // Stages 1, 1a, 1b: Merchant pipeline
    const merchantResults = await runMerchantPipeline(
      this.merchantAgent,
      this.abnLookup,
      this.placesLookup,
      uncachedTxs,
      existingMappings,
      userId,
    );

    // Stage 2 & 3: Apply categorization and GST to each transaction
    for (const tx of txList) {
      try {
        const txId = tx.id;
        const cached = cacheHits.get(txId);
        let category = (tx as any).category || '';
        let merchantNormalized = (tx as any).merchantNormalized || '';
        let gstRegistered = true;

        if (cached) {
          category = category || cached.category;
          merchantNormalized = merchantNormalized || cached.merchantNormalized;
          gstRegistered = cached.gstRegistered;
        } else {
          const merchantInfo = merchantResults.find(
            (m) => m.transactionId === (parseInt(txId, 10) || 0),
          );

          if (merchantInfo) {
            category = category || merchantInfo.defaultCategory;
            merchantNormalized = merchantInfo.canonicalName || merchantNormalized;
            gstRegistered = merchantInfo.gstRegistered;
          }

          if (!category) {
            const desc = stripPaymentPrefix((tx as any).description || '');
            const matched = existingMappings.find((m: any) =>
              desc.toLowerCase().includes(m.pattern.toLowerCase()),
            );
            if (matched) {
              category = matched.category;
              merchantNormalized = matched.displayName;
              gstRegistered = matched.gstRegistered;
            }
          }
        }

        // GST calculation (non-AI, rule-based)
        const gstResult = category
          ? inferGstCategory(category, (tx as any).amount)
          : { gstCategory: 'taxable_10', gstAmount: calculateGstFromInclusive((tx as any).amount) };

        if (!gstRegistered) {
          gstResult.gstCategory = 'gst_free';
          gstResult.gstAmount = 0;
        }

        // Skip overwriting GST fields if user has manually edited
        if ((tx as any).isEdited) {
          logger.info(`[Enrichment] Skipping GST overwrite for edited transaction ${txId}`);
          const updateData: Record<string, any> = {};
          if (merchantNormalized) updateData.merchantNormalized = merchantNormalized;
          if (category && !(tx as any).category) updateData.category = category;
          if (Object.keys(updateData).length > 0) {
            await db.update(transactions).set(updateData).where(eq(transactions.id, txId));
          }
          stats.enriched++;
          continue;
        }

        // Update transaction
        const updateData: Record<string, any> = {
          gstCategory: gstResult.gstCategory,
          gstAmount: gstResult.gstAmount,
          gstApplicable:
            gstResult.gstCategory === 'taxable_10' || gstResult.gstCategory === 'capital',
        };

        if (merchantNormalized) updateData.merchantNormalized = merchantNormalized;
        if (category && !(tx as any).category) updateData.category = category;

        await db.update(transactions).set(updateData).where(eq(transactions.id, txId));

        stats.enriched++;
      } catch (err) {
        logger.warn({ err }, `[Enrichment] Failed to enrich transaction ${tx.id}`);
        stats.failed++;
      }
    }

    stats.pending = transactionIds.length - stats.enriched - stats.failed;

    events.emit('update', { type: 'enrichment_complete', userId, stats });

    return stats;
  }

  /**
   * Batch enrich all uncategorized transactions for a user.
   */
  async enrichUncategorized(
    userId: string,
  ): Promise<{ enriched: number; failed: number; pending: number }> {
    const uncategorized = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          sql`(${transactions.category} IS NULL OR ${transactions.category} = '' OR ${transactions.category} = 'Uncategorized')`,
        ),
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
