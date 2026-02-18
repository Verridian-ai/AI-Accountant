/**
 * Cognee DataPoints — CRUD operations
 */

import { db, datapointConfigs } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';
import type { DataPointDefinition, DataPointFilters } from './types.js';
import {
  validateSchema,
  sendToCognee,
  buildExtractionPrompt,
  ensurePredefinedExist,
} from './datapoints-helpers.js';

export async function defineDataPoint(
  userId: string,
  config: DataPointDefinition,
): Promise<Record<string, unknown>> {
  validateSchema(config.schemaDefinition);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const extractionPrompt =
    config.extractionPrompt ??
    buildExtractionPrompt(config.datapointType, config.schemaDefinition.fields);

  await db
    .insert(datapointConfigs)
    .values({
      id,
      userId,
      name: config.name,
      description: config.description ?? null,
      datapointType: config.datapointType,
      schemaDefinition: JSON.stringify(config.schemaDefinition),
      extractionPrompt,
      datasetName: config.datasetName,
      isActive: true,
      isPredefined: false,
      extractionCount: 0,
      lastExtractionAt: null,
      accuracyScore: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  await sendToCognee(config.datasetName, config.schemaDefinition, userId).catch((err) =>
    logger.warn('[DataPointService] Failed to send schema to Cognee:', err),
  );

  return {
    id,
    userId,
    ...config,
    extractionPrompt,
    isActive: true,
    isPredefined: false,
    extractionCount: 0,
    lastExtractionAt: null,
    accuracyScore: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listDataPoints(
  userId: string,
  filters?: DataPointFilters,
): Promise<Record<string, unknown>[]> {
  await ensurePredefinedExist(userId);

  const rows = await db
    .select()
    .from(datapointConfigs)
    .where(
      and(
        eq(datapointConfigs.userId, userId),
        filters?.datapointType
          ? eq(datapointConfigs.datapointType, filters.datapointType)
          : undefined,
        filters?.isActive !== undefined
          ? eq(datapointConfigs.isActive, filters.isActive)
          : undefined,
        filters?.isPredefined !== undefined
          ? eq(datapointConfigs.isPredefined, filters.isPredefined)
          : undefined,
        filters?.datasetName ? eq(datapointConfigs.datasetName, filters.datasetName) : undefined,
      ),
    )
    .all();

  type Row = { schemaDefinition: string; name: string; [key: string]: unknown };
  return (rows as Row[])
    .map((row) => ({ ...row, schemaDefinition: JSON.parse(row.schemaDefinition) }))
    .sort((a: Row, b: Row) => a.name.localeCompare(b.name));
}

export async function getDataPoint(datapointId: string): Promise<Record<string, unknown> | null> {
  const row = await db
    .select()
    .from(datapointConfigs)
    .where(eq(datapointConfigs.id, datapointId))
    .get();
  if (!row) return null;
  return { ...row, schemaDefinition: JSON.parse(row.schemaDefinition) };
}

export async function updateDataPoint(
  datapointId: string,
  updates: Partial<
    Pick<
      DataPointDefinition,
      'description' | 'schemaDefinition' | 'extractionPrompt' | 'datasetName'
    >
  > & { name?: string; datapointType?: string },
  userId?: string,
): Promise<Record<string, unknown> | null> {
  const existing = await db
    .select()
    .from(datapointConfigs)
    .where(eq(datapointConfigs.id, datapointId))
    .get();
  if (!existing) return null;

  if (existing.isPredefined) {
    if (updates.name && updates.name !== existing.name)
      throw new Error('Cannot change the name of a predefined DataPoint');
    if (updates.datapointType && updates.datapointType !== existing.datapointType)
      throw new Error('Cannot change the type of a predefined DataPoint');
  }

  if (updates.schemaDefinition) validateSchema(updates.schemaDefinition);

  const setValues: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (updates.name !== undefined) setValues.name = updates.name;
  if (updates.description !== undefined) setValues.description = updates.description;
  if (updates.extractionPrompt !== undefined) setValues.extractionPrompt = updates.extractionPrompt;
  if (updates.datasetName !== undefined) setValues.datasetName = updates.datasetName;
  if (updates.schemaDefinition !== undefined)
    setValues.schemaDefinition = JSON.stringify(updates.schemaDefinition);

  await db
    .update(datapointConfigs)
    .set(setValues)
    .where(eq(datapointConfigs.id, datapointId))
    .run();

  if (updates.schemaDefinition) {
    const dsName = updates.datasetName ?? existing.datasetName;
    await sendToCognee(dsName, updates.schemaDefinition, userId).catch((err) =>
      logger.warn('[DataPointService] Re-send schema to Cognee failed:', err),
    );
  }
  return getDataPoint(datapointId);
}

export async function deactivateDataPoint(datapointId: string): Promise<void> {
  const existing = await db
    .select()
    .from(datapointConfigs)
    .where(eq(datapointConfigs.id, datapointId))
    .get();
  if (!existing) throw new Error(`DataPoint config not found: ${datapointId}`);
  if (existing.isPredefined) throw new Error('Cannot deactivate a predefined DataPoint');
  await db
    .update(datapointConfigs)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(eq(datapointConfigs.id, datapointId))
    .run();
}

export async function deleteDataPoint(datapointId: string): Promise<void> {
  const existing = await db
    .select()
    .from(datapointConfigs)
    .where(eq(datapointConfigs.id, datapointId))
    .get();
  if (!existing) throw new Error(`DataPoint config not found: ${datapointId}`);
  if (existing.isPredefined) throw new Error('Cannot delete a predefined DataPoint');
  await db.delete(datapointConfigs).where(eq(datapointConfigs.id, datapointId)).run();
}
