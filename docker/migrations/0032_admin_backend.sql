-- Migration 0032: Admin Backend (Wave 20)
-- Adds admin users, agent execution tracking, system metrics, health checks,
-- user activity logging, feature flags, and agent configuration management.

-- ============================================================================
-- ADMIN USERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  permissions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TEXT,
  login_count INTEGER NOT NULL DEFAULT 0,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  mfa_secret TEXT,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- AGENT EXECUTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_executions (
  id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL,
  agent_name TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  input_summary TEXT,
  output_summary TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd REAL NOT NULL DEFAULT 0,
  model_used TEXT,
  tool_calls_count INTEGER NOT NULL DEFAULT 0,
  tool_calls JSONB NOT NULL DEFAULT '[]',
  error_message TEXT,
  error_stack TEXT,
  duration_ms INTEGER,
  triggered_by TEXT NOT NULL DEFAULT 'system',
  context JSONB NOT NULL DEFAULT '{}',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_agent_executions_type ON agent_executions(agent_type);
CREATE INDEX idx_agent_executions_status ON agent_executions(status);
CREATE INDEX idx_agent_executions_started ON agent_executions(started_at);

-- ============================================================================
-- AGENT CONFIGURATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_configurations (
  id TEXT PRIMARY KEY,
  agent_type TEXT UNIQUE NOT NULL,
  display_name TEXT,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  model TEXT NOT NULL,
  max_input_tokens INTEGER NOT NULL,
  max_output_tokens INTEGER NOT NULL,
  temperature REAL NOT NULL DEFAULT 0.1,
  system_prompt_override TEXT,
  tools_enabled JSONB NOT NULL DEFAULT '[]',
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 10,
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 100,
  circuit_breaker_threshold INTEGER NOT NULL DEFAULT 5,
  circuit_breaker_recovery_ms INTEGER NOT NULL DEFAULT 60000,
  custom_config JSONB NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SYSTEM METRICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_metrics (
  id TEXT PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  tags JSONB NOT NULL DEFAULT '{}',
  source TEXT,
  observation_time TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX idx_system_metrics_time ON system_metrics(observation_time);
CREATE INDEX idx_system_metrics_source ON system_metrics(source);

-- ============================================================================
-- SYSTEM HEALTH CHECKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_health_checks (
  id TEXT PRIMARY KEY,
  service_name TEXT NOT NULL,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL,
  response_time_ms INTEGER,
  details JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  checked_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_system_health_service ON system_health_checks(service_name);
CREATE INDEX idx_system_health_checked ON system_health_checks(checked_at);

-- ============================================================================
-- USER ACTIVITY LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  session_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_user_activity_user ON user_activity_log(user_id);
CREATE INDEX idx_user_activity_action ON user_activity_log(action);
CREATE INDEX idx_user_activity_created ON user_activity_log(created_at);

-- ============================================================================
-- FEATURE FLAGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  flag_name TEXT UNIQUE NOT NULL,
  display_name TEXT,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INTEGER NOT NULL DEFAULT 0,
  conditions JSONB NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'general',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_feature_flags_name ON feature_flags(flag_name);
CREATE INDEX idx_feature_flags_category ON feature_flags(category);

-- ============================================================================
-- SEED: Default Feature Flags
-- ============================================================================

INSERT INTO feature_flags (id, flag_name, display_name, description, is_enabled, category) VALUES
  ('ff-cdr-crawl', 'cdr_crawl_enabled', 'CDR Crawl', 'Enable Consumer Data Right bank feed crawling', false, 'integrations'),
  ('ff-market-feeds', 'market_feeds_enabled', 'Market Feeds', 'Enable live market data feeds for investment tracking', false, 'integrations'),
  ('ff-sentiment', 'sentiment_analysis_enabled', 'Sentiment Analysis', 'Enable AI-powered financial sentiment analysis', false, 'ai'),
  ('ff-cognee', 'cognee_enabled', 'Cognee Knowledge Graph', 'Enable Cognee knowledge graph integration', true, 'ai'),
  ('ff-admin-panel', 'admin_panel_enabled', 'Admin Panel', 'Enable the admin management panel', true, 'system'),
  ('ff-3d-graph', '3d_graph_enabled', '3D Graph Viewer', 'Enable 3D knowledge graph visualization', false, 'visualization'),
  ('ff-multi-user', 'multi_user_enabled', 'Multi-User Mode', 'Enable multi-user authentication and tenancy', false, 'system');
