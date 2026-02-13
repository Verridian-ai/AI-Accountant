/**
 * Cognee DataPoint Management Service
 *
 * CRUD operations for DataPoint configs: creation, activation/deactivation,
 * extraction tracking, and predefined schema management.
 *
 * DataPoints define structured extraction schemas that Cognee uses during
 * cognify to pull domain-specific entities from ingested data.
 */

import { db, datapointConfigs, cogneeFeedback } from '../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { cogneeClient } from './cognee_client.js';

// ============================================================================
// Types
// ============================================================================

export interface DataPointDefinition {
  name: string;
  description?: string;
  datapointType:
    | 'FinancialTransaction'
    | 'BusinessRelationship'
    | 'TaxEvent'
    | 'MerchantProfile'
    | 'RecurringPattern'
    | 'ComplianceObligation'
    | 'custom';
  schemaDefinition: {
    fields: Array<{
      name: string;
      type: 'string' | 'number' | 'date' | 'boolean' | 'array';
      required?: boolean;
    }>;
  };
  extractionPrompt?: string;
  datasetName: string;
}

export interface DataPointFilters {
  datapointType?: string;
  isActive?: boolean;
  isPredefined?: boolean;
  datasetName?: string;
}

export interface ExtractionStats {
  totalExtractions: number;
  lastExtractionAt: string | null;
  accuracyScore: number | null;
  feedbackCount: number;
  sampleEntities: Record<string, unknown>[];
}

// ============================================================================
// Predefined DataPoint Schemas
// ============================================================================

const PREDEFINED_DATAPOINTS = {
  FinancialTransaction: {
    fields: [
      { name: 'amount', type: 'number' as const, required: true },
      { name: 'merchant', type: 'string' as const, required: true },
      { name: 'category', type: 'string' as const, required: true },
      { name: 'date', type: 'date' as const, required: true },
      { name: 'gst_amount', type: 'number' as const, required: false },
      { name: 'account_id', type: 'string' as const, required: false },
    ],
  },
  BusinessRelationship: {
    fields: [
      { name: 'entity_a', type: 'string' as const, required: true },
      { name: 'entity_b', type: 'string' as const, required: true },
      { name: 'relationship_type', type: 'string' as const, required: true },
      { name: 'frequency', type: 'number' as const, required: false },
      { name: 'total_value', type: 'number' as const, required: false },
    ],
  },
  TaxEvent: {
    fields: [
      { name: 'event_type', type: 'string' as const, required: true },
      { name: 'amount', type: 'number' as const, required: true },
      { name: 'tax_impact', type: 'number' as const, required: false },
      { name: 'ruling_ref', type: 'string' as const, required: false },
      { name: 'period', type: 'string' as const, required: true },
      { name: 'entity_type', type: 'string' as const, required: false },
    ],
  },
} as const;

type PredefinedName = keyof typeof PREDEFINED_DATAPOINTS;

// ============================================================================
// Service
// ============================================================================

export class CogneeDataPointService {
  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Create a new DataPoint config and persist it.
   * Validates the schema, generates a UUID, stores in DB, and optionally
   * sends the schema to Cognee.
   */
  async defineDataPoint(
    userId: string,
    config: DataPointDefinition
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

    // Best-effort send to Cognee
    await this._sendToCognee(config.datasetName, config.schemaDefinition, userId).catch((err) =>
      console.warn('[DataPointService] Failed to send schema to Cognee:', err)
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

  /**
   * Activate extraction for a DataPoint.
   * Sets is_active=true, triggers cognify on the target dataset with the
   * extraction prompt, and updates last_extraction_at.
   */
  async activateExtraction(datapointId: string, userId?: string): Promise<void> {
    const config = await db
      .select()
      .from(datapointConfigs)
      .where(eq(datapointConfigs.id, datapointId))
      .get();

    if (!config) {
      throw new Error(`DataPoint config not found: ${datapointId}`);
    }

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

    // Trigger cognify with the extraction prompt
    const prompt = config.extractionPrompt ?? this._buildExtractionPrompt(
      config.datapointType,
      JSON.parse(config.schemaDefinition).fields
    );
    await cogneeClient.cognify([config.datasetName], true, prompt, userId).catch((err) =>
      console.warn('[DataPointService] Cognify trigger failed:', err)
    );
  }

  /**
   * List DataPoint configs with optional filters.
   * Includes predefined system DataPoints (seeded on first call if missing).
   */
  async listDataPoints(
    userId: string,
    filters?: DataPointFilters
  ): Promise<Record<string, unknown>[]> {
    // Ensure predefined DataPoints exist for this user
    await this._ensurePredefinedExist(userId);

    // Build query conditions
    const conditions: any[] = [eq(datapointConfigs.userId, userId)];

    if (filters?.datapointType) {
      conditions.push(eq(datapointConfigs.datapointType, filters.datapointType));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(datapointConfigs.isActive, filters.isActive));
    }
    if (filters?.isPredefined !== undefined) {
      conditions.push(eq(datapointConfigs.isPredefined, filters.isPredefined));
    }
    if (filters?.datasetName) {
      conditions.push(eq(datapointConfigs.datasetName, filters.datasetName));
    }

    const rows = await db
      .select()
      .from(datapointConfigs)
      .where(and(...conditions))
      .all();

    return rows
      .map((row: any) => ({
        ...row,
        schemaDefinition: JSON.parse(row.schemaDefinition),
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }

  /**
   * Get a single DataPoint config by ID.
   */
  async getDataPoint(datapointId: string): Promise<Record<string, unknown> | null> {
    const row = await db
      .select()
      .from(datapointConfigs)
      .where(eq(datapointConfigs.id, datapointId))
      .get();

    if (!row) return null;

    return {
      ...(row as any),
      schemaDefinition: JSON.parse((row as any).schemaDefinition),
    };
  }

  /**
   * Update mutable fields of a DataPoint config.
   * Cannot change name/type of predefined DataPoints.
   * Re-sends schema to Cognee if the schema changed.
   */
  async updateDataPoint(
    datapointId: string,
    updates: Partial<Pick<DataPointDefinition, 'description' | 'schemaDefinition' | 'extractionPrompt' | 'datasetName'>> & { name?: string; datapointType?: string },
    userId?: string
  ): Promise<Record<string, unknown> | null> {
    const existing = await db
      .select()
      .from(datapointConfigs)
      .where(eq(datapointConfigs.id, datapointId))
      .get();

    if (!existing) return null;

    const existingRow = existing as any;

    // Guard: predefined DataPoints cannot have name/type changed
    if (existingRow.isPredefined) {
      if (updates.name && updates.name !== existingRow.name) {
        throw new Error('Cannot change the name of a predefined DataPoint');
      }
      if (updates.datapointType && updates.datapointType !== existingRow.datapointType) {
        throw new Error('Cannot change the type of a predefined DataPoint');
      }
    }

    // Validate schema if provided
    if (updates.schemaDefinition) {
      this._validateSchema(updates.schemaDefinition);
    }

    const setValues: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (updates.name !== undefined) setValues.name = updates.name;
    if (updates.description !== undefined) setValues.description = updates.description;
    if (updates.extractionPrompt !== undefined) setValues.extractionPrompt = updates.extractionPrompt;
    if (updates.datasetName !== undefined) setValues.datasetName = updates.datasetName;
    if (updates.schemaDefinition !== undefined) {
      setValues.schemaDefinition = JSON.stringify(updates.schemaDefinition);
    }

    await db
      .update(datapointConfigs)
      .set(setValues)
      .where(eq(datapointConfigs.id, datapointId))
      .run();

    // Re-send to Cognee if schema changed
    if (updates.schemaDefinition) {
      const dsName = updates.datasetName ?? existingRow.datasetName;
      await this._sendToCognee(dsName, updates.schemaDefinition, userId).catch((err) =>
        console.warn('[DataPointService] Re-send schema to Cognee failed:', err)
      );
    }

    return this.getDataPoint(datapointId);
  }

  /**
   * Deactivate a DataPoint (sets is_active=false).
   * Predefined DataPoints cannot be deactivated.
   */
  async deactivateDataPoint(datapointId: string): Promise<void> {
    const existing = await db
      .select()
      .from(datapointConfigs)
      .where(eq(datapointConfigs.id, datapointId))
      .get();

    if (!existing) {
      throw new Error(`DataPoint config not found: ${datapointId}`);
    }

    if ((existing as any).isPredefined) {
      throw new Error('Cannot deactivate a predefined DataPoint');
    }

    await db
      .update(datapointConfigs)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(datapointConfigs.id, datapointId))
      .run();
  }

  /**
   * Delete a custom DataPoint config (hard delete).
   * Predefined DataPoints cannot be deleted.
   */
  async deleteDataPoint(datapointId: string): Promise<void> {
    const existing = await db
      .select()
      .from(datapointConfigs)
      .where(eq(datapointConfigs.id, datapointId))
      .get();

    if (!existing) {
      throw new Error(`DataPoint config not found: ${datapointId}`);
    }

    if ((existing as any).isPredefined) {
      throw new Error('Cannot delete a predefined DataPoint');
    }

    await db
      .delete(datapointConfigs)
      .where(eq(datapointConfigs.id, datapointId))
      .run();
  }

  /**
   * Get extraction stats for a DataPoint: extraction count, last run,
   * accuracy score, feedback count, and sample entities from Cognee.
   */
  async getExtractionStats(datapointId: string, userId?: string): Promise<ExtractionStats> {
    const config = await db
      .select()
      .from(datapointConfigs)
      .where(eq(datapointConfigs.id, datapointId))
      .get();

    if (!config) {
      throw new Error(`DataPoint config not found: ${datapointId}`);
    }

    const configRow = config as any;

    // Count feedback entries for this datapoint
    const feedbackRows = await db
      .select()
      .from(cogneeFeedback)
      .where(eq(cogneeFeedback.datapointConfigId, datapointId))
      .all();

    const feedbackCount = feedbackRows.length;

    // Try to get sample entities from Cognee search
    let sampleEntities: Record<string, unknown>[] = [];
    try {
      const results = await cogneeClient.searchRich(
        `${configRow.name} entities`,
        configRow.datasetName,
        3,
        'CHUNKS',
        userId
      );
      sampleEntities = results.map((r) => ({
        text: r.text,
        score: r.score,
        ...r.metadata,
      }));
    } catch {
      // Cognee may be unavailable — return empty samples
    }

    return {
      totalExtractions: configRow.extractionCount ?? 0,
      lastExtractionAt: configRow.lastExtractionAt ?? null,
      accuracyScore: configRow.accuracyScore ?? null,
      feedbackCount,
      sampleEntities,
    };
  }

  /**
   * Return the 3 predefined DataPoint definitions (constants, not from DB).
   */
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

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /**
   * Validate that a schema definition has a `fields` array where each field
   * includes at minimum `name` and `type`.
   */
  private _validateSchema(schema: { fields: Array<{ name: string; type: string }> }): void {
    if (!schema || !Array.isArray(schema.fields)) {
      throw new Error('Schema must have a "fields" array');
    }
    if (schema.fields.length === 0) {
      throw new Error('Schema must have at least one field');
    }
    for (const field of schema.fields) {
      if (!field.name || typeof field.name !== 'string') {
        throw new Error(`Each field must have a "name" string, got: ${JSON.stringify(field)}`);
      }
      if (!field.type || typeof field.type !== 'string') {
        throw new Error(`Each field must have a "type" string, got: ${JSON.stringify(field)}`);
      }
    }
  }

  /**
   * Send a schema definition to Cognee's dataset as context for future cognify.
   * Adds the schema as a structured text document to the dataset.
   */
  private async _sendToCognee(
    datasetName: string,
    schema: { fields: Array<{ name: string; type: string; required?: boolean }> },
    userId?: string
  ): Promise<void> {
    const schemaText = `DataPoint Schema for ${datasetName}:\n` +
      schema.fields
        .map((f) => `  - ${f.name} (${f.type})${f.required ? ' [required]' : ''}`)
        .join('\n');

    await cogneeClient.add([schemaText], datasetName, userId);
  }

  /**
   * Build an extraction prompt from a DataPoint type and its fields.
   * This prompt is sent to Cognee during cognify to guide entity extraction.
   */
  private _buildExtractionPrompt(
    datapointType: string,
    fields: ReadonlyArray<{ name: string; type: string; required?: boolean }>
  ): string {
    const requiredFields = fields.filter((f) => f.required).map((f) => f.name);
    const optionalFields = fields.filter((f) => !f.required).map((f) => f.name);

    let prompt = `Extract ${datapointType} entities from the data. `;
    if (requiredFields.length > 0) {
      prompt += `Required fields: ${requiredFields.join(', ')}. `;
    }
    if (optionalFields.length > 0) {
      prompt += `Optional fields: ${optionalFields.join(', ')}. `;
    }
    prompt += 'Return structured entities with the specified fields.';
    return prompt;
  }

  // --------------------------------------------------------------------------
  // Wave 3: Upsert & Bulk Registration
  // --------------------------------------------------------------------------

  /**
   * Create or update a DataPoint config (Wave 3).
   * Upserts by (userId, name) — idempotent for re-registration.
   */
  async createOrUpdateDataPoint(config: {
    userId: string;
    name: string;
    description: string;
    fields: string; // JSON string of field definitions
    targetDataset: string;
  }): Promise<void> {
    // Look up existing by (userId, name)
    const existing = await db
      .select()
      .from(datapointConfigs)
      .where(
        and(
          eq(datapointConfigs.userId, config.userId),
          eq(datapointConfigs.name, config.name)
        )
      )
      .get();

    if (existing) {
      // Update existing
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
      // Insert new
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

  /**
   * Register all Wave 3 DataPoint models for a user (Wave 3).
   * Returns the number of DataPoint models registered.
   */
  async registerWave3DataPoints(userId: string, datasetPrefix: string): Promise<number> {
    const { ALL_DATAPOINT_MODELS, registerAllDataPoints } = await import('./cognee/datapoint-models.js');
    await registerAllDataPoints(this, userId, datasetPrefix);
    return ALL_DATAPOINT_MODELS.length;
  }

  // --------------------------------------------------------------------------
  // Private helpers (continued)
  // --------------------------------------------------------------------------

  /**
   * Ensure the 3 predefined DataPoints exist in the DB for this user.
   * Idempotent — checks by name+userId before inserting.
   */
  private async _ensurePredefinedExist(userId: string): Promise<void> {
    const existing = await db
      .select()
      .from(datapointConfigs)
      .where(
        and(
          eq(datapointConfigs.userId, userId),
          eq(datapointConfigs.isPredefined, true)
        )
      )
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
