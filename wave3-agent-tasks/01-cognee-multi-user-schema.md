# Agent 1: Cognee Multi-User Schema Builder

## Role
Create cognee_user_accounts and cognee_sessions tables in the dual schema system (SQLite + PostgreSQL) plus PostgreSQL migration 0015.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0015_cognee_multi_user.sql`
**Purpose**: PostgreSQL migration adding 2 new tables for Cognee multi-user support
**Pattern**: Follow `docker/migrations/0012_tax_return_platform.sql` — use `CREATE TABLE IF NOT EXISTS`, include indexes

> **REVISION NOTE (D02 CRIT-03 + Migration Idempotency):** All CREATE TABLE statements MUST use `IF NOT EXISTS` for idempotency. The `cognee_password_hash` column has been RENAMED to `cognee_refresh_token` — we store an encrypted Cognee refresh token, NOT the password. Passwords are used only transiently during account creation and immediately discarded.

- [ ] Create `cognee_user_accounts` table (use `CREATE TABLE IF NOT EXISTS`):
  - `id TEXT PRIMARY KEY` (UUID)
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE` (UNIQUE — one Cognee account per user)
  - `cognee_email TEXT NOT NULL` (email used to create Cognee-side account)
  - `cognee_refresh_token TEXT` (AES-256-GCM encrypted Cognee **refresh token** — REVISION: NOT password per D02 CRIT-03. Nullable until first token exchange.)
  - `cognee_user_id TEXT` (Cognee's internal user ID, populated after registration)
  - `dataset_prefix TEXT NOT NULL` (e.g. 'user_abc123' — used to prefix all dataset names)
  - `is_active BOOLEAN DEFAULT true`
  - `last_sync_at TIMESTAMPTZ`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
  - UNIQUE INDEX on `(user_id)`
  - UNIQUE INDEX on `(cognee_email)`

- [ ] Create `cognee_sessions` table (use `CREATE TABLE IF NOT EXISTS`):
  - `id TEXT PRIMARY KEY` (UUID)
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `session_type TEXT NOT NULL DEFAULT 'chat'` ('chat', 'analysis', 'batch')
  - `cognee_session_id TEXT` (Cognee's internal session ID if applicable)
  - `state TEXT NOT NULL DEFAULT 'active'` ('active', 'paused', 'expired')
  - `context_data TEXT` (JSON: conversation history, active filters, last query)
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `last_activity_at TIMESTAMPTZ DEFAULT NOW()`
  - `expires_at TIMESTAMPTZ NOT NULL` (default: created_at + 30 minutes)
  - INDEX on `(user_id, state)`
  - INDEX on `(expires_at)` (for cleanup jobs)

## Files to MODIFY

### 2. `server/src/schema.ts`
**Purpose**: Add 2 new sqliteTable definitions
**Location**: Add BEFORE the `// TYPE EXPORTS` section

```typescript
// ============================================================================
// COGNEE MULTI-USER
// ============================================================================

export const cogneeUserAccounts = sqliteTable('cognee_user_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cogneeEmail: text('cognee_email').notNull(),
  cogneeRefreshToken: text('cognee_refresh_token'), // REVISION: Encrypted refresh token, NOT password (D02 CRIT-03)
  cogneeUserId: text('cognee_user_id'),
  datasetPrefix: text('dataset_prefix').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastSyncAt: text('last_sync_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const cogneeSessions = sqliteTable('cognee_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionType: text('session_type').notNull().default('chat'),
  cogneeSessionId: text('cognee_session_id'),
  state: text('state').notNull().default('active'),
  contextData: text('context_data'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  lastActivityAt: text('last_activity_at').notNull().default('CURRENT_TIMESTAMP'),
  expiresAt: text('expires_at').notNull(),
});
```

- [ ] Add type exports in the TYPE EXPORTS section:

```typescript
// Cognee Multi-User
export type CogneeUserAccount = typeof cogneeUserAccounts.$inferSelect;
export type NewCogneeUserAccount = typeof cogneeUserAccounts.$inferInsert;
export type CogneeSession = typeof cogneeSessions.$inferSelect;
export type NewCogneeSession = typeof cogneeSessions.$inferInsert;
```

### 3. `server/src/db/postgres-schema.ts`
**Purpose**: Add matching pgTable definitions for both new tables
**Pattern**: Follow existing tables in postgres-schema.ts — use `pgTable()`, `timestamp(..., { withTimezone: true })`, `boolean()`

- [ ] Add `cogneeUserAccounts` pgTable:
```typescript
import { pgTable, text, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const cogneeUserAccounts = pgTable('cognee_user_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cogneeEmail: text('cognee_email').notNull(),
  cogneeRefreshToken: text('cognee_refresh_token'), // REVISION: Encrypted refresh token, NOT password (D02 CRIT-03)
  cogneeUserId: text('cognee_user_id'),
  datasetPrefix: text('dataset_prefix').notNull(),
  isActive: boolean('is_active').default(true),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const cogneeSessions = pgTable('cognee_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionType: text('session_type').notNull().default('chat'),
  cogneeSessionId: text('cognee_session_id'),
  state: text('state').notNull().default('active'),
  contextData: text('context_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
```

- [ ] Add matching type exports

### 4. `server/src/index.ts` (import line)
**BEFORE**:
```typescript
import { db, transactions, statements, users, ... } from './schema.js'
```
**AFTER** — add `cogneeUserAccounts, cogneeSessions` to the import:
```typescript
import { db, transactions, statements, users, ..., cogneeUserAccounts, cogneeSessions } from './schema.js'
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Migration file `0015_cognee_multi_user.sql` is valid PostgreSQL syntax
- [ ] Both sqliteTable definitions compile correctly
- [ ] All 4 type exports (2 select + 2 insert) resolve correctly
- [ ] Create marker file: `.agent-done-W03-01`

## Dependencies
- **None** — can start immediately
- **Reuses**: schema.ts patterns, postgres-schema.ts patterns, migration conventions
