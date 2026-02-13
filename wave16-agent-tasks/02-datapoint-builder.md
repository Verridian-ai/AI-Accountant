# Agent W16-02: DataPoint Service Builder

## Role
Build the Cognee DataPoint management service with predefined and custom DataPoint definitions, activation, extraction tracking, and deactivation.

## Priority: WAVE 16 (After W16-01 completes schema)

## Wait Condition
Check for `.agent-done-W16-01` marker file before starting.

## Context
- Cognee DataPoints API: POST /v1/datasets/{name}/data_points -- configures entity extraction
- Cognee client: `server/src/services/cognee_client.ts` -- HTTP wrapper
- Schema: `datapointConfigs` table (from W16-01)
- Predefined types: FinancialTransaction, BusinessRelationship, TaxEvent (seeded in migration 0028)

## Files to CREATE

### 1. `server/src/services/cognee-datapoints.ts`
**Purpose**: Manage Cognee DataPoint configurations and entity extraction
**Pattern**: Follow `server/src/services/cognee_client.ts` for HTTP call patterns

- [ ] Create `CogneeDataPointService` class with the following methods:

  - `defineDataPoint(userId: string, config: DataPointDefinition): Promise<DataPointConfig>` -- Creates new DataPoint config in DB. Validates schema_definition JSON structure (must have `fields` array with `name` and `type` per field). Generates unique ID. Sends DataPoint definition to Cognee API: `POST /v1/datasets/{dataset_name}/data_points` with schema body. Returns persisted config.
    ```typescript
    interface DataPointDefinition {
      name: string;
      description?: string;
      datapointType: 'FinancialTransaction' | 'BusinessRelationship' | 'TaxEvent' | 'MerchantProfile' | 'RecurringPattern' | 'ComplianceObligation' | 'custom';
      schemaDefinition: {
        fields: Array<{ name: string; type: 'string' | 'number' | 'date' | 'boolean' | 'array'; required?: boolean }>;
      };
      extractionPrompt?: string;
      datasetName: string;
    }
    ```

  - `activateExtraction(datapointId: string): Promise<void>` -- Sets `is_active = true` on config. Triggers Cognee cognify on the target dataset with the DataPoint's extraction prompt. Updates `last_extraction_at` timestamp.

  - `listDataPoints(userId: string, filters?: DataPointFilters): Promise<DataPointConfig[]>` -- Queries datapointConfigs table with optional filters: `{ datapointType?, isActive?, isPredefined?, datasetName? }`. Returns list sorted by name. Includes predefined system DataPoints.

  - `getDataPoint(datapointId: string): Promise<DataPointConfig>` -- Single DataPoint by ID with full schema definition.

  - `updateDataPoint(datapointId: string, updates: Partial<DataPointDefinition>): Promise<DataPointConfig>` -- Updates mutable fields (description, extractionPrompt, schemaDefinition). Cannot change name or type of predefined DataPoints. Re-sends to Cognee API if schema changed.

  - `deactivateDataPoint(datapointId: string): Promise<void>` -- Sets `is_active = false`. Does NOT delete from Cognee (data persists). Cannot deactivate predefined DataPoints.

  - `deleteDataPoint(datapointId: string): Promise<void>` -- Hard delete custom DataPoints only. Predefined DataPoints cannot be deleted (throw error). Removes from DB but leaves Cognee data intact.

  - `getExtractionStats(datapointId: string): Promise<ExtractionStats>` -- Returns extraction count, last extraction date, accuracy score (from feedback), and sample extracted entities.
    ```typescript
    interface ExtractionStats {
      totalExtractions: number;
      lastExtractionAt: string | null;
      accuracyScore: number | null;
      feedbackCount: number;
      sampleEntities: Record<string, unknown>[];
    }
    ```

  - `getPredefinedDataPoints(): Promise<DataPointConfig[]>` -- Returns the 3 predefined DataPoints (FinancialTransaction, BusinessRelationship, TaxEvent) regardless of user.

- [ ] Implement private helper methods:
  - `_validateSchema(schema: unknown): boolean` -- Validates schema_definition structure
  - `_sendToCognee(datasetName: string, schema: Record<string, unknown>): Promise<void>` -- HTTP POST to Cognee DataPoints API
  - `_buildExtractionPrompt(datapointType: string, fields: Array<{ name: string; type: string }>): string` -- Generate extraction prompt from schema fields

- [ ] Define predefined DataPoint schemas as constants:
  ```typescript
  const PREDEFINED_DATAPOINTS = {
    FinancialTransaction: {
      fields: [
        { name: 'amount', type: 'number', required: true },
        { name: 'merchant', type: 'string', required: true },
        { name: 'category', type: 'string', required: true },
        { name: 'date', type: 'date', required: true },
        { name: 'gst_amount', type: 'number', required: false },
        { name: 'account_id', type: 'string', required: false },
      ],
    },
    BusinessRelationship: {
      fields: [
        { name: 'entity_a', type: 'string', required: true },
        { name: 'entity_b', type: 'string', required: true },
        { name: 'relationship_type', type: 'string', required: true },
        { name: 'frequency', type: 'number', required: false },
        { name: 'total_value', type: 'number', required: false },
      ],
    },
    TaxEvent: {
      fields: [
        { name: 'event_type', type: 'string', required: true },
        { name: 'amount', type: 'number', required: true },
        { name: 'tax_impact', type: 'number', required: false },
        { name: 'ruling_ref', type: 'string', required: false },
        { name: 'period', type: 'string', required: true },
        { name: 'entity_type', type: 'string', required: false },
      ],
    },
  } as const;
  ```

- [ ] Wire Drizzle ORM queries against `datapointConfigs` table (from schema.ts)

## Files to MODIFY

None -- standalone service. Types shared via exported interfaces.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `CogneeDataPointService` can be instantiated without errors
- [ ] `defineDataPoint()` creates config in DB and calls Cognee API
- [ ] `listDataPoints()` returns predefined + user DataPoints
- [ ] `deactivateDataPoint()` rejects predefined DataPoints
- [ ] `deleteDataPoint()` rejects predefined DataPoints
- [ ] `_validateSchema()` rejects schema without `fields` array
- [ ] `getPredefinedDataPoints()` returns exactly 3 items
- [ ] Create marker file: `.agent-done-W16-02`

## Dependencies
- **Requires**: W16-01 (`.agent-done-W16-01`) -- datapointConfigs table must exist in schema
- **Reuses**: schema.ts (datapointConfigs), cognee_client.ts (HTTP methods)
