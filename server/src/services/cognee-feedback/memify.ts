/**
 * Cognee Feedback — Memify (memory consolidation) logic.
 */

import { eq, and, sql } from 'drizzle-orm';
import { db, cogneeFeedback, datapointConfigs } from '../../schema.js';
import { cogneeClient } from '../cognee_client.js';
import type { MemifyOptions, MemifyResult } from './types.js';
import type { CogneeFeedbackService } from './feedback-service.js';

const DEFAULT_AUTO_MEMIFY_THRESHOLD = 10;

/**
 * Trigger memify (memory consolidation) for unapplied feedback.
 * Groups feedback by dataset, sends to Cognee, and marks as applied.
 */
export async function triggerMemify(
  service: CogneeFeedbackService,
  userId: string,
  options?: MemifyOptions,
): Promise<MemifyResult> {
  // Get unapplied feedback
  const unapplied = await db
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
  const datasetGroups: Record<string, any[]> = {};
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
    const feedbackData = datasetGroups[dataset].map((fb: any) => ({
      entity_id: fb.entityId,
      feedback_type: fb.feedbackType,
      original_value: fb.originalValue,
      corrected_value: fb.correctedValue,
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
    .filter((fb: any) => {
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
    .map((fb: any) => fb.id);

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
      .filter((fb: any) => fb.datapointConfigId)
      .map((fb: any) => fb.datapointConfigId as string),
  );

  for (const configId of configIds) {
    const cid = configId as string;
    const accuracy = await service.getDataPointAccuracy(cid);
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
 * Auto-trigger memify when unapplied feedback exceeds threshold.
 * Returns null if under threshold.
 */
export async function autoTriggerMemify(
  service: CogneeFeedbackService,
  userId: string,
): Promise<MemifyResult | null> {
  const unappliedCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(cogneeFeedback)
    .where(and(eq(cogneeFeedback.userId, userId), eq(cogneeFeedback.appliedToMemify, false)))
    .get();

  const total = (unappliedCount as any)?.count ?? 0;

  if (total < DEFAULT_AUTO_MEMIFY_THRESHOLD) {
    return null;
  }

  return triggerMemify(service, userId, { forceRun: true });
}
