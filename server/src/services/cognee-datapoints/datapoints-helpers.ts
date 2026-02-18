/**
 * Cognee DataPoints — Pure helper functions
 */

import { db, datapointConfigs } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { cogneeClient } from '../cognee_client.js';
import { PREDEFINED_DATAPOINTS, type PredefinedName } from './constants.js';

export function validateSchema(schema: { fields: Array<{ name: string; type: string }> }): void {
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

export async function sendToCognee(
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

export function buildExtractionPrompt(
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

export async function ensurePredefinedExist(userId: string): Promise<void> {
  const existing = await db
    .select()
    .from(datapointConfigs)
    .where(and(eq(datapointConfigs.userId, userId), eq(datapointConfigs.isPredefined, true)))
    .all();

  const existingNames = new Set(existing.map((r: { name: string }) => r.name));
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
        extractionPrompt: buildExtractionPrompt(key, schema.fields),
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
