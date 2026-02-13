# Agent 1: Mutation Schema Builder

## Role
Create the database migration and dual schema definitions for the 3 new tables: `agent_mutations`, `agent_sessions`, and `agent_audit_log`.

## Priority: SUB-WAVE 1 (No dependencies)

## Files to CREATE

### 1. `docker/migrations/0014_agent_mutations.sql`
**Purpose**: PostgreSQL migration for agent mutation tracking tables

```sql
BEGIN;

-- ============================================================
-- Migration 0014: Agent Mutations & Streaming
-- Wave 2 — Transaction Mutation & Streaming
-- ============================================================

-- 1. Agent Sessions — Groups related agent interactions
CREATE TABLE IF NOT EXISTS agent_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'active',
    context TEXT,
    total_mutations INTEGER NOT NULL DEFAULT 0,
    confirmed_mutations INTEGER NOT NULL DEFAULT 0,
    rejected_mutations INTEGER NOT NULL DEFAULT 0,
    query_count INTEGER NOT NULL DEFAULT 0,
    agent_types_used TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_last_activity ON agent_sessions(last_activity_at);

-- 2. Agent Mutations — Tracks proposed/confirmed/executed DB changes
CREATE TABLE IF NOT EXISTS agent_mutations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES agent_sessions(id),
    agent_type TEXT NOT NULL,
    mutation_type TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_id TEXT,
    target_ids TEXT,
    before_state TEXT,
    after_state TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed',
    confidence REAL,
    requires_confirmation BOOLEAN NOT NULL DEFAULT true,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    executed_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    error_message TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_mutations_session ON agent_mutations(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_mutations_status ON agent_mutations(status);
CREATE INDEX IF NOT EXISTS idx_agent_mutations_agent ON agent_mutations(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_mutations_target ON agent_mutations(target_table);
CREATE INDEX IF NOT EXISTS idx_agent_mutations_created ON agent_mutations(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_mutations_expiry ON agent_mutations(status, expires_at);

-- 3. Agent Audit Log — Immutable audit trail
CREATE TABLE IF NOT EXISTS agent_audit_log (
    id TEXT PRIMARY KEY,
    mutation_id TEXT REFERENCES agent_mutations(id),
    session_id TEXT REFERENCES agent_sessions(id),
    agent_type TEXT NOT NULL,
    action TEXT NOT NULL,
    target_table TEXT,
    target_id TEXT,
    before_state TEXT,
    after_state TEXT,
    metadata TEXT,
    user_id TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_mutation ON agent_audit_log(mutation_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_session ON agent_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_agent ON agent_audit_log(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_audit_action ON agent_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_agent_audit_created ON agent_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_audit_target ON agent_audit_log(target_table);

COMMIT;
```

#### Requirements:
- [ ] File starts with `BEGIN;` and ends with `COMMIT;`
- [ ] All 3 `CREATE TABLE IF NOT EXISTS` statements present
- [ ] All foreign keys reference the correct parent tables
- [ ] All indexes created with `IF NOT EXISTS`
- [ ] Uses PostgreSQL types: `BOOLEAN`, `TIMESTAMP WITH TIME ZONE`, `REAL`, `TEXT`
- [ ] NO SQLite-isms (no `INTEGER` for booleans)
- [ ] `agent_sessions` created BEFORE `agent_mutations` (FK dependency)

## Files to MODIFY

### 2. `server/src/schema.ts` — Add SQLite table definitions

**Add 3 new table definitions** at the end of the file (before any exports):

```typescript
// ── Wave 2: Agent Mutations ──────────────────────────────

export const agentSessions = sqliteTable('agent_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  lastActivityAt: integer('last_activity_at', { mode: 'timestamp' }),
  status: text('status').notNull().default('active'),
  context: text('context'),
  totalMutations: integer('total_mutations').notNull().default(0),
  confirmedMutations: integer('confirmed_mutations').notNull().default(0),
  rejectedMutations: integer('rejected_mutations').notNull().default(0),
  queryCount: integer('query_count').notNull().default(0),
  agentTypesUsed: text('agent_types_used'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

export const agentMutations = sqliteTable('agent_mutations', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => agentSessions.id),
  agentType: text('agent_type').notNull(),
  mutationType: text('mutation_type').notNull(),
  targetTable: text('target_table').notNull(),
  targetId: text('target_id'),
  targetIds: text('target_ids'),
  beforeState: text('before_state'),
  afterState: text('after_state').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('proposed'),
  confidence: real('confidence'),
  requiresConfirmation: integer('requires_confirmation', { mode: 'boolean' }).notNull().default(true),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
  executedAt: integer('executed_at', { mode: 'timestamp' }),
  rejectedAt: integer('rejected_at', { mode: 'timestamp' }),
  rejectionReason: text('rejection_reason'),
  errorMessage: text('error_message'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const agentAuditLog = sqliteTable('agent_audit_log', {
  id: text('id').primaryKey(),
  mutationId: text('mutation_id').references(() => agentMutations.id),
  sessionId: text('session_id').references(() => agentSessions.id),
  agentType: text('agent_type').notNull(),
  action: text('action').notNull(),
  targetTable: text('target_table'),
  targetId: text('target_id'),
  beforeState: text('before_state'),
  afterState: text('after_state'),
  metadata: text('metadata'),
  userId: text('user_id'),
  ipAddress: text('ip_address'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});
```

- [ ] Use `sqliteTable()` from existing Drizzle imports
- [ ] Use `integer({ mode: 'boolean' })` for boolean fields (SQLite pattern)
- [ ] Use `integer({ mode: 'timestamp' })` for timestamp fields
- [ ] Use `real()` for confidence (decimal)
- [ ] Place after all existing table definitions
- [ ] Do NOT modify any existing table definitions

### 3. `server/src/db/postgres-schema.ts` — Add PostgreSQL table definitions

**Add 3 new pgTable definitions** at the end of the file:

```typescript
// ── Wave 2: Agent Mutations ──────────────────────────────

export const pgAgentSessions = pgTable('agent_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow(),
  status: text('status').notNull().default('active'),
  context: text('context'),
  totalMutations: integer('total_mutations').notNull().default(0),
  confirmedMutations: integer('confirmed_mutations').notNull().default(0),
  rejectedMutations: integer('rejected_mutations').notNull().default(0),
  queryCount: integer('query_count').notNull().default(0),
  agentTypesUsed: text('agent_types_used'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const pgAgentMutations = pgTable('agent_mutations', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => pgAgentSessions.id),
  agentType: text('agent_type').notNull(),
  mutationType: text('mutation_type').notNull(),
  targetTable: text('target_table').notNull(),
  targetId: text('target_id'),
  targetIds: text('target_ids'),
  beforeState: text('before_state'),
  afterState: text('after_state').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('proposed'),
  confidence: real('confidence'),
  requiresConfirmation: boolean('requires_confirmation').notNull().default(true),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  errorMessage: text('error_message'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const pgAgentAuditLog = pgTable('agent_audit_log', {
  id: text('id').primaryKey(),
  mutationId: text('mutation_id').references(() => pgAgentMutations.id),
  sessionId: text('session_id').references(() => pgAgentSessions.id),
  agentType: text('agent_type').notNull(),
  action: text('action').notNull(),
  targetTable: text('target_table'),
  targetId: text('target_id'),
  beforeState: text('before_state'),
  afterState: text('after_state'),
  metadata: text('metadata'),
  userId: text('user_id'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

- [ ] Use `pgTable()` from existing Drizzle imports
- [ ] Use `boolean()` for boolean fields (PG native)
- [ ] Use `timestamp({ withTimezone: true })` for timestamps
- [ ] Use `real()` for confidence
- [ ] Prefix with `pg` to follow existing naming pattern (e.g., `pgAgentSessions`)
- [ ] Do NOT modify any existing pgTable definitions

### 4. `docker-compose.yml` — Mount new migration

**Add new bind mount** for migration 0014 in the postgres service volumes section:

```yaml
- ./docker/migrations/0014_agent_mutations.sql:/docker-entrypoint-initdb.d/10-agent-mutations.sql
```

- [ ] Mount after the existing 0012 migration (numbered 10-agent-mutations.sql)
- [ ] Do NOT modify any existing volume mounts
- [ ] Do NOT change any other docker-compose configuration

## Verification
- [ ] `docker/migrations/0014_agent_mutations.sql` starts with `BEGIN;` ends with `COMMIT;`
- [ ] All 3 tables have `CREATE TABLE IF NOT EXISTS`
- [ ] `agent_sessions` is created before `agent_mutations` (FK dependency)
- [ ] `schema.ts` has 3 new `sqliteTable()` definitions
- [ ] `postgres-schema.ts` has 3 new `pgTable()` definitions
- [ ] SQLite uses `integer({ mode: 'boolean' })`, PG uses `boolean()`
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] docker-compose.yml mounts the new migration
- [ ] Create marker file: `.agent-done-W2-01`

## Dependencies
- **Requires**: Nothing — this is a Sub-Wave 1 task
- **Blocks**: Agents 4, 6 (need schema for service implementation)
