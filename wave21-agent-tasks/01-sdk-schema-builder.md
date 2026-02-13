# Agent 1: SDK Schema Builder

## Role
Create 3 database tables and migration 0033 to support Vercel AI SDK agent streaming sessions, structured output schema registry, and migration tracking.

## Priority: WAVE 21 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0033_vercel_ai_sdk.sql`
**Purpose**: 3 new tables for Vercel AI SDK migration infrastructure

```sql
-- agent_stream_sessions: Track active and completed streaming sessions
CREATE TABLE IF NOT EXISTS agent_stream_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agent_type TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    session_status TEXT NOT NULL DEFAULT 'pending', -- pending, streaming, completed, errored
    input_payload JSONB,
    output_payload JSONB,
    token_usage JSONB, -- { promptTokens, completionTokens, totalTokens }
    stream_started_at TIMESTAMP,
    stream_completed_at TIMESTAMP,
    error_message TEXT,
    model_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'anthropic', -- anthropic, openrouter
    latency_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- structured_output_schemas: Registry of Zod schemas for agent outputs
CREATE TABLE IF NOT EXISTS structured_output_schemas (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agent_type TEXT NOT NULL UNIQUE,
    schema_name TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    zod_schema_json JSONB NOT NULL, -- Serialized Zod schema definition
    sample_output JSONB, -- Example valid output for reference
    validation_stats JSONB DEFAULT '{"total":0,"passed":0,"failed":0}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- agent_migration_status: Track migration from legacy ClaudeAgent to VercelAgent
CREATE TABLE IF NOT EXISTS agent_migration_status (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agent_type TEXT NOT NULL UNIQUE,
    legacy_class TEXT NOT NULL, -- e.g. 'BudgetAnalyzerAgent'
    vercel_class TEXT, -- e.g. 'VercelBudgetAnalyzer'
    migration_phase TEXT NOT NULL DEFAULT 'legacy', -- legacy, pilot, parallel, migrated, deprecated
    legacy_invocations INTEGER DEFAULT 0,
    vercel_invocations INTEGER DEFAULT 0,
    error_rate_legacy REAL DEFAULT 0,
    error_rate_vercel REAL DEFAULT 0,
    avg_latency_legacy_ms INTEGER,
    avg_latency_vercel_ms INTEGER,
    migrated_at TIMESTAMP,
    rollback_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stream_sessions_agent ON agent_stream_sessions(agent_type);
CREATE INDEX idx_stream_sessions_user ON agent_stream_sessions(user_id);
CREATE INDEX idx_stream_sessions_status ON agent_stream_sessions(session_status);
CREATE INDEX idx_migration_status_phase ON agent_migration_status(migration_phase);
```

- [ ] Write migration SQL with all 3 tables, indexes, and defaults
- [ ] Ensure all FK references are valid (`users.id` exists in schema)

### 2. `server/src/schema.ts` additions
**Purpose**: Add 3 new `sqliteTable` definitions matching migration

- [ ] Add `agentStreamSessions` sqliteTable after existing table definitions
- [ ] Add `structuredOutputSchemas` sqliteTable
- [ ] Add `agentMigrationStatus` sqliteTable
- [ ] All columns use `text()`, `integer()`, `real()` per SQLite Drizzle pattern

### 3. `server/src/db/postgres-schema.ts` additions
**Purpose**: Add 3 new `pgTable` definitions matching migration

- [ ] Add `agentStreamSessions` pgTable with PostgreSQL types (`boolean()`, `timestamp()`, `jsonb()`)
- [ ] Add `structuredOutputSchemas` pgTable
- [ ] Add `agentMigrationStatus` pgTable
- [ ] Add indexes in third argument of pgTable calls

## Files to MODIFY

### 4. `server/src/schema.ts`
- [ ] Add exports for all 3 new tables at end of file

### 5. `server/src/db/postgres-schema.ts`
- [ ] Add exports for all 3 new tables at end of file

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Migration SQL runs without errors against PostgreSQL
- [ ] All 3 tables accessible via Drizzle imports
- [ ] Create marker file: `.agent-done-W21-01`

## Dependencies
- **None** -- can start immediately
- **Schema lock**: Only this agent and Agent 10 may modify schema.ts and postgres-schema.ts in Wave 21
