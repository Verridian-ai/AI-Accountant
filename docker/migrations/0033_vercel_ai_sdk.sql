-- Migration 0033: Vercel AI SDK Infrastructure (Wave 21)
-- Adds agent stream sessions, structured output schemas, and agent migration status
-- for tracking the Vercel AI SDK migration from legacy Claude agent classes.

-- ============================================================================
-- AGENT STREAM SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_stream_sessions (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  agent_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_status TEXT NOT NULL DEFAULT 'pending',
  input_payload JSONB,
  output_payload JSONB,
  token_usage JSONB,
  stream_started_at TIMESTAMP,
  stream_completed_at TIMESTAMP,
  error_message TEXT,
  model_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'anthropic',
  latency_ms INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stream_sessions_agent ON agent_stream_sessions(agent_type);
CREATE INDEX idx_stream_sessions_user ON agent_stream_sessions(user_id);
CREATE INDEX idx_stream_sessions_status ON agent_stream_sessions(session_status);

-- ============================================================================
-- STRUCTURED OUTPUT SCHEMAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS structured_output_schemas (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  agent_type TEXT NOT NULL UNIQUE,
  schema_name TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  zod_schema_json JSONB NOT NULL,
  sample_output JSONB,
  validation_stats JSONB NOT NULL DEFAULT '{"total":0,"passed":0,"failed":0}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- AGENT MIGRATION STATUS
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_migration_status (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  agent_type TEXT NOT NULL UNIQUE,
  legacy_class TEXT NOT NULL,
  vercel_class TEXT,
  migration_phase TEXT NOT NULL DEFAULT 'legacy',
  legacy_invocations INTEGER NOT NULL DEFAULT 0,
  vercel_invocations INTEGER NOT NULL DEFAULT 0,
  error_rate_legacy REAL NOT NULL DEFAULT 0,
  error_rate_vercel REAL NOT NULL DEFAULT 0,
  avg_latency_legacy_ms INTEGER,
  avg_latency_vercel_ms INTEGER,
  migrated_at TIMESTAMP,
  rollback_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_migration_status_phase ON agent_migration_status(migration_phase);
