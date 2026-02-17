import {
  db,
  parserFeedback,
  transactions,
  statements,
  merchantMemory,
  transactionHistory,
} from '../schema.js';
import { eq, and, desc, sql, count, inArray, gte, lt } from 'drizzle-orm';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Supported feedback types for parser corrections */
export type FeedbackType =
  | 'category_correction' // User changed category
  | 'amount_correction' // Parsed amount was wrong
  | 'date_correction' // Date parsed incorrectly
  | 'description_correction' // Merchant name wrong
  | 'duplicate_flag' // User marked as duplicate
  | 'split_request'; // User wants to split transaction

/** Status of feedback items */
export type FeedbackStatus = 'pending' | 'reviewed' | 'applied' | 'rejected';

/** Input for submitting feedback */
export interface FeedbackSubmission {
  userId: string;
  transactionId: string;
  feedbackType: FeedbackType;
  correctedValue: string;
  comment?: string;
}

/** Feedback record as stored in the database */
export interface FeedbackRecord {
  id: string;
  userId: string;
  transactionId: string;
  statementId: string | null;
  bankId: string | null;
  feedbackType: string;
  originalValue: string | null;
  correctedValue: string | null;
  aiConfidence: number | null;
  userNotes: string | null;
  status: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

/** Feedback with transaction context for review */
export interface FeedbackWithContext extends FeedbackRecord {
  transaction: {
    id: string;
    date: string;
    description: string;
    amount: number;
    category: string | null;
    merchantNormalized: string | null;
  } | null;
}

/** Aggregated feedback pattern for analysis */
export interface FeedbackPattern {
  feedbackType: FeedbackType;
  originalValue: string;
  correctedValue: string;
  occurrences: number;
  uniqueUsers: number;
  avgConfidence: number | null;
  bankIds: string[];
}

/** Parser improvement suggestion based on feedback patterns */
export interface ParserImprovementSuggestion {
  type:
    | 'category_rule'
    | 'merchant_mapping'
    | 'date_format'
    | 'amount_parsing'
    | 'duplicate_detection';
  priority: 'high' | 'medium' | 'low';
  description: string;
  pattern: string;
  suggestedFix: string;
  affectedCount: number;
  confidence: number;
}

/** Statistics for feedback summary */
export interface FeedbackStats {
  total: number;
  byStatus: Record<FeedbackStatus, number>;
  byType: Record<FeedbackType, number>;
  appliedToday: number;
  pendingReview: number;
  topCorrections: Array<{
    feedbackType: FeedbackType;
    originalValue: string;
    correctedValue: string;
    count: number;
  }>;
}

// ============================================================================
// FEEDBACK MANAGER CLASS
// ============================================================================

export class FeedbackManager {
  // ------------------------------------------------------------------------
  // FEEDBACK SUBMISSION
  // ------------------------------------------------------------------------

  /**
   * Submit feedback for a transaction correction.
   * Records the original value and the user's correction for later analysis.
   */
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

    // Fetch the transaction to get original values and context
    const transaction = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .get();

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    // Verify the transaction belongs to this user
    if (transaction.userId !== userId) {
      throw new Error('Unauthorized: Transaction does not belong to user');
    }

    // Determine the original value based on feedback type
    const originalValue = this.getOriginalValue(transaction, feedbackType);

    // Get statement and bank info for tracking
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
      bankId: stmt?.aiModelUsed?.split('/')[0] || null, // Extract bank from model if available
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

    // Apply the correction to the transaction immediately
    await this.applyFeedbackToTransaction(transaction, feedbackType, correctedValue);

    // Record the change in transaction history
    await this.recordTransactionHistory(transaction, feedbackType, originalValue, correctedValue);

    logger.info(`[FeedbackManager] Feedback ${feedbackId} submitted successfully`);

    return feedbackRecord as FeedbackRecord;
  }

  /**
   * Extract the original value from a transaction based on feedback type.
   */
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

  /**
   * Apply feedback correction to the transaction.
   */
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
        // Validate and parse the corrected amount
        const parsedAmount = parseInt(correctedValue, 10);
        if (isNaN(parsedAmount)) {
          throw new Error(`Invalid amount value: ${correctedValue}. Expected integer (cents).`);
        }
        // Sanity check: amounts should be reasonable (up to $10 million)
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
        // Also update normalized merchant if we can derive it
        updates.merchantNormalized = this.normalizeMerchant(correctedValue);
        break;
      case 'duplicate_flag':
        // Mark as duplicate - could trigger further processing
        // For now, we just mark it as edited
        break;
      case 'split_request':
        // Split requests need special handling - just mark for now
        break;
    }

    await db.update(transactions).set(updates).where(eq(transactions.id, transaction.id));
  }

  /**
   * Record the change in transaction history for audit trail.
   */
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
      oldData: JSON.stringify({
        feedbackType,
        originalValue,
      }),
      newData: JSON.stringify({
        feedbackType,
        correctedValue,
      }),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Normalize a merchant description for pattern matching.
   */
  private normalizeMerchant(description: string): string {
    return description
      .toUpperCase()
      .replace(/[0-9]+/g, '') // Remove numbers
      .replace(/[^A-Z\s]/g, '') // Keep only letters and spaces
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim()
      .slice(0, 50); // Limit length
  }

  // ------------------------------------------------------------------------
  // FEEDBACK RETRIEVAL
  // ------------------------------------------------------------------------

  /**
   * Get all feedback records for a specific transaction.
   */
  async getFeedbackForTransaction(transactionId: string): Promise<FeedbackRecord[]> {
    const records = await db
      .select()
      .from(parserFeedback)
      .where(eq(parserFeedback.transactionId, transactionId))
      .orderBy(desc(parserFeedback.createdAt))
      .all();

    return records as FeedbackRecord[];
  }

  /**
   * Get all feedback records for a user.
   */
  async getFeedbackForUser(
    userId: string,
    options?: {
      feedbackType?: FeedbackType;
      status?: FeedbackStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<FeedbackRecord[]> {
    // Build conditions array
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

  /**
   * Get pending feedback items for admin review with transaction context.
   */
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

    // Fetch transaction details for each feedback
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

  /**
   * Update the status of a feedback item after review.
   */
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

  // ------------------------------------------------------------------------
  // LEARNING & MERCHANT MEMORY
  // ------------------------------------------------------------------------

  /**
   * Apply consistent feedback patterns to merchant memory.
   * This learns from user corrections to improve future categorizations.
   */
  async applyFeedbackToMerchantMemory(
    userId?: string,
    minOccurrences: number = 2,
  ): Promise<{ updated: number; created: number }> {
    logger.info('[FeedbackManager] Applying feedback patterns to merchant memory');

    // Find category corrections that appear consistently
    const categoryPatterns = await this.findConsistentCategoryCorrections(userId, minOccurrences);

    let updated = 0;
    let created = 0;
    const now = new Date().toISOString();

    for (const pattern of categoryPatterns) {
      // Skip if we don't have a clear merchant pattern
      if (!pattern.merchantNormalized) continue;

      // Check if merchant memory entry already exists
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
        // Update existing entry if user confirmation is stronger
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
        // Create new merchant memory entry
        await db.insert(merchantMemory).values({
          id: crypto.randomUUID(),
          userId,
          merchantPattern: pattern.merchantNormalized,
          merchantDisplayName: pattern.merchantDisplayName || null,
          category: pattern.correctedValue,
          gstApplicable: false, // Default, can be updated later
          timesUsed: pattern.occurrences,
          lastUsed: now,
          isUserConfirmed: true,
          createdAt: now,
        });
        created++;
      }

      // Mark the feedback items as applied
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

    logger.info(
      `[FeedbackManager] Merchant memory updated: ${updated} updated, ${created} created`,
    );

    return { updated, created };
  }

  /**
   * Find category corrections that appear consistently.
   */
  private async findConsistentCategoryCorrections(
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
    // Get all category correction feedback
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

    // Group by transaction to get merchant info
    const transactionIds = [...new Set(feedback.map((f: Record<string, unknown>) => f.transactionId as string))];
    const txns =
      transactionIds.length > 0
        ? await db
            .select()
            .from(transactions)
            .where(inArray(transactions.id, transactionIds as string[]))
            .all()
        : [];

    const txnMap = new Map(txns.map((t: Record<string, unknown>) => [t.id, t]));

    // Group feedback by merchant pattern + corrected value
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
      const txn = txnMap.get(fb.transactionId) as Record<string, unknown>;
      if (!txn || !txn.merchantNormalized) continue;

      const key = `${txn.merchantNormalized}::${fb.correctedValue}`;

      if (!patternMap.has(key)) {
        patternMap.set(key, {
          merchantNormalized: String(txn.merchantNormalized),
          merchantDisplayName: String(txn.description),
          correctedValue: fb.correctedValue || '',
          feedbackIds: [],
        });
      }

      patternMap.get(key)!.feedbackIds.push(fb.id);
    }

    // Filter to patterns with enough occurrences
    return Array.from(patternMap.values())
      .filter((p) => p.feedbackIds.length >= minOccurrences)
      .map((p) => ({
        ...p,
        occurrences: p.feedbackIds.length,
      }));
  }

  // ------------------------------------------------------------------------
  // PATTERN ANALYSIS & SUGGESTIONS
  // ------------------------------------------------------------------------

  /**
   * Analyze feedback patterns to identify parser issues.
   */
  async analyzeFeedbackPatterns(options?: {
    startDate?: string;
    endDate?: string;
    minOccurrences?: number;
  }): Promise<FeedbackPattern[]> {
    logger.info('[FeedbackManager] Analyzing feedback patterns');

    const conditions = [];

    if (options?.startDate) {
      conditions.push(gte(parserFeedback.createdAt, options.startDate));
    }

    if (options?.endDate) {
      conditions.push(lt(parserFeedback.createdAt, options.endDate));
    }

    const allFeedback = await db
      .select()
      .from(parserFeedback)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .all();

    // Group by type + original + corrected value
    const patternMap = new Map<
      string,
      {
        feedbackType: FeedbackType;
        originalValue: string;
        correctedValue: string;
        userIds: Set<string>;
        confidences: number[];
        bankIds: Set<string>;
      }
    >();

    for (const fb of allFeedback) {
      const key = `${fb.feedbackType}::${fb.originalValue}::${fb.correctedValue}`;

      if (!patternMap.has(key)) {
        patternMap.set(key, {
          feedbackType: fb.feedbackType as FeedbackType,
          originalValue: fb.originalValue || '',
          correctedValue: fb.correctedValue || '',
          userIds: new Set(),
          confidences: [],
          bankIds: new Set(),
        });
      }

      const pattern = patternMap.get(key)!;
      pattern.userIds.add(fb.userId);
      if (fb.aiConfidence !== null) {
        pattern.confidences.push(fb.aiConfidence);
      }
      if (fb.bankId) {
        pattern.bankIds.add(fb.bankId);
      }
    }

    // Convert to result format and filter
    const minOccurrences = options?.minOccurrences || 1;

    return Array.from(patternMap.values())
      .filter((p) => p.userIds.size >= minOccurrences)
      .map((p) => ({
        feedbackType: p.feedbackType,
        originalValue: p.originalValue,
        correctedValue: p.correctedValue,
        occurrences: p.userIds.size,
        uniqueUsers: p.userIds.size,
        avgConfidence:
          p.confidences.length > 0
            ? p.confidences.reduce((a, b) => a + b, 0) / p.confidences.length
            : null,
        bankIds: Array.from(p.bankIds),
      }))
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  /**
   * Generate parser improvement suggestions based on feedback patterns.
   */
  async generateParserImprovementSuggestions(): Promise<ParserImprovementSuggestion[]> {
    logger.info('[FeedbackManager] Generating parser improvement suggestions');

    const patterns = await this.analyzeFeedbackPatterns({ minOccurrences: 3 });
    const suggestions: ParserImprovementSuggestion[] = [];

    for (const pattern of patterns) {
      const priority = this.calculatePriority(pattern);

      switch (pattern.feedbackType) {
        case 'category_correction':
          suggestions.push({
            type: 'category_rule',
            priority,
            description: `Users frequently change "${pattern.originalValue}" to "${pattern.correctedValue}"`,
            pattern: pattern.originalValue,
            suggestedFix: `Add rule: When category is "${pattern.originalValue}", consider "${pattern.correctedValue}" instead`,
            affectedCount: pattern.occurrences,
            confidence: pattern.avgConfidence || 0.5,
          });
          break;

        case 'description_correction':
          suggestions.push({
            type: 'merchant_mapping',
            priority,
            description: `Merchant name "${pattern.originalValue}" should be "${pattern.correctedValue}"`,
            pattern: pattern.originalValue,
            suggestedFix: `Add merchant mapping: "${pattern.originalValue}" -> "${pattern.correctedValue}"`,
            affectedCount: pattern.occurrences,
            confidence: 0.9, // High confidence for merchant mappings
          });
          break;

        case 'date_correction':
          suggestions.push({
            type: 'date_format',
            priority,
            description: `Date parsing error: "${pattern.originalValue}" should be "${pattern.correctedValue}"`,
            pattern: pattern.originalValue,
            suggestedFix: `Review date format parsing for banks: ${pattern.bankIds.join(', ')}`,
            affectedCount: pattern.occurrences,
            confidence: 0.8,
          });
          break;

        case 'amount_correction':
          suggestions.push({
            type: 'amount_parsing',
            priority,
            description: `Amount parsing error: ${pattern.originalValue} cents should be ${pattern.correctedValue} cents`,
            pattern: pattern.originalValue,
            suggestedFix: `Check decimal/currency parsing logic`,
            affectedCount: pattern.occurrences,
            confidence: 0.9,
          });
          break;

        case 'duplicate_flag':
          suggestions.push({
            type: 'duplicate_detection',
            priority,
            description: `Duplicate transactions not detected`,
            pattern: 'duplicate_detection',
            suggestedFix: `Improve duplicate detection algorithm`,
            affectedCount: pattern.occurrences,
            confidence: 0.7,
          });
          break;
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return suggestions;
  }

  /**
   * Calculate priority based on pattern metrics.
   */
  private calculatePriority(pattern: FeedbackPattern): 'high' | 'medium' | 'low' {
    // High priority: many occurrences OR low AI confidence
    if (
      pattern.occurrences >= 10 ||
      (pattern.avgConfidence !== null && pattern.avgConfidence < 0.5)
    ) {
      return 'high';
    }

    // Medium priority: moderate occurrences
    if (pattern.occurrences >= 5) {
      return 'medium';
    }

    return 'low';
  }

  // ------------------------------------------------------------------------
  // STATISTICS & REPORTING
  // ------------------------------------------------------------------------

  /**
   * Get feedback statistics for reporting.
   */
  async getFeedbackStats(userId?: string): Promise<FeedbackStats> {
    const conditions = userId ? [eq(parserFeedback.userId, userId)] : [];

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(parserFeedback)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .get();

    const total = totalResult?.count || 0;

    // Get counts by status
    const statusCounts: Record<FeedbackStatus, number> = {
      pending: 0,
      reviewed: 0,
      applied: 0,
      rejected: 0,
    };

    for (const status of Object.keys(statusCounts) as FeedbackStatus[]) {
      const result = await db
        .select({ count: count() })
        .from(parserFeedback)
        .where(and(...conditions, eq(parserFeedback.status, status)))
        .get();
      statusCounts[status] = result?.count || 0;
    }

    // Get counts by type
    const typeCounts: Record<FeedbackType, number> = {
      category_correction: 0,
      amount_correction: 0,
      date_correction: 0,
      description_correction: 0,
      duplicate_flag: 0,
      split_request: 0,
    };

    for (const feedbackType of Object.keys(typeCounts) as FeedbackType[]) {
      const result = await db
        .select({ count: count() })
        .from(parserFeedback)
        .where(and(...conditions, eq(parserFeedback.feedbackType, feedbackType)))
        .get();
      typeCounts[feedbackType] = result?.count || 0;
    }

    // Get applied today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const appliedTodayResult = await db
      .select({ count: count() })
      .from(parserFeedback)
      .where(
        and(
          ...conditions,
          eq(parserFeedback.status, 'applied'),
          gte(parserFeedback.reviewedAt, todayStart.toISOString()),
        ),
      )
      .get();

    // Get top corrections
    const patterns = await this.analyzeFeedbackPatterns({ minOccurrences: 2 });
    const topCorrections = patterns.slice(0, 5).map((p) => ({
      feedbackType: p.feedbackType,
      originalValue: p.originalValue,
      correctedValue: p.correctedValue,
      count: p.occurrences,
    }));

    return {
      total,
      byStatus: statusCounts,
      byType: typeCounts,
      appliedToday: appliedTodayResult?.count || 0,
      pendingReview: statusCounts.pending,
      topCorrections,
    };
  }

  // ------------------------------------------------------------------------
  // BATCH OPERATIONS
  // ------------------------------------------------------------------------

  /**
   * Bulk review feedback items.
   */
  async bulkReviewFeedback(
    feedbackIds: string[],
    status: FeedbackStatus,
    reviewNotes?: string,
  ): Promise<number> {
    if (feedbackIds.length === 0) return 0;

    await db
      .update(parserFeedback)
      .set({
        status,
        reviewedAt: new Date().toISOString(),
        reviewNotes: reviewNotes || null,
      })
      .where(inArray(parserFeedback.id, feedbackIds));

    logger.info(
      `[FeedbackManager] Bulk reviewed ${feedbackIds.length} feedback items as ${status}`,
    );

    return feedbackIds.length;
  }

  /**
   * Auto-apply high-confidence feedback patterns.
   * Useful for scheduled jobs to keep merchant memory up to date.
   */
  async autoApplyHighConfidenceFeedback(
    minOccurrences: number = 3,
    dryRun: boolean = false,
  ): Promise<{
    patternsFound: number;
    applied: number;
    merchantsUpdated: number;
    merchantsCreated: number;
  }> {
    logger.info(`[FeedbackManager] Auto-applying high-confidence feedback (dryRun: ${dryRun})`);

    const patterns = await this.findConsistentCategoryCorrections(undefined, minOccurrences);

    if (dryRun) {
      return {
        patternsFound: patterns.length,
        applied: 0,
        merchantsUpdated: 0,
        merchantsCreated: 0,
      };
    }

    // Apply to all users who have this feedback
    let totalUpdated = 0;
    let totalCreated = 0;

    // Get unique user IDs from feedback
    const feedbackIds = patterns.flatMap((p) => p.feedbackIds);
    if (feedbackIds.length === 0) {
      return {
        patternsFound: patterns.length,
        applied: 0,
        merchantsUpdated: 0,
        merchantsCreated: 0,
      };
    }

    const feedback = await db
      .select()
      .from(parserFeedback)
      .where(inArray(parserFeedback.id, feedbackIds))
      .all();

    const userIds = [...new Set(feedback.map((f: Record<string, unknown>) => f.userId as string))];

    for (const userId of userIds) {
      const result = await this.applyFeedbackToMerchantMemory(userId as string, minOccurrences);
      totalUpdated += result.updated;
      totalCreated += result.created;
    }

    return {
      patternsFound: patterns.length,
      applied: feedbackIds.length,
      merchantsUpdated: totalUpdated,
      merchantsCreated: totalCreated,
    };
  }
}

// Export singleton instance
export const feedbackManager = new FeedbackManager();
