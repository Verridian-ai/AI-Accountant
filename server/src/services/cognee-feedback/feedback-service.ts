/**
 * Cognee Feedback Service
 *
 * Manages user feedback on Cognee search results, datapoint extractions,
 * and graph nodes. Tracks accuracy, persists corrections, and triggers
 * memify (memory consolidation) when sufficient feedback accumulates.
 */

import { randomUUID } from 'crypto';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db, cogneeFeedback } from '../../schema.js';
import { cogneeClient } from '../cognee_client.js';
import type {
  FeedbackSubmission,
  FeedbackFilters,
  FeedbackStats,
  DataPointAccuracy,
} from './types.js';
import {
  triggerMemify as _triggerMemify,
  autoTriggerMemify as _autoTriggerMemify,
} from './memify.js';
import type { MemifyResult, MemifyOptions } from './types.js';
import { calculateTrend } from './helpers.js';

// ============================================================================
// Service
// ============================================================================

export class CogneeFeedbackService {
  /**
   * Submit feedback on a Cognee entity (search result, datapoint, graph node, etc.).
   * Persists to the cogneeFeedback table and forwards to Cognee API.
   */
  async submitFeedback(userId: string, feedback: FeedbackSubmission): Promise<any> {
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
    const conditions: SQL[] = [eq(cogneeFeedback.userId, userId)];
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

    const allFeedback = await db
      .select()
      .from(cogneeFeedback)
      .where(and(...conditions))
      .orderBy(desc(cogneeFeedback.createdAt))
      .all();

    const total = allFeedback.length;

    const byType: Record<string, number> = {};
    const byEntityType: Record<string, number> = {};
    const fieldCounts: Record<string, number> = {};

    for (const fb of allFeedback) {
      byType[fb.feedbackType] = (byType[fb.feedbackType] || 0) + 1;
      byEntityType[fb.entityType] = (byEntityType[fb.entityType] || 0) + 1;

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

    const correctCount = byType['correct'] || 0;
    const partialCount = byType['partial'] || 0;
    const accuracyRate = total > 0 ? (correctCount + partialCount * 0.5) / total : 0;

    const midpoint = Math.floor(total / 2);
    const trend = calculateTrend(allFeedback, midpoint);

    const topCorrectedFields = Object.entries(fieldCounts)
      .map(([field, correctionCount]) => ({ field, correctionCount }))
      .sort((a, b) => b.correctionCount - a.correctionCount)
      .slice(0, 10);

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
   */
  async triggerMemify(userId: string, options?: MemifyOptions): Promise<MemifyResult> {
    return _triggerMemify(this, userId, options);
  }

  /**
   * Paginated list of feedback records for a user.
   */
  async listFeedback(
    userId: string,
    filters?: FeedbackFilters,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ items: Record<string, unknown>[]; total: number; page: number; pageSize: number }> {
    const conditions: SQL[] = [eq(cogneeFeedback.userId, userId)];
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
  async getFeedbackById(feedbackId: string): Promise<any | null> {
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
    const trend = calculateTrend(feedbackItems, midpoint);

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
   */
  async autoTriggerMemify(userId: string): Promise<MemifyResult | null> {
    return _autoTriggerMemify(this, userId);
  }
}

export const cogneeFeedbackService = new CogneeFeedbackService();
