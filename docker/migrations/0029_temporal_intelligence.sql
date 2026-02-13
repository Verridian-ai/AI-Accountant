-- Migration 0029: Temporal Intelligence (Wave 17)
-- Adds temporal queries, cross-module insights, intelligence subscriptions, and module connections

-- ============================================================================
-- TEMPORAL QUERIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS temporal_queries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  query_type TEXT NOT NULL CHECK (query_type IN ('point_in_time', 'time_range', 'trend_over_time', 'comparison', 'evolution')),
  target_entity TEXT NOT NULL,
  time_start TEXT NOT NULL,
  time_end TEXT,
  time_granularity TEXT DEFAULT 'monthly' CHECK (time_granularity IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  query_parameters TEXT NOT NULL,
  cognee_dataset TEXT,
  cognee_search_type TEXT DEFAULT 'GRAPH_COMPLETION',
  result_cache TEXT,
  cache_expires_at TEXT,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TEXT,
  average_execution_ms INTEGER,
  is_saved BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_temporal_queries_user ON temporal_queries(user_id);
CREATE INDEX idx_temporal_queries_type ON temporal_queries(query_type);
CREATE INDEX idx_temporal_queries_entity ON temporal_queries(target_entity);
CREATE INDEX idx_temporal_queries_saved ON temporal_queries(is_saved);

-- ============================================================================
-- CROSS-MODULE INSIGHTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cross_module_insights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('correlation', 'anomaly_cascade', 'trend_alignment', 'compliance_risk', 'forecast_deviation', 'spending_pattern', 'tax_opportunity')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'suggestion', 'warning', 'critical')),
  source_modules TEXT NOT NULL,
  related_entities TEXT NOT NULL,
  time_range_start TEXT,
  time_range_end TEXT,
  confidence REAL NOT NULL DEFAULT 0.5,
  evidence TEXT NOT NULL,
  recommended_action TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'acted_on', 'dismissed')),
  acted_on_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT
);
CREATE INDEX idx_cross_module_insights_user ON cross_module_insights(user_id);
CREATE INDEX idx_cross_module_insights_type ON cross_module_insights(insight_type);
CREATE INDEX idx_cross_module_insights_status ON cross_module_insights(status);
CREATE INDEX idx_cross_module_insights_severity ON cross_module_insights(severity);
CREATE INDEX idx_cross_module_insights_time ON cross_module_insights(time_range_start, time_range_end);

-- ============================================================================
-- INTELLIGENCE SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS intelligence_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  subscription_type TEXT NOT NULL CHECK (subscription_type IN ('insight_type', 'module', 'entity', 'threshold', 'schedule')),
  filter_criteria TEXT NOT NULL,
  notification_channel TEXT NOT NULL DEFAULT 'in_app' CHECK (notification_channel IN ('in_app', 'email', 'sse', 'webhook')),
  notification_config TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TEXT,
  cooldown_minutes INTEGER DEFAULT 60,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_intelligence_subs_user ON intelligence_subscriptions(user_id);
CREATE INDEX idx_intelligence_subs_active ON intelligence_subscriptions(is_active);
CREATE INDEX idx_intelligence_subs_type ON intelligence_subscriptions(subscription_type);

-- ============================================================================
-- MODULE CONNECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS module_connections (
  id TEXT PRIMARY KEY,
  source_module TEXT NOT NULL CHECK (source_module IN ('transactions', 'forecasting', 'compliance', 'anomaly_detection', 'tax', 'bas', 'knowledge', 'accounts', 'analytics')),
  target_module TEXT NOT NULL CHECK (target_module IN ('transactions', 'forecasting', 'compliance', 'anomaly_detection', 'tax', 'bas', 'knowledge', 'accounts', 'analytics')),
  connection_type TEXT NOT NULL CHECK (connection_type IN ('data_flow', 'trigger', 'dependency', 'correlation', 'enrichment')),
  description TEXT NOT NULL,
  strength REAL NOT NULL DEFAULT 0.5,
  is_bidirectional BOOLEAN NOT NULL DEFAULT false,
  metadata TEXT,
  last_activity_at TEXT,
  activity_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_module_connections_source ON module_connections(source_module);
CREATE INDEX idx_module_connections_target ON module_connections(target_module);
CREATE INDEX idx_module_connections_type ON module_connections(connection_type);
CREATE UNIQUE INDEX idx_module_connections_pair ON module_connections(source_module, target_module, connection_type);

-- ============================================================================
-- SEED: Predefined Module Connections
-- ============================================================================

INSERT INTO module_connections (id, source_module, target_module, connection_type, description, strength, is_bidirectional) VALUES
('mc-tx-forecast', 'transactions', 'forecasting', 'data_flow', 'Transaction history feeds forecast models', 0.9, false),
('mc-tx-anomaly', 'transactions', 'anomaly_detection', 'data_flow', 'Transactions scanned for anomalies', 0.9, false),
('mc-tx-tax', 'transactions', 'tax', 'data_flow', 'Transactions categorized for tax calculations', 0.8, false),
('mc-tx-bas', 'transactions', 'bas', 'data_flow', 'GST transactions feed BAS calculations', 0.8, false),
('mc-anomaly-compliance', 'anomaly_detection', 'compliance', 'trigger', 'Anomalies may indicate compliance issues', 0.6, false),
('mc-forecast-compliance', 'forecasting', 'compliance', 'enrichment', 'Forecasts inform compliance obligation planning', 0.5, false),
('mc-tax-compliance', 'tax', 'compliance', 'dependency', 'Tax calculations required for compliance checks', 0.7, false),
('mc-bas-compliance', 'bas', 'compliance', 'dependency', 'BAS lodgement is a compliance obligation', 0.8, false),
('mc-knowledge-all', 'knowledge', 'transactions', 'enrichment', 'Knowledge graph enriches transaction understanding', 0.5, true),
('mc-analytics-forecast', 'analytics', 'forecasting', 'correlation', 'Analytics trends correlate with forecast accuracy', 0.4, true);
