# Agent W16-01: Cognee Schema Builder

## Role
Create 3 new database tables and migration 0028 for custom DataPoint configurations, graph schema definitions, and Cognee feedback tracking.

## Priority: WAVE 16 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0028_cognee_datapoints.sql`
**Purpose**: 3 tables for Cognee DataPoint management, ontology schemas, and feedback loops

- [ ] Create `datapoint_configs` table:
  ```sql
  CREATE TABLE IF NOT EXISTS datapoint_configs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    datapoint_type TEXT NOT NULL CHECK (datapoint_type IN ('FinancialTransaction', 'BusinessRelationship', 'TaxEvent', 'MerchantProfile', 'RecurringPattern', 'ComplianceObligation', 'custom')),
    schema_definition TEXT NOT NULL, -- JSON: field names, types, constraints
    extraction_prompt TEXT, -- Custom prompt for Cognee entity extraction
    dataset_name TEXT NOT NULL, -- Target Cognee dataset
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_predefined BOOLEAN NOT NULL DEFAULT false,
    extraction_count INTEGER NOT NULL DEFAULT 0,
    last_extraction_at TEXT,
    accuracy_score REAL, -- Feedback-derived accuracy 0-1
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_datapoint_configs_user ON datapoint_configs(user_id);
  CREATE INDEX idx_datapoint_configs_type ON datapoint_configs(datapoint_type);
  CREATE INDEX idx_datapoint_configs_active ON datapoint_configs(is_active);
  CREATE UNIQUE INDEX idx_datapoint_configs_name_user ON datapoint_configs(user_id, name);
  ```

- [ ] Create `graph_schemas` table:
  ```sql
  CREATE TABLE IF NOT EXISTS graph_schemas (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    ontology_type TEXT NOT NULL CHECK (ontology_type IN ('financial', 'tax', 'relationship', 'compliance', 'merchant', 'custom')),
    node_types TEXT NOT NULL, -- JSON array: [{name, properties, color}]
    edge_types TEXT NOT NULL, -- JSON array: [{name, source_type, target_type, properties}]
    constraints TEXT, -- JSON: validation rules for graph structure
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_predefined BOOLEAN NOT NULL DEFAULT false,
    applied_datasets TEXT, -- JSON array of dataset names this ontology is applied to
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_graph_schemas_user ON graph_schemas(user_id);
  CREATE INDEX idx_graph_schemas_type ON graph_schemas(ontology_type);
  CREATE UNIQUE INDEX idx_graph_schemas_name_user ON graph_schemas(user_id, name);
  ```

- [ ] Create `cognee_feedback` table:
  ```sql
  CREATE TABLE IF NOT EXISTS cognee_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    entity_type TEXT NOT NULL, -- 'datapoint', 'search_result', 'graph_node', 'extraction'
    entity_id TEXT NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('correct', 'incorrect', 'partial', 'irrelevant', 'missing')),
    original_value TEXT, -- What Cognee produced
    corrected_value TEXT, -- What the user corrected to
    context TEXT, -- JSON: query used, dataset, search type
    datapoint_config_id TEXT REFERENCES datapoint_configs(id),
    applied_to_memify BOOLEAN NOT NULL DEFAULT false,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_cognee_feedback_user ON cognee_feedback(user_id);
  CREATE INDEX idx_cognee_feedback_entity ON cognee_feedback(entity_type, entity_id);
  CREATE INDEX idx_cognee_feedback_type ON cognee_feedback(feedback_type);
  CREATE INDEX idx_cognee_feedback_applied ON cognee_feedback(applied_to_memify);
  ```

- [ ] Insert predefined DataPoint configs:
  ```sql
  INSERT INTO datapoint_configs (id, user_id, name, description, datapoint_type, schema_definition, dataset_name, is_predefined, is_active) VALUES
  ('dp-financial-tx', 'system', 'FinancialTransaction', 'Standard financial transaction entity', 'FinancialTransaction',
   '{"fields": [{"name": "amount", "type": "number"}, {"name": "merchant", "type": "string"}, {"name": "category", "type": "string"}, {"name": "date", "type": "date"}, {"name": "gst_amount", "type": "number"}, {"name": "account_id", "type": "string"}]}',
   'transaction_patterns', true, true),
  ('dp-business-rel', 'system', 'BusinessRelationship', 'Business entity relationship', 'BusinessRelationship',
   '{"fields": [{"name": "entity_a", "type": "string"}, {"name": "entity_b", "type": "string"}, {"name": "relationship_type", "type": "string"}, {"name": "frequency", "type": "number"}, {"name": "total_value", "type": "number"}]}',
   'merchant_data', true, true),
  ('dp-tax-event', 'system', 'TaxEvent', 'Tax-relevant event entity', 'TaxEvent',
   '{"fields": [{"name": "event_type", "type": "string"}, {"name": "amount", "type": "number"}, {"name": "tax_impact", "type": "number"}, {"name": "ruling_ref", "type": "string"}, {"name": "period", "type": "string"}, {"name": "entity_type", "type": "string"}]}',
   'tax_strategies', true, true);
  ```

### 2. `server/src/schema.ts` -- Add 3 sqliteTable definitions
- [ ] Add `datapointConfigs` sqliteTable with all columns
- [ ] Add `graphSchemas` sqliteTable with all columns
- [ ] Add `cogneeFeedback` sqliteTable with FK to users and datapointConfigs

### 3. `server/src/db/postgres-schema.ts` -- Add 3 pgTable definitions
- [ ] Mirror all 3 tables using pgTable with PostgreSQL types (`boolean()` instead of `integer({mode:'boolean'})`)
- [ ] Add appropriate indexes

## Files to MODIFY

### 4. `server/src/schema.ts`
- [ ] Export all 3 new table constants

### 5. `server/src/db/postgres-schema.ts`
- [ ] Export all 3 new pgTable constants

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Migration SQL is valid (no syntax errors when run against PostgreSQL)
- [ ] All 3 tables exported from both schema files
- [ ] Foreign key references are valid (users.id, datapointConfigs.id)
- [ ] Predefined DataPoint configs inserted correctly
- [ ] Unique constraints on (user_id, name) work for both datapoint_configs and graph_schemas
- [ ] Create marker file: `.agent-done-W16-01`

## Dependencies
- **None** -- can start immediately
- **Schema lock**: Only W16-01 may modify schema.ts and postgres-schema.ts in Wave 16
