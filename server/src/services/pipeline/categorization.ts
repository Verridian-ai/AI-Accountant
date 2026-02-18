/**
 * Pipeline stage: Transaction categorization, saving, and indexing.
 */
import { db, transactions, pendingCategorization } from '../../schema.js';
import type { DbInstance } from '../../db/queries/types.js';
import { aiService } from '../ai.js';
import { ragService } from '../rag.js';
import { accountService } from '../accounts.js';
import { cogneeClient } from '../cognee_client.js';
import { enrichmentService } from '../enrichment.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';
import {
  type AccountDetectionResult,
  type RawTransactionData,
  type CategorizationResult,
  inferGstCategory,
  calculateGstAmount,
} from './types.js';

// Transaction deduplication helper
export function computeTransactionHash(
  date: string,
  description: string,
  amount: number,
  accountId: string | null,
): string {
  const raw = `${date}|${description}|${amount}|${accountId ?? ''}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Categorize transactions using AI with merchant memory */
export async function categorizeTransactions(
  rawTransactions: RawTransactionData['transactions'],
  userId: string | undefined,
  modelCategorization: string | undefined,
): Promise<CategorizationResult[]> {
  // Get merchant memory for intelligent categorization
  const merchantMemoryData = userId ? await accountService.getMerchantMemory(userId) : [];
  const memoryPatterns = merchantMemoryData.map((m: Record<string, unknown>) => ({
    pattern: m.merchantPattern as string,
    category: m.category as string,
    gst: (m.gstApplicable as boolean) ?? false,
  }));

  let categorizations: CategorizationResult[] = [];

  try {
    categorizations = await aiService.categorizeWithMemory(
      rawTransactions.map((tx) => ({
        description: tx.description,
        amount_cents: tx.amount_cents,
      })),
      memoryPatterns,
      modelCategorization,
    );
  } catch (catErr) {
    logger.warn(
      { err: catErr },
      '[Pipeline Category Error] Failed to categorize with memory, falling back to basic.',
    );
    // Fallback to basic categorization
    try {
      const basicCats = await aiService.categorizeTransactionsBatch(
        rawTransactions.map((tx) => ({
          description: tx.description,
          amount_cents: tx.amount_cents,
        })),
        modelCategorization,
      );
      categorizations = basicCats.map((c) => ({
        ...c,
        confidence: 0.5,
        merchantNormalized: '',
        needsReview: true,
      }));
    } catch (fallbackErr) {
      logger.error(
        { err: fallbackErr },
        '[Pipeline Fallback Category Error] Both categorization methods failed.',
      );
    }
  }

  return categorizations;
}

/** Prepare transaction insert records with deduplication */
export async function prepareTransactionInserts(
  rawData: RawTransactionData,
  categorizations: CategorizationResult[],
  statementId: string,
  userId: string | undefined,
  accountDetection: AccountDetectionResult,
  isBusinessCreditCard: boolean,
) {
  const allToInsert = rawData.transactions.map((tx, i) => {
    const aiCat = (categorizations && categorizations[i]) || {
      category: 'Uncategorized',
      gst: false,
      notes: 'Missing from batch',
      confidence: 0,
      merchantNormalized: '',
      needsReview: true,
    };
    // Auto-flag GST for business credit card transactions
    const gstApplicable = isBusinessCreditCard ? true : aiCat.gst;
    const gstCategory = isBusinessCreditCard
      ? inferGstCategory(aiCat.category, true)
      : inferGstCategory(aiCat.category, gstApplicable);
    const gstAmount =
      gstApplicable && gstCategory === 'taxable_10' ? calculateGstAmount(tx.amount_cents) : 0;

    return {
      id: crypto.randomUUID(),
      statementId: statementId,
      userId: userId,
      accountId: accountDetection.accountId,
      date: tx.date,
      description: tx.description,
      amount: tx.amount_cents,
      balance: tx.balance_cents,
      category: aiCat.category,
      gstApplicable: gstApplicable,
      gstAmount: gstAmount,
      gstCategory: gstCategory,
      aiReasoningNotes: aiCat.notes,
      confidenceScore: aiCat.confidence,
      merchantNormalized: aiCat.merchantNormalized || null,
      isTransfer: false,
      transactionHash: computeTransactionHash(
        tx.date,
        tx.description,
        tx.amount_cents,
        accountDetection.accountId,
      ),
    };
  });

  // Deduplicate: check for existing transactions with the same hash
  const toInsert: typeof allToInsert = [];
  for (const tx of allToInsert) {
    const existing = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.transactionHash, tx.transactionHash),
          eq(transactions.statementId, statementId),
        ),
      )
      .get();
    if (existing) {
      logger.info(
        `[Pipeline] Skipping duplicate transaction: ${tx.date} ${tx.description} ${tx.amount}`,
      );
    } else {
      toInsert.push(tx);
    }
  }
  if (allToInsert.length !== toInsert.length) {
    logger.info(
      `[Pipeline] Dedup: ${allToInsert.length - toInsert.length} duplicates skipped, ${toInsert.length} to insert`,
    );
  }
  return toInsert;
}

/** Insert transactions, pending categorizations, and update merchant memory */
export async function insertTransactions(
  toInsert: Awaited<ReturnType<typeof prepareTransactionInserts>>,
  categorizations: CategorizationResult[],
  userId: string | undefined,
) {
  if (toInsert.length === 0) return;
  logger.info(`[Pipeline] Inserting ${toInsert.length} transactions into database...`);

  await db.transaction(async (tx: DbInstance) => {
    await tx.insert(transactions).values(toInsert);

    const pendingItems: (typeof pendingCategorization.$inferInsert)[] = [];
    for (let i = 0; i < categorizations.length; i++) {
      const cat = categorizations[i];
      const t = toInsert[i];
      if (cat && cat.needsReview && cat.confidence < 0.7 && userId) {
        pendingItems.push({
          id: crypto.randomUUID(),
          userId,
          transactionId: t.id,
          suggestedCategory: t.category,
          suggestedConfidence: cat.confidence,
          aiReasoning: cat.notes || null,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (pendingItems.length > 0) {
      logger.info(
        `[Pipeline] Batch adding ${pendingItems.length} items to pending categorization queue...`,
      );
      await tx.insert(pendingCategorization).values(pendingItems);
    }

    if (userId) {
      const highConfidenceItems = categorizations.filter(
        (c) => c.confidence >= 0.8 && c.merchantNormalized,
      );
      const memoryUpdates = highConfidenceItems.map((cat) => ({
        merchantPattern: cat.merchantNormalized,
        merchantDisplayName: undefined,
        category: cat.category,
        gstApplicable: cat.gst,
        isUserConfirmed: false,
        createdAt: new Date().toISOString(),
      }));

      if (memoryUpdates.length > 0) {
        await accountService.batchUpdateMerchantMemory(userId, memoryUpdates);
      }
    }
  });
}

/** Index transactions in Cognee for RAG */
export async function indexInCognee(
  toInsert: Awaited<ReturnType<typeof prepareTransactionInserts>>,
  rawData: RawTransactionData,
  statementId: string,
  stmtFilename: string,
  accountDetection: AccountDetectionResult,
) {
  logger.info(`[Pipeline] Indexing ${toInsert.length} transactions in Cognee...`);
  try {
    await ragService.indexTransactions(toInsert);

    await cogneeClient.addStatementData({
      id: statementId,
      filename: stmtFilename,
      bankName: accountDetection.detectedInfo.bankName || undefined,
      periodStart: rawData.transactions[0]?.date,
      periodEnd: rawData.transactions[rawData.transactions.length - 1]?.date,
    });
  } catch (ragErr) {
    logger.error({ err: ragErr }, '[Pipeline Cognee Error]');
  }
}

/** Run enrichment on uncategorized transactions */
export async function runEnrichment(
  toInsert: Awaited<ReturnType<typeof prepareTransactionInserts>>,
  userId: string | undefined,
) {
  const uncategorizedIds = toInsert
    .filter((t) => !t.category || t.category === 'Uncategorized')
    .map((t) => t.id);
  if (uncategorizedIds.length > 0 && userId) {
    try {
      logger.info(
        `[Pipeline] Running enrichment on ${uncategorizedIds.length} uncategorized transactions...`,
      );
      await enrichmentService.enrichTransactions(uncategorizedIds, userId);
    } catch (enrichErr: unknown) {
      const msg = enrichErr instanceof Error ? enrichErr.message : String(enrichErr);
      logger.warn(`[Pipeline] Enrichment error (non-fatal): ${msg}`);
    }
  }
}
