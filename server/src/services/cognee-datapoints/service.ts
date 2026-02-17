/** Cognee DataPoint Management Service — CRUD for DataPoint configs. */

import { db, datapointConfigs, cogneeFeedback } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { cogneeClient } from '../cognee_client.js';
import { logger } from '../../lib/logger.js';
import type { DataPointDefinition, DataPointFilters, ExtractionStats } from './types.js';
import { PREDEFINED_DATAPOINTS, type PredefinedName } from './constants.js';

export class CogneeDataPointService {
  async defineDataPoint(
    userId: string,
    config: DataPointDefinition,
  ): Promise<Record<string, unknown>> {
    this._validateSchema(config.schemaDefinition);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const extractionPrompt =
      config.extractionPrompt ??
      this._buildExtractionPrompt(config.datapointType, config.schemaDefinition.fields);

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

    await this._sendToCognee(config.datasetName, config.schemaDefinition, userId).catch((err) =>
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

  async activateExtraction(datapointId: string, userId?: string): Promise<void> {
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
      this._buildExtractionPrompt(config.datapointType, JSON.parse(config.schemaDefinition).fields);
    await cogneeClient
      .cognify([config.datasetName], true, prompt, userId)
      .catch((err) => logger.warn('[DataPointService] Cognify trigger failed:', err));
  }

  async listDataPoints(
    userId: string,
    filters?: DataPointFilters,
  ): Promise<Record<string, unknown>[]> {
    await this._ensurePredefinedExist(userId);

    const conditions: any[] = [eq(datapointConfigs.userId, userId)];
    if (filters?.datapointType)
      conditions.push(eq(datapointConfigs.datapointType, filters.datapointType));
    if (filters?.isActive !== undefined)
      conditions.push(eq(datapointConfigs.isActive, filters.isActive));
    if (filters?.isPredefined !== undefined)
      conditions.push(eq(datapointConfigs.isPredefined, filters.isPredefined));
    if (filters?.datasetName)
      conditions.push(eq(datapointConfigs.datasetName, filters.datasetName));

    const rows = await db
      .select()
      .from(datapointConfigs)
      .where(and(...conditions))
      .all();
    return rows
      .map((row: any) => ({ ...row, schemaDefinition: JSON.parse(row.schemaDefinition) }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }

  async getDataPoint(datapointId: string): Promise<Record<string, unknown> | null> {
    const row = await db
      .select()
      .from(datapointConfigs)
      .where(eq(datapointConfigs.id, datapointId))
      .get();
    if (!row) return null;
    return { ...(row as any), schemaDefinition: JSON.parse((row as any).schemaDefinition) };
  }

  async updateDataPoint(
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
    const existingRow = existing as any;

    if (existingRow.isPredefined) {
      if (updates.name && updates.name !== existingRow.name)
        throw new Error('Cannot change the name of a predefined DataPoint');
      if (updates.datapointType && updates.datapointType !== existingRow.datapointType)
        throw new Error('Cannot change the type of a predefined DataPoint');
    }

    if (updates.schemaDefinition) this._validateSchema(updates.schemaDefinition);

    const setValues: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (updates.name !== undefined) setValues.name = updates.name;
    if (updates.description !== undefined) setValues.description = updates.description;
    if (updates.extractionPrompt !== undefined)
      setValues.extractionPrompt = updates.extractionPrompt;
    if (updates.datasetName !== undefined) setValues.datasetName = updates.datasetName;
    if (updates.schemaDefinition !== undefined)
      setValues.schemaDefinition = JSON.stringify(updates.schemaDefinition);

    await db
      .update(datapointConfigs)
      .set(setValues)
      .where(eq(datapointConfigs.id, datapointId))
      .run();

    if (updates.schemaDefinition) {
      const dsName = updates.datasetName ?? existingRow.datasetName;
      await this._sendToCognee(dsName, updates.schemaDefinition, userId).catch((err) =>
        logger.warn('[DataPointService] Re-send schema to Cognee failed:', err),
      );
    }
    return this.getDataPoint(datapointId);
  }

  async deactivateDataPoint(datapointId: string): Promise<void> {
    const existing = await db
      .select()
      .from(datapointConfigs)
      .where(eq(datapointConfigs.id, datapointId))
      .get();
    if (!existing) throw new Error(`DataPoint config not found: ${datapointId}`);
    if ((existing as any).isPredefined) throw new Error('Cannot deactivate a predefined DataPoint');
    await db
      .update(datapointConfigs)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(datapointConfigs.id, datapointId))
      .run();
  }

  async deleteDataPoint(datapointId: string): Promise<void> {
    const existing = await db
      .select()
      .from(datapointConfigs)
      .where(eq(datapointConfigs.id, datapointId))
      .get();
    if (!existing) throw new Error(`DataPoint config not found: ${datapointId}`);
    if ((existing as any).isPredefined) throw new Error('Cannot delete a predefined DataPoint');
    await db.delete(datapointConfigs).where(eq(datapointConfigs.id, datapointId)).run();
  }

  async getExtractionStats(datapointId: string, userId?: string): Promise<ExtractionStats> {
    const config = await db
      .select()
      .from(datapointConfigs)
      .where(eq(datapointConfigs.id, datapointId))
      .get();
    if (!config) throw new Error(`DataPoint config not found: ${datapointId}`);
    const configRow = config as any;

    const feedbackRows = await db
      .select()
      .from(cogneeFeedback)
      .where(eq(cogneeFeedback.datapointConfigId, datapointId))
      .all();

    let sampleEntities: Record<string, unknown>[] = [];
    try {
      const results = await cogneeClient.searchRich(
        `${configRow.name} entities`,
        configRow.datasetName,
        3,
        'CHUNKS',
        userId,
      );
      sampleEntities = results.map((r) => ({ text: r.text, score: r.score, ...r.metadata }));
    } catch {
      /* Cognee may be unavailable */
    }

    return {
      totalExtractions: configRow.extractionCount ?? 0,
      lastExtractionAt: configRow.lastExtractionAt ?? null,
      accuracyScore: configRow.accuracyScore ?? null,
      feedbackCount: feedbackRows.length,
      sampleEntities,
    };
  }

  getPredefinedDataPoints(): Array<{
    name: PredefinedName;
    datapointType: PredefinedName;
    schemaDefinition: (typeof PREDEFINED_DATAPOINTS)[PredefinedName];
  }> {
    return (Object.keys(PREDEFINED_DATAPOINTS) as PredefinedName[]).map((key) => ({
      name: key,
      datapointType: key,
      schemaDefinition: PREDEFINED_DATAPOINTS[key],
    }));
  }

  // --- Wave 3: Upsert & Bulk Registration ---

  async createOrUpdateDataPoint(config: {
    userId: string;
    name: string;
    description: string;
    fields: string;
    targetDataset: string;
  }): Promise<void> {
    const existing = await db
      .select()
      .from(datapointConfigs)
      .where(
        and(eq(datapointConfigs.userId, config.userId), eq(datapointConfigs.name, config.name)),
      )
      .get();

    if (existing) {
      const existingRow = existing as any;
      await db
        .update(datapointConfigs)
        .set({
          description: config.description,
          schemaDefinition: config.fields,
          datasetName: config.targetDataset,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(datapointConfigs.id, existingRow.id))
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

  async registerWave3DataPoints(userId: string, datasetPrefix: string): Promise<number> {
    const { ALL_DATAPOINT_MODELS, registerAllDataPoints } =
      await import('../cognee/datapoint-models.js');
    await registerAllDataPoints(this, userId, datasetPrefix);
    return ALL_DATAPOINT_MODELS.length;
  }

  // --- Private helpers ---

  private _validateSchema(schema: { fields: Array<{ name: string; type: string }> }): void {
    if (!schema || !Array.isArray(schema.fields))
      throw new Error('Schema must have a "fields" array');
    if (schema.fields.length === 0) throw new Error('Schema must have at least one field');
    for (const field of schema.fields) {
      if (!field.name || typeof field.name !== 'string')
        throw new Error(`Each field must have a "name" string, got: ${JSON.stringify(field)}`);
      if (!field.type || typeof field.type !== 'string')
        throw new Error(`Each field must have a "type" string, got: ${JSON.stringify(field)}`);
    }
  }

  private async _sendToCognee(
    datasetName: string,
    schema: { fields: Array<{ name: string; type: string; required?: boolean }> },
    userId?: string,
  ): Promise<void> {
    const schemaText =
      `DataPoint Schema for ${datasetName}:\n` +
      schema.fields
        .map((f) => `  - ${f.name} (${f.type})${f.required ? ' [required]' : ''}`)
        .join('\n');
    await cogneeClient.add([schemaText], datasetName, userId);
  }

  private _buildExtractionPrompt(
    datapointType: string,
    fields: ReadonlyArray<{ name: string; type: string; required?: boolean }>,
  ): string {
    const requiredFields = fields.filter((f) => f.required).map((f) => f.name);
    const optionalFields = fields.filter((f) => !f.required).map((f) => f.name);
    let prompt = `Extract ${datapointType} entities from the data. `;
    if (requiredFields.length > 0) prompt += `Required fields: ${requiredFields.join(', ')}. `;
    if (optionalFields.length > 0) prompt += `Optional fields: ${optionalFields.join(', ')}. `;
    prompt += 'Return structured entities with the specified fields.';
    return prompt;
  }

  private async _ensurePredefinedExist(userId: string): Promise<void> {
    const existing = await db
      .select()
      .from(datapointConfigs)
      .where(and(eq(datapointConfigs.userId, userId), eq(datapointConfigs.isPredefined, true)))
      .all();

    const existingNames = new Set((existing as any[]).map((r) => r.name));
    const datasetMap: Record<PredefinedName, string> = {
      FinancialTransaction: 'bank_transactions',
      BusinessRelationship: 'merchant_mappings',
      TaxEvent: 'gst_rules',
    };

    for (const key of Object.keys(PREDEFINED_DATAPOINTS) as PredefinedName[]) {
      if (existingNames.has(key)) continue;
      const schema = PREDEFINED_DATAPOINTS[key];
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db
        .insert(datapointConfigs)
        .values({
          id,
          userId,
          name: key,
          description: `Predefined ${key} DataPoint for structured extraction`,
          datapointType: key,
          schemaDefinition: JSON.stringify(schema),
          extractionPrompt: this._buildExtractionPrompt(key, schema.fields),
          datasetName: datasetMap[key],
          isActive: true,
          isPredefined: true,
          extractionCount: 0,
          lastExtractionAt: null,
          accuracyScore: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }
}

/** Singleton instance */
export const cogneeDataPointService = new CogneeDataPointService();
