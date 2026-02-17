/**
 * Feedback Analysis -- Stats, bulk ops, auto-apply (prototype augmentation)
 *
 * Pattern analysis and suggestions delegated to feedback-patterns.ts.
 */

import { db, parserFeedback } from '../../schema.js';
import { eq, and, count, inArray, gte } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';
import type {
  FeedbackType,
  FeedbackStatus,
  FeedbackPattern,
  FeedbackStats,
  ParserImprovementSuggestion,
} from './types.js';
import { FeedbackManager } from './feedback-manager.js';
import {
  analyzeFeedbackPatterns as analyzeFeedbackPatternsFn,
  generateParserImprovementSuggestions as generateSuggestionsFn,
} from './feedback-patterns.js';

// -- Pattern Analysis (delegates to feedback-patterns.ts) --

FeedbackManager.prototype.analyzeFeedbackPatterns = async function (
  this: FeedbackManager,
  options?: { startDate?: string; endDate?: string; minOccurrences?: number },
): Promise<FeedbackPattern[]> {
  return analyzeFeedbackPatternsFn(options);
};

FeedbackManager.prototype.generateParserImprovementSuggestions = async function (
  this: FeedbackManager,
): Promise<ParserImprovementSuggestion[]> {
  return generateSuggestionsFn();
};

// -- Feedback Stats --

FeedbackManager.prototype.getFeedbackStats = async function (
  this: FeedbackManager,
  userId?: string,
): Promise<FeedbackStats> {
  const conditions = userId ? [eq(parserFeedback.userId, userId)] : [];

  const totalResult = await db
    .select({ count: count() })
    .from(parserFeedback)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .get();
  const total = totalResult?.count || 0;

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

  const patterns = await this.analyzeFeedbackPatterns({ minOccurrences: 2 });
  const topCorrections = patterns.slice(0, 5).map((p: FeedbackPattern) => ({
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
};

// -- Bulk Review --

FeedbackManager.prototype.bulkReviewFeedback = async function (
  this: FeedbackManager,
  feedbackIds: string[],
  status: FeedbackStatus,
  reviewNotes?: string,
): Promise<number> {
  if (feedbackIds.length === 0) return 0;
  await db
    .update(parserFeedback)
    .set({ status, reviewedAt: new Date().toISOString(), reviewNotes: reviewNotes || null })
    .where(inArray(parserFeedback.id, feedbackIds));
  logger.info(`[FeedbackManager] Bulk reviewed ${feedbackIds.length} feedback items as ${status}`);
  return feedbackIds.length;
};

// -- Auto-Apply High Confidence --

FeedbackManager.prototype.autoApplyHighConfidenceFeedback = async function (
  this: FeedbackManager,
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
  if (dryRun)
    return { patternsFound: patterns.length, applied: 0, merchantsUpdated: 0, merchantsCreated: 0 };

  let totalUpdated = 0;
  let totalCreated = 0;
  const feedbackIds = patterns.flatMap((p) => p.feedbackIds);
  if (feedbackIds.length === 0)
    return { patternsFound: patterns.length, applied: 0, merchantsUpdated: 0, merchantsCreated: 0 };

  const feedback = await db
    .select()
    .from(parserFeedback)
    .where(inArray(parserFeedback.id, feedbackIds))
    .all();
  const userIds = [...new Set(feedback.map((f: any) => f.userId as string))];

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
};

// -- Type augmentation for prototype methods --

declare module './feedback-manager.js' {
  interface FeedbackManager {
    analyzeFeedbackPatterns(options?: {
      startDate?: string;
      endDate?: string;
      minOccurrences?: number;
    }): Promise<FeedbackPattern[]>;
    generateParserImprovementSuggestions(): Promise<ParserImprovementSuggestion[]>;
    getFeedbackStats(userId?: string): Promise<FeedbackStats>;
    bulkReviewFeedback(
      feedbackIds: string[],
      status: FeedbackStatus,
      reviewNotes?: string,
    ): Promise<number>;
    autoApplyHighConfidenceFeedback(
      minOccurrences?: number,
      dryRun?: boolean,
    ): Promise<{
      patternsFound: number;
      applied: number;
      merchantsUpdated: number;
      merchantsCreated: number;
    }>;
  }
}
