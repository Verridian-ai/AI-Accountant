-- Wave 16: Cognee Custom DataPoints, Graph Schemas, and Feedback
-- Migration 0028

CREATE TABLE IF NOT EXISTS datapoint_configs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    datapoint_type TEXT NOT NULL CHECK (datapoint_type IN ('FinancialTransaction', 'BusinessRelationship', 'TaxEvent', 'MerchantProfile', 'RecurringPattern', 'ComplianceObligation', 'custom')),
    schema_definition TEXT NOT NULL,
    extraction_prompt TEXT,
    dataset_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_predefined BOOLEAN NOT NULL DEFAULT false,
    extraction_count INTEGER NOT NULL DEFAULT 0,
    last_extraction_at TEXT,
    accuracy_score REAL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_datapoint_configs_user ON datapoint_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_datapoint_configs_type ON datapoint_configs(datapoint_type);
CREATE INDEX IF NOT EXISTS idx_datapoint_configs_active ON datapoint_configs(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_datapoint_configs_name_user ON datapoint_configs(user_id, name);

CREATE TABLE IF NOT EXISTS graph_schemas (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    ontology_type TEXT NOT NULL CHECK (ontology_type IN ('financial', 'tax', 'relationship', 'compliance', 'merchant', 'custom')),
    node_types TEXT NOT NULL,
    edge_types TEXT NOT NULL,
    constraints TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_predefined BOOLEAN NOT NULL DEFAULT false,
    applied_datasets TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_graph_schemas_user ON graph_schemas(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_schemas_type ON graph_schemas(ontology_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_schemas_name_user ON graph_schemas(user_id, name);

CREATE TABLE IF NOT EXISTS cognee_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('correct', 'incorrect', 'partial', 'irrelevant', 'missing')),
    original_value TEXT,
    corrected_value TEXT,
    context TEXT,
    datapoint_config_id TEXT REFERENCES datapoint_configs(id),
    applied_to_memify BOOLEAN NOT NULL DEFAULT false,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cognee_feedback_user ON cognee_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_cognee_feedback_entity ON cognee_feedback(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cognee_feedback_type ON cognee_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_cognee_feedback_applied ON cognee_feedback(applied_to_memify);

-- Seed predefined DataPoint configs
INSERT INTO datapoint_configs (id, user_id, name, description, datapoint_type, schema_definition, dataset_name, is_predefined, is_active) VALUES
('dp-financial-tx', 'system', 'FinancialTransaction', 'Standard financial transaction entity', 'FinancialTransaction',
 '{"fields": [{"name": "amount", "type": "number", "required": true}, {"name": "merchant", "type": "string", "required": true}, {"name": "category", "type": "string", "required": true}, {"name": "date", "type": "date", "required": true}, {"name": "gst_amount", "type": "number", "required": false}, {"name": "account_id", "type": "string", "required": false}]}',
 'transaction_patterns', true, true),
('dp-business-rel', 'system', 'BusinessRelationship', 'Business entity relationship', 'BusinessRelationship',
 '{"fields": [{"name": "entity_a", "type": "string", "required": true}, {"name": "entity_b", "type": "string", "required": true}, {"name": "relationship_type", "type": "string", "required": true}, {"name": "frequency", "type": "number", "required": false}, {"name": "total_value", "type": "number", "required": false}]}',
 'merchant_data', true, true),
('dp-tax-event', 'system', 'TaxEvent', 'Tax-relevant event entity', 'TaxEvent',
 '{"fields": [{"name": "event_type", "type": "string", "required": true}, {"name": "amount", "type": "number", "required": true}, {"name": "tax_impact", "type": "number", "required": false}, {"name": "ruling_ref", "type": "string", "required": false}, {"name": "period", "type": "string", "required": true}, {"name": "entity_type", "type": "string", "required": false}]}',
 'tax_strategies', true, true);
