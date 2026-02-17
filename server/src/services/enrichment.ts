/**
 * Transaction Enrichment Pipeline
 *
 * Runs after statement parsing to enrich transactions:
 * 0. Cache lookup — check merchantMemory for existing mappings (skip AI if hit)
 * 1. Merchant Intelligence Agent → resolve merchant name, ABN, GST status
 *    1a. ABN validation via ABR API (if ABN found)
 *    1b. Google Places lookup for address (if merchant name resolved)
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
import { ABNLookupService } from './enrichment/abn-lookup.js';
import { PlacesLookupService } from './enrichment/places-lookup.js';
import crypto from 'crypto';

/** Enrichment status for tracking */
export type EnrichmentStatus = 'enriched' | 'pending' | 'unknown' | 'failed';

/** GST category inference from transaction description (non-AI fallback) */
const GST_FREE_CATEGORIES = new Set([
  'Government & Tax',
  'Internal Transfer',
  'Transfer',
  'Interest & Dividends',
  'Loan/Liability Payment',
  'Superannuation',
  'Insurance',
  'Medical & Health',
  'Education & Childcare',
  'Donations & Charity',
  'Employment Income',
  'Salary & Wages',
]);

const INPUT_TAXED_CATEGORIES = new Set(['Financial Services']);

/**
 * Payment prefixes to strip when matching merchant patterns.
 * These appear at the start of transaction descriptions and obscure the merchant name.
 */
const PAYMENT_PREFIXES = [
  'EFTPOS',
  'BPAY',
  'DIRECT DEBIT',
  'ATM',
  'OSKO',
  'PAY/TRANSFER',
  'VISA PURCHASE',
  'VISA DEBIT',
  'MASTERCARD',
  'PENDING',
  'INTERNATIONAL',
  'CARD PURCHASE',
  'TRANSFER TO',
  'TRANSFER FROM',
  'INTERNET BANKING',
  'MOBILE BANKING',
];

/** Compiled prefix pattern for stripping payment method prefixes */
const PREFIX_REGEX = new RegExp(
  `^(${PAYMENT_PREFIXES.map((p) => p.replace(/[/\\]/g, '\\$&')).join('|')})\\s+`,
  'i',
);

function inferGstCategory(
  category: string,
  amount: number,
): { gstCategory: string; gstAmount: number } {
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

/**
 * Strip common payment prefixes from a transaction description
 * to isolate the merchant name portion.
 */
function stripPaymentPrefix(description: string): string {
  return description.replace(PREFIX_REGEX, '').trim();
}

export class EnrichmentService {
  private merchantAgent: MerchantIntelligenceAgent;
  private categorizerAgent: TransactionCategorizerAgent;
  private gstAgent: GSTCalculatorAgent;
  private abnLookup: ABNLookupService;
  private placesLookup: PlacesLookupService;

  constructor() {
    this.merchantAgent = new MerchantIntelligenceAgent();
    this.categorizerAgent = new TransactionCategorizerAgent();
    this.gstAgent = new GSTCalculatorAgent();
    this.abnLookup = new ABNLookupService();
    this.placesLookup = new PlacesLookupService();
  }

  /**
   * Enrich a batch of transactions after parsing.
   * Runs the multi-stage pipeline: Cache → Merchant → ABN → Places → Category → GST
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

    type MemoryRow = { merchantPattern: string; merchantDisplayName: string | null; category: string | null; gstApplicable: boolean | null };
    const existingMappings = (memoryRecords as MemoryRow[])
      .filter(
        (m) =>
          !m.merchantPattern.startsWith('abn:') && !m.merchantPattern.startsWith('places:'),
      )
      .map((m) => ({
        pattern: m.merchantPattern,
        displayName: m.merchantDisplayName || m.merchantPattern,
        category: m.category,
        gstRegistered: m.gstApplicable ?? false,
      }));

    // Stage 0: Cache lookup — resolve what we can from memory before calling AI
    const uncachedTxs: typeof txList = [];
    const cacheHits = new Map<
      string,
      { category: string; merchantNormalized: string; gstRegistered: boolean }
    >();

    for (const tx of txList) {
      const desc = stripPaymentPrefix(String((tx as Record<string, unknown>).description || ''));
      const matched = existingMappings.find((m) =>
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

    // Stage 1: Merchant Intelligence (only for uncached transactions)
    let merchantResults: Array<{
      transactionId: number;
      canonicalName: string;
      gstRegistered: boolean;
      defaultCategory: string;
      confidence: number;
      abn?: string;
      industry?: string;
    }> = [];

    if (uncachedTxs.length > 0 && isAgentEnabled('merchant_intelligence')) {
      try {
        logger.info(
          `[Enrichment] Stage 1: Running Merchant Intelligence on ${uncachedTxs.length} transactions`,
        );

        type TxLike = { id: string; description: string | null; amount: number; category: string | null };
        const merchantInput = {
          merchants: (uncachedTxs as TxLike[]).map((tx) => ({
            transactionId: parseInt(tx.id, 10) || 0,
            description: tx.description ?? '',
            amount: tx.amount,
            category: tx.category ?? '',
          })),
          existingMappings,
        };

        const result = await this.merchantAgent.invoke(merchantInput as Parameters<typeof this.merchantAgent.invoke>[0]);
        merchantResults = result.results;

        // Store new merchant mappings (with ABN and industry now persisted)
        for (const mapping of result.newMappings) {
          await this.storeMerchantMapping(userId, mapping);
        }

        // Trigger cognify on merchant_mappings if new mappings were stored
        if (result.newMappings.length > 0) {
          cogneeClient
            .cognify(['merchant_mappings'], true)
            .catch((err) =>
              logger.warn('[Enrichment] Background cognify for merchant_mappings failed:', err),
            );
        }

        logger.info(
          `[Enrichment] Stage 1: Merchant Intelligence resolved ${merchantResults.length} merchants`,
        );
      } catch (err) {
        logger.warn('[Enrichment] Merchant Intelligence failed, continuing with fallback', err);
      }
    }

    // Stage 1a: ABN validation via ABR API (for merchants with ABNs)
    if (this.abnLookup.available && merchantResults.length > 0) {
      for (const mr of merchantResults) {
        if (mr.abn) {
          try {
            const abnResult = await this.abnLookup.searchByABN(mr.abn);
            if (abnResult) {
              // Update GST status from authoritative ABR data
              mr.gstRegistered = abnResult.gstRegistered;
              if (abnResult.businessName && !mr.canonicalName) {
                mr.canonicalName = abnResult.businessName;
              }
              await this.abnLookup.cacheResult(userId, abnResult);
              logger.debug(
                `[Enrichment] ABN ${mr.abn}: GST=${abnResult.gstRegistered}, name="${abnResult.businessName}"`,
              );
            }
          } catch (err) {
            logger.warn(`[Enrichment] ABN lookup failed for ${mr.abn}:`, err);
          }
        }
      }
    }

    // Stage 1b: Google Places lookup for address (optional, for resolved merchants)
    if (this.placesLookup.available && merchantResults.length > 0) {
      for (const mr of merchantResults) {
        if (mr.canonicalName && mr.canonicalName.length >= 3) {
          try {
            const placeResult = await this.placesLookup.searchPlace(mr.canonicalName);
            if (placeResult) {
              await this.placesLookup.cacheResult(userId, mr.canonicalName, placeResult);
              logger.debug(
                `[Enrichment] Places: "${mr.canonicalName}" → ${placeResult.formattedAddress}`,
              );
            }
          } catch (err) {
            logger.warn(`[Enrichment] Places lookup failed for "${mr.canonicalName}":`, err);
          }
        }
      }
    }

    // Stage 2 & 3: For each transaction, apply categorization and GST
    for (const tx of txList) {
      try {
        const txId = tx.id;

        // Check if resolved from cache (Stage 0)
        const cached = cacheHits.get(txId);
        let category: string = String((tx as Record<string, unknown>).category || '');
        let merchantNormalized: string = String((tx as Record<string, unknown>).merchantNormalized || '');
        let gstRegistered: boolean = true;

        if (cached) {
          category = category || cached.category;
          merchantNormalized = merchantNormalized || cached.merchantNormalized;
          gstRegistered = cached.gstRegistered;
        } else {
          // Check merchant intelligence results
          const merchantInfo = merchantResults.find(
            (m) => m.transactionId === (parseInt(txId, 10) || 0),
          );

          if (merchantInfo) {
            category = category || merchantInfo.defaultCategory;
            merchantNormalized = merchantInfo.canonicalName || merchantNormalized;
            gstRegistered = merchantInfo.gstRegistered;
          }

          // Fallback: try memory patterns with prefix stripping
          if (!category) {
            const desc = stripPaymentPrefix(String((tx as Record<string, unknown>).description ?? ''));
            const matched = existingMappings.find((m: Record<string, unknown>) =>
              desc.toLowerCase().includes(String(m.pattern).toLowerCase()),
            );
            if (matched) {
              category = String(matched.category ?? '');
              merchantNormalized = String(matched.displayName ?? '');
              gstRegistered = Boolean(matched.gstRegistered ?? true);
            }
          }
        }

        // Stage 3: GST calculation (non-AI, rule-based)
        const gstResult = category
          ? inferGstCategory(category, Number((tx as Record<string, unknown>).amount))
          : { gstCategory: 'taxable_10', gstAmount: calculateGstFromInclusive(Number((tx as Record<string, unknown>).amount)) };

        if (!gstRegistered) {
          gstResult.gstCategory = 'gst_free';
          gstResult.gstAmount = 0;
        }

        // Skip overwriting GST fields if user has manually edited this transaction
        if ((tx as Record<string, unknown>).isEdited) {
          logger.info(`[Enrichment] Skipping GST overwrite for edited transaction ${txId}`);
          const updateData: Record<string, any> = {};
          if (merchantNormalized) {
            updateData.merchantNormalized = merchantNormalized;
          }
          if (category && !(tx as Record<string, unknown>).category) {
            updateData.category = category;
          }
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

        if (merchantNormalized) {
          updateData.merchantNormalized = merchantNormalized;
        }
        if (category && !(tx as Record<string, unknown>).category) {
          updateData.category = category;
        }

        await db.update(transactions).set(updateData).where(eq(transactions.id, txId));

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
   * Checks for duplicates before inserting. Persists ABN and industry fields.
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
    },
  ): Promise<void> {
    try {
      // Check if pattern already exists (prevents Cognee append-only duplication)
      const existing = await db
        .select()
        .from(merchantMemory)
        .where(
          and(
            eq(merchantMemory.userId, userId),
            eq(merchantMemory.merchantPattern, mapping.abbreviatedName.toLowerCase()),
          ),
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

      // Only store to Cognee if the mapping is new (prevents append-only duplication)
      if (!existing) {
        await cogneeClient.storeMerchantMapping(
          mapping.abbreviatedName,
          mapping.canonicalName,
          mapping.abn,
          mapping.gstRegistered,
          mapping.industry,
          mapping.defaultCategory,
        );
      }
    } catch (err) {
      logger.warn('[Enrichment] Failed to store merchant mapping:', err);
    }
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

    const ids = uncategorized.map((tx: Record<string, unknown>) => tx.id);
    return this.enrichTransactions(ids, userId);
  }
}

export const enrichmentService = new EnrichmentService();
