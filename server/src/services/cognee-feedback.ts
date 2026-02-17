/**
 * Cognee Feedback Service
 *
 * Manages user feedback on Cognee search results, datapoint extractions,
 * and graph nodes. Tracks accuracy, persists corrections, and triggers
 * memify (memory consolidation) when sufficient feedback accumulates.
 */

import { randomUUID } from 'crypto';
import { eq, and, sql, count, desc, gte, lte, type SQL } from 'drizzle-orm';
import { db, cogneeFeedback, datapointConfigs } from '../schema.js';

type FeedbackRow = typeof cogneeFeedback.$inferSelect;
import { cogneeClient } from './cognee_client.js';

// ============================================================================
// Types
// ============================================================================

export interface FeedbackSubmission {
  entityType: 'datapoint' | 'search_result' | 'graph_node' | 'extraction';
  entityId: string;
  feedbackType: 'correct' | 'incorrect' | 'partial' | 'irrelevant' | 'missing';
  originalValue?: string;
  correctedValue?: string;
  context?: { query?: string; dataset?: string; searchType?: string };
  datapointConfigId?: string;
}

export interface FeedbackFilters {
  entityType?: string;
  feedbackType?: string;
  datapointConfigId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface FeedbackStats {
  total: number;
  byType: Record<string, number>;
  byEntityType: Record<string, number>;
  accuracyRate: number;
  trend: 'improving' | 'declining' | 'stable';
  topCorrectedFields: Array<{ field: string; correctionCount: number }>;
  recentFeedback: FeedbackRow[];
}

export interface MemifyOptions {
  datasetNames?: string[];
  minFeedbackCount?: number;
  forceRun?: boolean;
}

export interface MemifyResult {
  processed: number;
  datasets: string[];
  newAccuracyScores: Record<string, number>;
  status: 'triggered' | 'skipped' | 'insufficient_feedback';
}

export interface DataPointAccuracy {
  datapointConfigId: string;
  totalFeedback: number;
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
  accuracyScore: number;
  trend: 'improving' | 'declining' | 'stable';
  lastUpdated: string;
}

// ============================================================================
// Service
// ============================================================================

const DEFAULT_AUTO_MEMIFY_THRESHOLD = 10;

export class CogneeFeedbackService {
  /**
   * Submit feedback on a Cognee entity (search result, datapoint, graph node, etc.).
   * Persists to the cogneeFeedback table and forwards to Cognee API.
   */
  async submitFeedback(userId: string, feedback: FeedbackSubmission): Promise<Record<string, unknown>> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const record = {
      id,
      userId,
      entityType: feedback.entityType,
      entityId: feedback.entityId,
      feedbackType: feedback.feedbackType,
      originalValue: feedback.originalValue ?? null,
      correctedValue: feedback.correctedValue ?? null,
      context: feedback.context ? JSON.stringify(feedback.context) : null,
      datapointConfigId: feedback.datapointConfigId ?? null,
      appliedToMemify: false,
      createdAt: now,
    };

    await db.insert(cogneeFeedback).values(record).run();

    // Fire-and-forget to Cognee API
    cogneeClient
      .submitFeedback(
        {
          entity_id: feedback.entityId,
          feedback_type: feedback.feedbackType,
          original_value: feedback.originalValue,
          corrected_value: feedback.correctedValue,
          context: feedback.context as Record<string, string> | undefined,
        },
        userId,
      )
      .catch(() => {
        // Cognee API errors are non-fatal; the local record is the source of truth
      });

    return record;
  }

  /**
   * Aggregate feedback statistics for a user.
   * Calculates accuracy rate, trend, and top corrected fields.
   */
  async getFeedbackStats(userId: string, filters?: FeedbackFilters): Promise<FeedbackStats> {
    // Build conditions
    const conditions: (SQL | undefined)[] = [eq(cogneeFeedback.userId, userId)];
    if (filters?.entityType) {
      conditions.push(eq(cogneeFeedback.entityType, filters.entityType));
    }
    if (filters?.feedbackType) {
      conditions.push(eq(cogneeFeedback.feedbackType, filters.feedbackType));
    }
    if (filters?.datapointConfigId) {
      conditions.push(eq(cogneeFeedback.datapointConfigId, filters.datapointConfigId));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(cogneeFeedback.createdAt, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(cogneeFeedback.createdAt, filters.dateTo));
    }

    // Get all matching feedback
    const allFeedback = await db
      .select()
      .from(cogneeFeedback)
      .where(and(...conditions))
      .orderBy(desc(cogneeFeedback.createdAt))
      .all();

    const total = allFeedback.length;

    // Aggregate by type
    const byType: Record<string, number> = {};
    const byEntityType: Record<string, number> = {};
    const fieldCounts: Record<string, number> = {};

    for (const fb of allFeedback) {
      byType[fb.feedbackType] = (byType[fb.feedbackType] || 0) + 1;
      byEntityType[fb.entityType] = (byEntityType[fb.entityType] || 0) + 1;

      // Track corrected fields from context
      if (fb.correctedValue && fb.context) {
        try {
          const ctx = typeof fb.context === 'string' ? JSON.parse(fb.context) : fb.context;
          const field = ctx.searchType || ctx.dataset || fb.entityType;
          fieldCounts[field] = (fieldCounts[field] || 0) + 1;
        } catch {
          fieldCounts[fb.entityType] = (fieldCounts[fb.entityType] || 0) + 1;
        }
      }
    }

    // Accuracy rate: correct / total (treat partial as 0.5 correct)
    const correctCount = byType['correct'] || 0;
    const partialCount = byType['partial'] || 0;
    const accuracyRate = total > 0 ? (correctCount + partialCount * 0.5) / total : 0;

    // Trend: compare recent half vs older half
    const midpoint = Math.floor(total / 2);
    const trend = this.calculateTrend(allFeedback, midpoint);

    // Top corrected fields
    const topCorrectedFields = Object.entries(fieldCounts)
      .map(([field, correctionCount]) => ({ field, correctionCount }))
      .sort((a, b) => b.correctionCount - a.correctionCount)
      .slice(0, 10);

    // Recent feedback (last 10)
    const recentFeedback = allFeedback.slice(0, 10);

    return {
      total,
      byType,
      byEntityType,
      accuracyRate,
      trend,
      topCorrectedFields,
      recentFeedback,
    };
  }

  /**
   * Trigger memify (memory consolidation) for unapplied feedback.
   * Groups feedback by dataset, sends to Cognee, and marks as applied.
   */
  async triggerMemify(userId: string, options?: MemifyOptions): Promise<MemifyResult> {
    // Get unapplied feedback
    const unapplied: FeedbackRow[] = await db
      .select()
      .from(cogneeFeedback)
      .where(and(eq(cogneeFeedback.userId, userId), eq(cogneeFeedback.appliedToMemify, false)))
      .all();

    const minCount = options?.minFeedbackCount ?? DEFAULT_AUTO_MEMIFY_THRESHOLD;

    if (!options?.forceRun && unapplied.length < minCount) {
      return {
        processed: 0,
        datasets: [],
        newAccuracyScores: {},
        status: 'insufficient_feedback',
      };
    }

    if (unapplied.length === 0) {
      return {
        processed: 0,
        datasets: [],
        newAccuracyScores: {},
        status: 'skipped',
      };
    }

    // Group by dataset from context
    const datasetGroups: Record<string, FeedbackRow[]> = {};
    for (const fb of unapplied) {
      let dataset = 'general_feedback';
      if (fb.context) {
        try {
          const ctx = typeof fb.context === 'string' ? JSON.parse(fb.context) : fb.context;
          dataset = ctx.dataset || dataset;
        } catch {
          // keep default
        }
      }
      if (!datasetGroups[dataset]) datasetGroups[dataset] = [];
      datasetGroups[dataset].push(fb);
    }

    // Filter to requested datasets if specified
    let targetDatasets = Object.keys(datasetGroups);
    if (options?.datasetNames && options.datasetNames.length > 0) {
      targetDatasets = targetDatasets.filter((d) => options.datasetNames!.includes(d));
    }

    // Trigger memify for each dataset group
    for (const dataset of targetDatasets) {
      const feedbackData = datasetGroups[dataset].map((fb) => ({
        entity_id: fb.entityId,
        feedback_type: fb.feedbackType,
        original_value: fb.originalValue ?? undefined,
        corrected_value: fb.correctedValue ?? undefined,
      }));

      await cogneeClient.triggerMemify(
        {
          datasets: [dataset],
          feedback_data: feedbackData,
          run_in_background: true,
        },
        userId,
      );
    }

    // Mark all as applied
    const appliedIds = unapplied
      .filter((fb) => {
        let dataset = 'general_feedback';
        if (fb.context) {
          try {
            const ctx = typeof fb.context === 'string' ? JSON.parse(fb.context) : fb.context;
            dataset = ctx.dataset || dataset;
          } catch {
            /* keep default */
          }
        }
        return targetDatasets.includes(dataset);
      })
      .map((fb) => fb.id);

    for (const fbId of appliedIds) {
      await db
        .update(cogneeFeedback)
        .set({ appliedToMemify: true })
        .where(eq(cogneeFeedback.id, fbId))
        .run();
    }

    // Update accuracy scores on related DataPoint configs
    const newAccuracyScores: Record<string, number> = {};
    const configIds = new Set(
      unapplied
        .filter((fb) => fb.datapointConfigId)
        .map((fb) => fb.datapointConfigId as string),
    );

    for (const configId of configIds) {
      const cid = configId as string;
      const accuracy = await this.getDataPointAccuracy(cid);
      newAccuracyScores[cid] = accuracy.accuracyScore;

      await db
        .update(datapointConfigs)
        .set({ accuracyScore: accuracy.accuracyScore, updatedAt: new Date().toISOString() })
        .where(eq(datapointConfigs.id, cid))
        .run();
    }

    return {
      processed: appliedIds.length,
      datasets: targetDatasets,
      newAccuracyScores,
      status: 'triggered',
    };
  }

  /**
   * Paginated list of feedback records for a user.
   */
  async listFeedback(
    userId: string,
    filters?: FeedbackFilters,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ items: FeedbackRow[]; total: number; page: number; pageSize: number }> {
    const conditions: (SQL | undefined)[] = [eq(cogneeFeedback.userId, userId)];
    if (filters?.entityType) {
      conditions.push(eq(cogneeFeedback.entityType, filters.entityType));
    }
    if (filters?.feedbackType) {
      conditions.push(eq(cogneeFeedback.feedbackType, filters.feedbackType));
    }
    if (filters?.datapointConfigId) {
      conditions.push(eq(cogneeFeedback.datapointConfigId, filters.datapointConfigId));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(cogneeFeedback.createdAt, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(cogneeFeedback.createdAt, filters.dateTo));
    }

    const allItems = await db
      .select()
      .from(cogneeFeedback)
      .where(and(...conditions))
      .orderBy(desc(cogneeFeedback.createdAt))
      .all();

    const total = allItems.length;
    const offset = (page - 1) * pageSize;
    const items = allItems.slice(offset, offset + pageSize);

    return { items, total, page, pageSize };
  }

  /**
   * Get a single feedback record by ID.
   */
  async getFeedbackById(feedbackId: string): Promise<FeedbackRow | null> {
    const result = await db
      .select()
      .from(cogneeFeedback)
      .where(eq(cogneeFeedback.id, feedbackId))
      .get();
    return result ?? null;
  }

  /**
   * Delete a feedback record (only if not yet applied to memify).
   */
  async deleteFeedback(feedbackId: string): Promise<{ deleted: boolean; reason?: string }> {
    const record = await this.getFeedbackById(feedbackId);
    if (!record) {
      return { deleted: false, reason: 'Feedback record not found' };
    }
    if (record.appliedToMemify) {
      return { deleted: false, reason: 'Cannot delete feedback already applied to memify' };
    }

    await db.delete(cogneeFeedback).where(eq(cogneeFeedback.id, feedbackId)).run();

    return { deleted: true };
  }

  /**
   * Calculate accuracy metrics for a specific DataPoint configuration.
   */
  async getDataPointAccuracy(datapointConfigId: string): Promise<DataPointAccuracy> {
    const feedbackItems = await db
      .select()
      .from(cogneeFeedback)
      .where(eq(cogneeFeedback.datapointConfigId, datapointConfigId))
      .orderBy(desc(cogneeFeedback.createdAt))
      .all();

    const totalFeedback = feedbackItems.length;
    let correctCount = 0;
    let incorrectCount = 0;
    let partialCount = 0;

    for (const fb of feedbackItems) {
      if (fb.feedbackType === 'correct') correctCount++;
      else if (fb.feedbackType === 'incorrect') incorrectCount++;
      else if (fb.feedbackType === 'partial') partialCount++;
    }

    const accuracyScore =
      totalFeedback > 0 ? (correctCount + partialCount * 0.5) / totalFeedback : 0;

    const midpoint = Math.floor(totalFeedback / 2);
    const trend = this.calculateTrend(feedbackItems, midpoint);

    const lastUpdated =
      feedbackItems.length > 0
        ? feedbackItems[0].createdAt || new Date().toISOString()
        : new Date().toISOString();

    return {
      datapointConfigId,
      totalFeedback,
      correctCount,
      incorrectCount,
      partialCount,
      accuracyScore,
      trend,
      lastUpdated,
    };
  }

  /**
   * Auto-trigger memify when unapplied feedback exceeds threshold.
   * Returns null if under threshold.
   */
  async autoTriggerMemify(userId: string): Promise<MemifyResult | null> {
    const unappliedCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(cogneeFeedback)
      .where(and(eq(cogneeFeedback.userId, userId), eq(cogneeFeedback.appliedToMemify, false)))
      .get();

    const total = unappliedCount?.count ?? 0;

    if (total < DEFAULT_AUTO_MEMIFY_THRESHOLD) {
      return null;
    }

    return this.triggerMemify(userId, { forceRun: true });
  }

  // ---------- Private helpers ----------

  /**
   * Calculate trend by comparing accuracy of the recent half vs older half.
   * Feedback should be sorted newest-first.
   */
  private calculateTrend(
    feedbackItems: FeedbackRow[],
    midpoint: number,
  ): 'improving' | 'declining' | 'stable' {
    if (feedbackItems.length < 4) return 'stable';

    const recentHalf = feedbackItems.slice(0, midpoint);
    const olderHalf = feedbackItems.slice(midpoint);

    const recentAccuracy = this.halfAccuracy(recentHalf);
    const olderAccuracy = this.halfAccuracy(olderHalf);

    const diff = recentAccuracy - olderAccuracy;
    if (diff > 0.05) return 'improving';
    if (diff < -0.05) return 'declining';
    return 'stable';
  }

  private halfAccuracy(items: FeedbackRow[]): number {
    if (items.length === 0) return 0;
    let score = 0;
    for (const fb of items) {
      if (fb.feedbackType === 'correct') score += 1;
      else if (fb.feedbackType === 'partial') score += 0.5;
    }
    return score / items.length;
  }
}

export const cogneeFeedbackService = new CogneeFeedbackService();
