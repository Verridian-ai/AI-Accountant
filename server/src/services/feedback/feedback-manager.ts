/**
 * Feedback Manager — Core Class: submission, retrieval, merchant memory learning.
 */

import { db, parserFeedback, transactions, statements, transactionHistory } from '../../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';
import type { FeedbackType, FeedbackStatus, FeedbackRecord, FeedbackWithContext } from './types.js';
import {
  applyFeedbackToMerchantMemory as applyFeedbackToMerchantMemoryFn,
  findConsistentCategoryCorrections as findConsistentCategoryCorrectionsFn,
} from './feedback-learning.js';

export class FeedbackManager {
  // -- Feedback Submission --------------------------------------------------

  async submitFeedback(
    userId: string,
    transactionId: string,
    feedbackType: FeedbackType,
    correctedValue: string,
    comment?: string,
  ): Promise<FeedbackRecord> {
    logger.info(
      `[FeedbackManager] Submitting ${feedbackType} feedback for transaction ${transactionId}`,
    );

    const transaction = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .get();

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.userId !== userId) {
      throw new Error('Unauthorized: Transaction does not belong to user');
    }

    const originalValue = this.getOriginalValue(transaction, feedbackType);

    const stmt = transaction.statementId
      ? await db.select().from(statements).where(eq(statements.id, transaction.statementId)).get()
      : null;

    const feedbackId = crypto.randomUUID();
    const now = new Date().toISOString();

    const feedbackRecord: typeof parserFeedback.$inferInsert = {
      id: feedbackId,
      userId,
      transactionId,
      statementId: transaction.statementId || null,
      bankId: stmt?.aiModelUsed?.split('/')[0] || null,
      feedbackType,
      originalValue,
      correctedValue,
      aiConfidence:
        transaction.confidenceScore != null ? String(transaction.confidenceScore) : null,
      userNotes: comment || null,
      status: 'pending',
      createdAt: now,
    };

    await db.insert(parserFeedback).values(feedbackRecord);
    await this.applyFeedbackToTransaction(transaction, feedbackType, correctedValue);
    await this.recordTransactionHistory(transaction, feedbackType, originalValue, correctedValue);

    logger.info(`[FeedbackManager] Feedback ${feedbackId} submitted successfully`);
    return feedbackRecord as FeedbackRecord;
  }

  private getOriginalValue(
    transaction: typeof transactions.$inferSelect,
    feedbackType: FeedbackType,
  ): string {
    switch (feedbackType) {
      case 'category_correction':
        return transaction.category || '';
      case 'amount_correction':
        return String(transaction.amount);
      case 'date_correction':
        return transaction.date;
      case 'description_correction':
        return transaction.description;
      case 'duplicate_flag':
        return 'not_duplicate';
      case 'split_request':
        return String(transaction.amount);
      default:
        return '';
    }
  }

  private async applyFeedbackToTransaction(
    transaction: typeof transactions.$inferSelect,
    feedbackType: FeedbackType,
    correctedValue: string,
  ): Promise<void> {
    const updates: Partial<typeof transactions.$inferInsert> = {
      isEdited: true,
    };

    switch (feedbackType) {
      case 'category_correction':
        updates.category = correctedValue;
        break;
      case 'amount_correction': {
        const parsedAmount = parseInt(correctedValue, 10);
        if (isNaN(parsedAmount)) {
          throw new Error(`Invalid amount value: ${correctedValue}. Expected integer (cents).`);
        }
        if (Math.abs(parsedAmount) > 1000000000) {
          throw new Error(`Amount value out of reasonable range: ${correctedValue}`);
        }
        updates.amount = parsedAmount;
        break;
      }
      case 'date_correction':
        updates.date = correctedValue;
        break;
      case 'description_correction':
        updates.description = correctedValue;
        updates.merchantNormalized = this.normalizeMerchant(correctedValue);
        break;
      case 'duplicate_flag':
        break;
      case 'split_request':
        break;
    }

    await db.update(transactions).set(updates).where(eq(transactions.id, transaction.id));
  }

  private async recordTransactionHistory(
    transaction: typeof transactions.$inferSelect,
    feedbackType: FeedbackType,
    originalValue: string,
    correctedValue: string,
  ): Promise<void> {
    await db.insert(transactionHistory).values({
      id: crypto.randomUUID(),
      transactionId: transaction.id,
      changeType: 'EDIT',
      oldData: JSON.stringify({ feedbackType, originalValue }),
      newData: JSON.stringify({ feedbackType, correctedValue }),
      timestamp: new Date().toISOString(),
    });
  }

  private normalizeMerchant(description: string): string {
    return description
      .toUpperCase()
      .replace(/[0-9]+/g, '')
      .replace(/[^A-Z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50);
  }

  // -- Feedback Retrieval ----------------------------------------------------

  async getFeedbackForTransaction(transactionId: string): Promise<FeedbackRecord[]> {
    const records = await db
      .select()
      .from(parserFeedback)
      .where(eq(parserFeedback.transactionId, transactionId))
      .orderBy(desc(parserFeedback.createdAt))
      .all();
    return records as FeedbackRecord[];
  }

  async getFeedbackForUser(
    userId: string,
    options?: {
      feedbackType?: FeedbackType;
      status?: FeedbackStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<FeedbackRecord[]> {
    const conditions = [eq(parserFeedback.userId, userId)];
    if (options?.feedbackType) {
      conditions.push(eq(parserFeedback.feedbackType, options.feedbackType));
    }
    if (options?.status) {
      conditions.push(eq(parserFeedback.status, options.status));
    }
    const records = await db
      .select()
      .from(parserFeedback)
      .where(and(...conditions))
      .orderBy(desc(parserFeedback.createdAt))
      .limit(options?.limit || 100)
      .offset(options?.offset || 0)
      .all();
    return records as FeedbackRecord[];
  }

  async getPendingFeedbackReview(options?: {
    limit?: number;
    offset?: number;
    feedbackType?: FeedbackType;
    bankId?: string;
  }): Promise<FeedbackWithContext[]> {
    logger.info('[FeedbackManager] Fetching pending feedback for review');
    const conditions = [eq(parserFeedback.status, 'pending')];
    if (options?.feedbackType) {
      conditions.push(eq(parserFeedback.feedbackType, options.feedbackType));
    }
    if (options?.bankId) {
      conditions.push(eq(parserFeedback.bankId, options.bankId));
    }

    const feedbackRecords = await db
      .select()
      .from(parserFeedback)
      .where(and(...conditions))
      .orderBy(desc(parserFeedback.createdAt))
      .limit(options?.limit || 50)
      .offset(options?.offset || 0)
      .all();

    const results: FeedbackWithContext[] = [];
    for (const feedback of feedbackRecords) {
      const transaction = await db
        .select({
          id: transactions.id,
          date: transactions.date,
          description: transactions.description,
          amount: transactions.amount,
          category: transactions.category,
          merchantNormalized: transactions.merchantNormalized,
        })
        .from(transactions)
        .where(eq(transactions.id, feedback.transactionId))
        .get();
      results.push({
        ...(feedback as FeedbackRecord),
        transaction: transaction || null,
      });
    }
    return results;
  }

  async updateFeedbackStatus(
    feedbackId: string,
    status: FeedbackStatus,
    reviewNotes?: string,
  ): Promise<void> {
    await db
      .update(parserFeedback)
      .set({
        status,
        reviewedAt: new Date().toISOString(),
        reviewNotes: reviewNotes || null,
      })
      .where(eq(parserFeedback.id, feedbackId));
    logger.info(`[FeedbackManager] Feedback ${feedbackId} status updated to ${status}`);
  }

  // -- Learning & Merchant Memory (delegated to feedback-learning.ts) ------

  async applyFeedbackToMerchantMemory(
    userId?: string,
    minOccurrences: number = 2,
  ): Promise<{ updated: number; created: number }> {
    return applyFeedbackToMerchantMemoryFn(userId, minOccurrences);
  }

  async findConsistentCategoryCorrections(
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
    return findConsistentCategoryCorrectionsFn(userId, minOccurrences);
  }
}
