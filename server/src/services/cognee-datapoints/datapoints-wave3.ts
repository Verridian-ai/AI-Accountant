/**
 * Cognee DataPoints — Wave 3 upsert & bulk registration
 */

import { db, datapointConfigs } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import type { CogneeDataPointService } from './service.js';

export async function createOrUpdateDataPoint(config: {
  userId: string;
  name: string;
  description: string;
  fields: string;
  targetDataset: string;
}): Promise<void> {
  const existing = await db
    .select()
    .from(datapointConfigs)
    .where(and(eq(datapointConfigs.userId, config.userId), eq(datapointConfigs.name, config.name)))
    .get();

  if (existing) {
    await db
      .update(datapointConfigs)
      .set({
        description: config.description,
        schemaDefinition: config.fields,
        datasetName: config.targetDataset,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(datapointConfigs.id, existing.id))
      .run();
  } else {
    await db
      .insert(datapointConfigs)
      .values({
        id: crypto.randomUUID(),
        userId: config.userId,
        name: config.name,
        description: config.description,
        datapointType: 'custom',
        schemaDefinition: config.fields,
        extractionPrompt: null,
        datasetName: config.targetDataset,
        isActive: true,
        isPredefined: false,
        extractionCount: 0,
        lastExtractionAt: null,
        accuracyScore: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();
  }
}

export async function registerWave3DataPoints(
  service: CogneeDataPointService,
  userId: string,
  datasetPrefix: string,
): Promise<number> {
  const { ALL_DATAPOINT_MODELS, registerAllDataPoints } =
    await import('../cognee/datapoint-models.js');
  await registerAllDataPoints(service, userId, datasetPrefix);
  return ALL_DATAPOINT_MODELS.length;
}
