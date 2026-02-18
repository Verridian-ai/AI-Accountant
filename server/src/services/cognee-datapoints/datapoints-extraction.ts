/**
 * Cognee DataPoints — Extraction activation and stats
 */

import { db, datapointConfigs, cogneeFeedback } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { cogneeClient } from '../cognee_client.js';
import { logger } from '../../lib/logger.js';
import type { ExtractionStats } from './types.js';
import { buildExtractionPrompt } from './datapoints-helpers.js';

export async function activateExtraction(datapointId: string, userId?: string): Promise<void> {
  const config = await db
    .select()
    .from(datapointConfigs)
    .where(eq(datapointConfigs.id, datapointId))
    .get();
  if (!config) throw new Error(`DataPoint config not found: ${datapointId}`);

  const now = new Date().toISOString();
  await db
    .update(datapointConfigs)
    .set({
      isActive: true,
      lastExtractionAt: now,
      extractionCount: (config.extractionCount ?? 0) + 1,
      updatedAt: now,
    })
    .where(eq(datapointConfigs.id, datapointId))
    .run();

  const prompt =
    config.extractionPrompt ??
    buildExtractionPrompt(config.datapointType, JSON.parse(config.schemaDefinition).fields);
  await cogneeClient
    .cognify([config.datasetName], true, prompt, userId)
    .catch((err) => logger.warn('[DataPointService] Cognify trigger failed:', err));
}

export async function getExtractionStats(
  datapointId: string,
  userId?: string,
): Promise<ExtractionStats> {
  const config = await db
    .select()
    .from(datapointConfigs)
    .where(eq(datapointConfigs.id, datapointId))
    .get();
  if (!config) throw new Error(`DataPoint config not found: ${datapointId}`);

  const feedbackRows = await db
    .select()
    .from(cogneeFeedback)
    .where(eq(cogneeFeedback.datapointConfigId, datapointId))
    .all();

  let sampleEntities: Record<string, unknown>[] = [];
  try {
    const results = await cogneeClient.searchRich(
      `${config.name} entities`,
      config.datasetName,
      3,
      'CHUNKS',
      userId,
    );
    sampleEntities = results.map((r) => ({ text: r.text, score: r.score, ...r.metadata }));
  } catch {
    /* Cognee may be unavailable */
  }

  return {
    totalExtractions: config.extractionCount ?? 0,
    lastExtractionAt: config.lastExtractionAt ?? null,
    accuracyScore: config.accuracyScore ?? null,
    feedbackCount: feedbackRows.length,
    sampleEntities,
  };
}
