# Agent 1: Admin Schema Builder

## Role
Create 7 admin/system tables and migration 0032 for admin users, agent execution tracking, system metrics, health checks, user activity logging, and feature flags.

## Priority: WAVE 20 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0032_admin_backend.sql`
**Purpose**: 7 tables for admin backend, agent monitoring, and system management
**Pattern**: Follow `docker/migrations/0031_market_intelligence.sql` structure

- [ ] Create `admin_users` table:
  ```sql
  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    permissions JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    last_login_at TEXT,
    login_count INTEGER DEFAULT 0,
    failed_login_count INTEGER DEFAULT 0,
    locked_until TEXT,
    mfa_secret TEXT,
    mfa_enabled BOOLEAN DEFAULT false,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```
  - `role` values: 'super_admin', 'admin', 'viewer'
  - `permissions` array: 'manage_users', 'manage_agents', 'manage_cognee', 'view_metrics', 'manage_features', 'trigger_crawl', 'manage_scheduler'

- [ ] Create `agent_executions` table:
  ```sql
  CREATE TABLE IF NOT EXISTS agent_executions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agent_type TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    input_summary TEXT,
    output_summary TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    estimated_cost_usd REAL DEFAULT 0,
    model_used TEXT,
    tool_calls_count INTEGER DEFAULT 0,
    tool_calls JSONB DEFAULT '[]'::jsonb,
    error_message TEXT,
    error_stack TEXT,
    duration_ms INTEGER,
    triggered_by TEXT DEFAULT 'system',
    context JSONB DEFAULT '{}'::jsonb,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```
  - `status` values: 'running', 'completed', 'failed', 'timeout', 'cancelled'
  - `triggered_by` values: 'system', 'user', 'scheduler', 'pipeline', 'chat'
  - `agent_type` maps to `AgentType` union from `claude/types.ts`

- [ ] Create `agent_configurations` table:
  ```sql
  CREATE TABLE IF NOT EXISTS agent_configurations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agent_type TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT true,
    model TEXT NOT NULL,
    max_input_tokens INTEGER NOT NULL,
    max_output_tokens INTEGER NOT NULL,
    temperature REAL DEFAULT 0.1,
    system_prompt_override TEXT,
    tools_enabled JSONB DEFAULT '[]'::jsonb,
    rate_limit_per_minute INTEGER DEFAULT 10,
    rate_limit_per_hour INTEGER DEFAULT 100,
    circuit_breaker_threshold INTEGER DEFAULT 5,
    circuit_breaker_recovery_ms INTEGER DEFAULT 60000,
    custom_config JSONB DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```

- [ ] Create `system_metrics` table:
  ```sql
  CREATE TABLE IF NOT EXISTS system_metrics (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    metric_name TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT,
    tags JSONB DEFAULT '{}'::jsonb,
    source TEXT NOT NULL,
    observation_time TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```
  - `metric_type` values: 'gauge', 'counter', 'histogram', 'timer'
  - `source` values: 'server', 'postgres', 'redis', 'cognee', 'client', 'agent', 'scheduler'
  - Partition-friendly: large table, should include TTL or rotation strategy

- [ ] Create `system_health_checks` table:
  ```sql
  CREATE TABLE IF NOT EXISTS system_health_checks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    service_name TEXT NOT NULL,
    check_type TEXT NOT NULL,
    status TEXT NOT NULL,
    response_time_ms INTEGER,
    details JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    checked_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```
  - `service_name` values: 'postgres', 'redis', 'cognee', 'server', 'client', 'alpha_vantage', 'coingecko', 'rba', 'abs', 'cdr_register'
  - `check_type` values: 'ping', 'query', 'http', 'tcp', 'disk', 'memory'
  - `status` values: 'healthy', 'degraded', 'unhealthy', 'unknown'

- [ ] Create `user_activity_log` table:
  ```sql
  CREATE TABLE IF NOT EXISTS user_activity_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    session_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    duration_ms INTEGER,
    status TEXT DEFAULT 'success',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```
  - `action` values: 'login', 'logout', 'view_page', 'upload_statement', 'run_pipeline', 'chat_query', 'export_data', 'change_settings', 'trigger_crawl', 'admin_action'
  - `resource_type` values: 'transaction', 'statement', 'account', 'report', 'agent', 'dataset', 'product'

- [ ] Create `feature_flags` table:
  ```sql
  CREATE TABLE IF NOT EXISTS feature_flags (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    flag_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT false,
    rollout_percentage INTEGER DEFAULT 0,
    conditions JSONB DEFAULT '{}'::jsonb,
    category TEXT NOT NULL DEFAULT 'general',
    created_by TEXT,
    updated_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```
  - `category` values: 'general', 'ai', 'data_feeds', 'ui', 'experimental'
  - Default flags to seed:
    - `cdr_crawl_enabled` (data_feeds, true)
    - `market_feeds_enabled` (data_feeds, true)
    - `sentiment_analysis_enabled` (ai, true)
    - `cognee_enabled` (ai, true)
    - `admin_panel_enabled` (ui, false)
    - `3d_graph_enabled` (experimental, false)
    - `multi_user_enabled` (general, false)

- [ ] Create indexes:
  ```sql
  CREATE INDEX idx_agent_executions_type ON agent_executions(agent_type);
  CREATE INDEX idx_agent_executions_status ON agent_executions(status);
  CREATE INDEX idx_agent_executions_started ON agent_executions(started_at);
  CREATE INDEX idx_system_metrics_name ON system_metrics(metric_name);
  CREATE INDEX idx_system_metrics_time ON system_metrics(observation_time);
  CREATE INDEX idx_system_metrics_source ON system_metrics(source);
  CREATE INDEX idx_health_checks_service ON system_health_checks(service_name);
  CREATE INDEX idx_health_checks_time ON system_health_checks(checked_at);
  CREATE INDEX idx_user_activity_user ON user_activity_log(user_id);
  CREATE INDEX idx_user_activity_action ON user_activity_log(action);
  CREATE INDEX idx_user_activity_time ON user_activity_log(created_at);
  CREATE INDEX idx_feature_flags_name ON feature_flags(flag_name);
  CREATE INDEX idx_feature_flags_category ON feature_flags(category);
  ```

- [ ] Seed default feature flags:
  ```sql
  INSERT INTO feature_flags (flag_name, display_name, description, is_enabled, category)
  VALUES
    ('cdr_crawl_enabled', 'CDR Open Banking Crawl', 'Enable CDR product data crawling', true, 'data_feeds'),
    ('market_feeds_enabled', 'Market Data Feeds', 'Enable RBA/ABS/price data feeds', true, 'data_feeds'),
    ('sentiment_analysis_enabled', 'Sentiment Analysis', 'Enable AI-powered market sentiment analysis', true, 'ai'),
    ('cognee_enabled', 'Cognee Knowledge Graph', 'Enable Cognee integration for knowledge indexing', true, 'ai'),
    ('admin_panel_enabled', 'Admin Panel', 'Enable admin dashboard access', false, 'ui'),
    ('3d_graph_enabled', '3D Knowledge Graph', 'Enable 3D force-directed graph visualization', false, 'experimental'),
    ('multi_user_enabled', 'Multi-User Mode', 'Enable multi-user authentication', false, 'general')
  ON CONFLICT (flag_name) DO NOTHING;
  ```

### 2. `server/src/db/admin-schema.ts`
**Purpose**: Drizzle schema definitions for all 7 admin tables
**Pattern**: Follow `server/src/schema.ts` using `sqliteTable()` for all tables

- [ ] Export 7 table definitions matching the SQL migration exactly
- [ ] Export TypeScript types: `AdminUser`, `AgentExecution`, `AgentConfiguration`, `SystemMetric`, `SystemHealthCheck`, `UserActivityLog`, `FeatureFlag`

## Files to MODIFY

### 3. `server/src/schema.ts`
- [ ] Add `export * from './db/admin-schema.js';` at the end of the file to re-export admin tables

## Verification
- [ ] Migration runs clean against PostgreSQL: `docker exec goldledger-postgres psql -U goldledger -d ai_accountant -f /migrations/0032_admin_backend.sql`
- [ ] All 7 tables created with correct columns and constraints
- [ ] Indexes created successfully
- [ ] Default feature flags seeded
- [ ] Drizzle schema types compile: `cd server && npx tsc --noEmit` (no new errors)
- [ ] Create marker file: `.agent-done-W20-01`

## Dependencies
- **None** -- can start immediately
- **Reuses**: server/src/schema.ts pattern, docker/migrations/ directory
