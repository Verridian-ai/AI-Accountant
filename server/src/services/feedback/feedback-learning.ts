/**
 * Feedback Learning — Merchant Memory Pattern Application
 *
 * Analyzes consistent category corrections from feedback and
 * applies them to merchant memory for automatic future categorization.
 */

import { db, parserFeedback, transactions, merchantMemory } from '../../schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

/**
 * Apply consistent feedback patterns to merchant memory.
 */
export async function applyFeedbackToMerchantMemory(
  userId?: string,
  minOccurrences: number = 2,
): Promise<{ updated: number; created: number }> {
  logger.info('[FeedbackManager] Applying feedback patterns to merchant memory');
  const categoryPatterns = await findConsistentCategoryCorrections(userId, minOccurrences);
  let updated = 0;
  let created = 0;
  const now = new Date().toISOString();

  for (const pattern of categoryPatterns) {
    if (!pattern.merchantNormalized) continue;
    const conditions = [eq(merchantMemory.merchantPattern, pattern.merchantNormalized)];
    if (userId) {
      conditions.push(eq(merchantMemory.userId, userId));
    }
    const existing = await db
      .select()
      .from(merchantMemory)
      .where(and(...conditions))
      .get();

    if (existing) {
      if (!existing.isUserConfirmed || pattern.occurrences > (existing.timesUsed || 0)) {
        await db
          .update(merchantMemory)
          .set({
            category: pattern.correctedValue,
            isUserConfirmed: true,
            timesUsed: (existing.timesUsed || 0) + pattern.occurrences,
            lastUsed: now,
          })
          .where(eq(merchantMemory.id, existing.id));
        updated++;
      }
    } else if (userId) {
      await db.insert(merchantMemory).values({
        id: crypto.randomUUID(),
        userId,
        merchantPattern: pattern.merchantNormalized,
        merchantDisplayName: pattern.merchantDisplayName || null,
        category: pattern.correctedValue,
        gstApplicable: false,
        timesUsed: pattern.occurrences,
        lastUsed: now,
        isUserConfirmed: true,
        createdAt: now,
      });
      created++;
    }

    if (pattern.feedbackIds.length > 0) {
      await db
        .update(parserFeedback)
        .set({
          status: 'applied',
          reviewedAt: now,
          reviewNotes: 'Auto-applied to merchant memory',
        })
        .where(inArray(parserFeedback.id, pattern.feedbackIds));
    }
  }

  logger.info(`[FeedbackManager] Merchant memory updated: ${updated} updated, ${created} created`);
  return { updated, created };
}

/**
 * Find consistent category corrections for a merchant pattern.
 */
export async function findConsistentCategoryCorrections(
  userId?: string,
  minOccurrences: number = 2,
): Promise<
  Array<{
    merchantNormalized: string;
    merchantDisplayName?: string;
    correctedValue: string;
    occurrences: number;
    feedbackIds: string[];
  }>
> {
  const conditions = [
    eq(parserFeedback.feedbackType, 'category_correction'),
    eq(parserFeedback.status, 'pending'),
  ];
  if (userId) {
    conditions.push(eq(parserFeedback.userId, userId));
  }
  const feedback = await db
    .select()
    .from(parserFeedback)
    .where(and(...conditions))
    .all();

  const transactionIds = [...new Set(feedback.map((f: any) => f.transactionId as string))];
  const txns =
    transactionIds.length > 0
      ? await db
          .select()
          .from(transactions)
          .where(inArray(transactions.id, transactionIds as string[]))
          .all()
      : [];
  const txnMap = new Map(txns.map((t: any) => [t.id, t]));

  const patternMap = new Map<
    string,
    {
      merchantNormalized: string;
      merchantDisplayName: string;
      correctedValue: string;
      feedbackIds: string[];
    }
  >();

  for (const fb of feedback) {
    const txn = txnMap.get(fb.transactionId) as any;
    if (!txn || !txn.merchantNormalized) continue;
    const key = `${txn.merchantNormalized}::${fb.correctedValue}`;
    if (!patternMap.has(key)) {
      patternMap.set(key, {
        merchantNormalized: txn.merchantNormalized,
        merchantDisplayName: txn.description,
        correctedValue: fb.correctedValue || '',
        feedbackIds: [],
      });
    }
    patternMap.get(key)!.feedbackIds.push(fb.id);
  }

  return Array.from(patternMap.values())
    .filter((p) => p.feedbackIds.length >= minOccurrences)
    .map((p) => ({ ...p, occurrences: p.feedbackIds.length }));
}
