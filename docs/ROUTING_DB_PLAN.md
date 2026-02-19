# GoldLedger — Routing Layer & DB Connection Migration Plan
*Generated: 2026-02-19 | Research-only, no code changes made*

## Executive Summary

- **Current state**: 51 route files serve the application, but 24/51 lack `tenantAuthMiddleware` and 16/51 use unvalidated `c.req.json()` without `zValidator` — violating CLAUDE.md rules 7-8. The Neon dual-pool system (`db/neon-connection.ts`) is fully built but **not wired** to any route or service; all traffic flows through a single `wrapPgDb()` proxy in `schema/connection.ts` that erases all type safety (returns `any`).
- **Key risks**: The SQLite proxy (`wrapPgDb`) strips Drizzle's type inference across 100+ consumers, making refactoring error-prone. 17 schema files define 129 `sqliteTable()` calls that must migrate to `pgTable()` for native PG features (uuid, jsonb, RLS). Removing the proxy touches every query chain in the application.
- **Migration scope**: 5 phases, 48 atomic tasks — from zero-regression foundation work (deprecated file cleanup, dual-pool wiring) through validation coverage, auth hardening, native PG migration, and production hardening. Estimated 18-26 developer-days.
- **Estimated effort**: Phase 1 (foundation): 3 days | Phase 2 (validation): 3 days | Phase 3 (auth): 2 days | Phase 4 (native PG): 8-12 days | Phase 5 (hardening): 2-3 days.

---

## 1. Current State Assessment

### 1.1 Route Layer (51 files + 1 subdirectory)

| Domain | Files | POST/PATCH/PUT Handlers | zValidator | tenantAuth |
|--------|-------|------------------------|------------|------------|
| **Auth** | api-auth.ts, auth-routes.ts, admin-auth-routes.ts | 6 | partial | intentionally public (2), missing (1) |
| **Core CRUD** | transactions.ts, accounts.ts, statements.ts | 8 | yes | yes |
| **Accounting** | bas.ts, tax.ts, tax-ext.ts, invoicing-routes.ts | 14 | yes (bas/tax), no (tax-ext) | yes |
| **AI/Agents** | chat.ts, agent-streaming.ts, agents.ts, agents-ext.ts, ai-agents.ts, agent-routes-extended/ | 12 | partial | partial |
| **Pipeline** | pipeline.ts, batch-uploads.ts, stream-schema.ts, stream-sessions.ts | 8 | partial | partial |
| **Transfers** | transfers.ts, transfers-ext.ts, account-misc.ts | 5 | yes | partial |
| **Finance** | reports.ts, budgets.ts, analytics.ts, dashboard.ts, charts.ts | 10 | partial | partial |
| **Market** | market-alerts.ts, market-calendar.ts, market-feeds.ts, market-indicators.ts, market-prices.ts, market-sentiment.ts | 12 | partial | yes (alerts/indicators/feeds/calendar), no (prices/sentiment) |
| **Procurement** | purchase-orders.ts, suppliers.ts, bills.ts, ap-extras.ts | 10 | yes | yes |
| **Tenants** | tenants.ts, members.ts, subscriptions.ts, invitations-ext.ts | 12 | yes | yes |
| **Admin** | admin-ext.ts, migration.ts, migration-ext.ts | 6 | no | no |
| **Other** | cognee.ts, payroll.ts, settings.ts, misc.ts, merchant-ops.ts | 8 | partial | partial |

### 1.2 Database Connection Architecture

```
ALL route/service files
    │
    ├── import { db } from '../schema.js'          (canonical path — ALL files)
    │       │
    │       ▼
    │   schema/index.ts  ──►  schema/connection.ts
    │                              │
    │                              ├── pg.Pool(NEON_DATABASE_URL)   ← single pool
    │                              ├── drizzle(pool)                ← raw Drizzle PG instance
    │                              └── wrapPgDb(drizzle(pool))      ← proxy returns `any`
    │                                     │
    │                                     ▼
    │                              db = any  ← ALL TYPE SAFETY LOST
    │
    └── (UNUSED) db/neon-connection.ts              (dual-pool — built, never wired)
            │
            ├── getProductionDb()  → NodePgDatabase<schema>  ← TYPED
            ├── getMaskedDb()      → NodePgDatabase<schema>  ← TYPED
            ├── getReadDb()        → smart selector
            ├── neonHealthCheck()  → used ONLY in health endpoint
            └── closePools()       → never called on shutdown
```

| File | Purpose | Status | Issues |
|------|---------|--------|--------|
| `schema/connection.ts` | Single pg.Pool + wrapPgDb proxy (117 lines) | **CANONICAL** | Returns `any`, no dual-pool, no masking |
| `db/neon-connection.ts` | Dual-pool (production + AI masked) (292 lines) | **BUILT, UNUSED** | Not wired to routes/services; only health check |
| `db/index.ts` | SQLite/PG switcher (deprecated) | **DEPRECATED** | Not imported by any live file |
| `db/postgres-connection.ts` | Legacy single PG pool | **LEGACY** | Bypassed by schema/connection.ts |
| `db/postgres-exports.ts` | Re-exports postgres-connection | **LEGACY** | Dead re-export |
| `db/postgres-schema.ts` | 2-line barrel re-export | **SHIM** | Used only by neon-connection.ts |
| `db/pg-db.ts` | SQLite placeholder converter | **ACTIVE** | Used by 3 services |
| `db/typed-queries.ts` | Typed query chains | **ACTIVE** | Works but types are nullified by wrapPgDb |
| `db/validate-schema.ts` | Schema validation utility | **ACTIVE** | OK |

### 1.3 SQLite Proxy Usage

The `wrapPgDb()` proxy in `schema/connection.ts` adds `.get()`, `.all()`, `.run()` methods to every Drizzle query chain, emulating the SQLite `better-sqlite3` API. This was a migration shim from the original SQLite backend.

| Schema File | `sqliteTable()` calls | Tables | Migration Complexity |
|-------------|----------------------|--------|---------------------|
| schema/core.ts | 5 | users, accounts, statements, transactions, settings | HIGH (core tables, 100+ references) |
| schema/tax.ts | 14 | gst_*, tax_*, deductions, etc. | HIGH (complex joins) |
| schema/payables.ts | 11 | purchase_orders, bills, suppliers, payments, etc. | MEDIUM |
| schema/accounting.ts | 10 | ledger_entries, journal_*, chart_of_accounts, etc. | HIGH (double-entry invariants) |
| schema/reporting.ts | 11 | report_*, budgets, forecast_*, kpi_* | MEDIUM |
| schema/cognee.ts | 10 | datapoint_*, graph_*, cognee_* | LOW (self-contained) |
| schema/multitenant.ts | 9 | tenants, tenant_*, permissions, subscriptions, etc. | MEDIUM |
| schema/analytics.ts | 10 | cash_flow_*, anomaly_*, compliance_* | MEDIUM |
| schema/invoicing.ts | 7 | invoices, invoice_items, invoice_payments, etc. | MEDIUM |
| schema/payroll.ts | 8 | employees, payroll_runs, pay_items, etc. | MEDIUM |
| schema/transactions.ts | 7 | transaction_*, categories, auto_rules | HIGH (most-queried) |
| schema/documents.ts | 6 | ocr_documents, ocr_line_items, document_queue, etc. | LOW |
| schema/banking.ts | 5 | cdr_*, rate_alerts | LOW |
| schema/teams.ts | 5 | agent_teams, team_members, team_tasks, etc. | LOW |
| schema/pwa.ts | 4 | push_subscriptions, offline_sync_*, notifications | LOW |
| schema/agents.ts | 4 | agent_executions, agent_configurations, etc. | LOW |
| schema/ui.ts | 3 | dashboard_layouts, saved_charts, feature_flags | LOW |
| **TOTAL** | **129** | **129 tables** | — |

### 1.4 Neon Configuration

**Environment Variables (server/.env):**

| Variable | Status | Value Pattern |
|----------|--------|---------------|
| `USE_NEON` | Set | `true` |
| `NEON_DATABASE_URL` | Set | `postgresql://...@ep-*.ap-southeast-2.aws.neon.tech/ai_accountant?sslmode=require` |
| `NEON_AI_BRANCH_URL` | Set | `postgresql://...@ep-wandering-wildflower-a75xbab1.ap-southeast-2.aws.neon.tech/...` |
| `NEON_API_KEY` | Set | Present |
| `NEON_PROJECT_ID` | Set | Present |
| `NEON_ORG_ID` | Set | Present |
| `NEON_BRANCH_ID` | Set | Present |
| `DB_POOL_MAX` | **MISSING** | Default: 20 (in neon-connection.ts) |
| `DB_POOL_MIN` | **MISSING** | Default: 2 (in neon-connection.ts) |

**What's Missing:**
- `schema/connection.ts` creates its OWN `pg.Pool` independent of `db/neon-connection.ts` — two separate pools compete for connections
- No graceful shutdown hook calls `closePools()` from neon-connection.ts
- No connection lifecycle management (no pool drain on SIGTERM)

---

## 2. Industry Best Practices (Research Findings)

### 2.1 Neon Connection Pooling

- **Recommended driver for Node.js long-running servers**: `drizzle-orm/node-postgres` with `pg.Pool` — GoldLedger's current approach is acceptable for Hono running as a persistent server
- **Neon serverless driver** (`@neondatabase/serverless`): Better for edge/serverless functions but not needed for Docker-hosted Node.js
- **Pool config best practice**: `max: 20, min: 2, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000` — already implemented in both `schema/connection.ts` and `db/neon-connection.ts`
- **SSL**: `{ rejectUnauthorized: false }` required for Neon — already implemented
- **Key issue**: Two independent pools (`schema/connection.ts` pool + `db/neon-connection.ts` pool) means up to 40 connections could be opened to Neon, exceeding the default Neon free-tier limit of 100 connections

### 2.2 Hono + zValidator Patterns

**Correct pattern:**
```typescript
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

app.post('/resource',
  zValidator('json', z.object({
    name: z.string(),
    amount: z.number().int().positive(),
  })),
  (c) => {
    const data = c.req.valid('json')  // fully typed
    return c.json({ ok: true }, 201)
  }
)
```

**Anti-patterns found in codebase:**
1. `await c.req.json()` without schema — 19 occurrences across 14 files (unvalidated, untyped)
2. Manual `if (!body.field)` checks instead of Zod schema — scattered across tax-ext.ts, admin-ext.ts
3. `parseBody(schema, await c.req.json())` — custom utility that duplicates zValidator (5 occurrences in agent-routes-extended/)
4. Missing `'json'` validator type — some files use `zValidator('form', ...)` where `'json'` is needed

### 2.3 Drizzle + Neon Native PG

- **`pgTable()` advantages over `sqliteTable()`**:
  - Native PG types: `uuid()`, `timestamp({ withTimezone: true })`, `jsonb()`, `bigint()`, `interval()`
  - Type inference: `InferSelectModel<typeof table>` / `InferInsertModel<typeof table>` — only works with `pgTable`
  - Prepared statements: `db.select().from(table).prepare('name')` — significant performance gain
  - Transactions: `db.transaction(async (tx) => { ... })` — native Drizzle, no `.run()` shim needed
  - RLS support: PostgreSQL Row-Level Security requires `pgTable` schema definition
- **Migration path**: `sqliteTable()` to `pgTable()` is a **breaking API change** — column types, default expressions, and query builder APIs differ
- **Incremental strategy**: Migrate one schema file at a time, update all consumers, verify with `tsc --noEmit`

### 2.4 Multi-Tenant Isolation

- **Current approach**: Application-level filtering via `tenantAuthMiddleware` — extracts `X-Tenant-Id` header, injects into context, services manually filter queries
- **Best practice**: PostgreSQL Row-Level Security (RLS) with `SET app.tenant_id = ?` per connection
- **RLS requirement**: Must use `pgTable()` (not `sqliteTable()`) for RLS policy definitions
- **Migration path**: Phase 5 — after `pgTable()` migration, add RLS policies to all tenant-scoped tables
- **Schema-per-tenant**: Not recommended at GoldLedger's scale (too many tables per tenant)

---

## 3. Gap Analysis

### 3.1 Validation Gaps (CRITICAL — CLAUDE.md Rule 7 Violation)

CLAUDE.md Rule 7: *"All route POST/PATCH/PUT handlers MUST use zValidator for body validation"*

**Files using `c.req.json()` without zValidator (16 files, 19 handlers):**

| File | Handler | Line | Current Pattern |
|------|---------|------|----------------|
| `chat.ts` | `POST /` | 82 | `validateBody(chatMessageSchema, await c.req.json())` — custom, not zValidator |
| `stream-sessions.ts` | `POST /` | 20 | `await c.req.json()` — raw, no validation |
| `charts.ts` | `POST /` | 23 | `await c.req.json()` — raw, no validation |
| `stream-schema.ts` | `POST /validate` | 98 | `await c.req.json()` — raw, no validation |
| `invitations-ext.ts` | `POST /accept` | 19 | `(await c.req.json()) as { token; userId }` — cast, no validation |
| `migration-ext.ts` | `POST /apply` | 18 | `await c.req.json()` — raw, no validation |
| `tax-ext.ts` | `POST /batch` | 48 | `await c.req.json()` — raw, no validation |
| `tax-ext.ts` | `POST /batch-remove` | 80 | `await c.req.json()` — raw, no validation |
| `tax-ext.ts` | `POST /deduction-analysis` | 197 | `await c.req.json()` — raw, no validation |
| `tax-ext.ts` | `PUT /deductions/:id` | 252 | `await c.req.json()` — raw, no validation |
| `tax-ext.ts` | `POST /claim-deduction` | 323 | `await c.req.json()` — raw, no validation |
| `admin-ext.ts` | `POST /cognee/index` | 15 | `await c.req.json()` — raw, no validation |
| `agent-routes-extended/routes-merchant.ts` | `POST /` | 12 | `parseBody()` — custom, not zValidator |
| `agent-routes-extended/routes-financial.ts` | `POST /` | 12 | `parseBody()` — custom, not zValidator |
| `agent-routes-extended/routes-tax.ts` | `POST /strategy` | 12 | `parseBody()` — custom, not zValidator |
| `agent-routes-extended/routes-tax.ts` | `POST /claims` | 50 | `parseBody()` — custom, not zValidator |
| `agent-routes-extended/routes-categorize.ts` | `POST /` | 12 | `parseBody()` — custom, not zValidator |
| `agent-routes-extended/routes-payroll.ts` | `POST /` | 12 | `parseBody()` — custom, not zValidator |
| `agent-routes-extended/routes-parse.ts` | `POST /` | 12 | `parseBody()` — custom, not zValidator |

### 3.2 Auth Coverage Gaps

CLAUDE.md Rule 8: *"All JWT payload access MUST have null guard"*

**Files missing `tenantAuthMiddleware` (15 non-public files):**

| File | Reason | Risk |
|------|--------|------|
| `admin-auth-routes.ts` | Admin auth uses separate auth | Should use `adminAuthMiddleware` |
| `admin-ext.ts` | Admin endpoints | Should use `adminAuthMiddleware` |
| `agent-routes-extended.ts` | AI agent endpoints | **HIGH** — LLM access without auth |
| `agents-ext.ts` | Extended agent endpoints | **HIGH** — LLM access without auth |
| `ai-agents.ts` | AI agent management | **HIGH** — agent config without auth |
| `batch-uploads.ts` | File upload | **HIGH** — arbitrary file upload without auth |
| `charts.ts` | Custom charts CRUD | MEDIUM — data exposure |
| `dashboard.ts` | Dashboard data | MEDIUM — data exposure |
| `market-prices.ts` | Market data | LOW — public data |
| `market-sentiment.ts` | Market data | LOW — public data |
| `migration.ts` | DB migration admin | **CRITICAL** — migration execution without auth |
| `migration-ext.ts` | Extended migration | **CRITICAL** — migration execution without auth |
| `payroll.ts` | Payroll data | **HIGH** — PII exposure |
| `reports.ts` | Financial reports | MEDIUM — data exposure |
| `settings.ts` | User settings | MEDIUM — preference modification |
| `stream-schema.ts` | Schema streaming | LOW — read-only |
| `transfers.ts` | Transfer operations | **HIGH** — money movement without auth |
| `transfers-ext.ts` | Extended transfers | **HIGH** — money movement without auth |

*Note: `api-auth.ts` and `auth-routes.ts` are intentionally public (login/register endpoints).*

### 3.3 DB Migration Complexity

| Migration Step | Files Affected | Effort | Risk |
|---------------|---------------|--------|------|
| Wire `neon-connection.ts` as canonical DB | 1 (schema/connection.ts) | S | LOW — single file change |
| Remove deprecated `db/` files | 4 files (index.ts, postgres-connection.ts, postgres-exports.ts) | S | LOW — already unused |
| `sqliteTable()` → `pgTable()` in schema/ | 17 schema files, 129 tables | XL (4-6 days) | HIGH — breaks all imports |
| Remove `.get()`/`.all()`/`.run()` from services | 80+ route files, 20+ service files | XXL (10-15 days) | CRITICAL — touches every query |
| Add `pgTable()` type inference to all queries | All consumers of `db` | L (3-4 days) | MEDIUM — incremental |

### 3.4 Deprecated Files Still Active

| File | Status | Still Imported By |
|------|--------|-------------------|
| `db/index.ts` | DEPRECATED | Nothing — safe to delete |
| `db/postgres-connection.ts` | LEGACY | `db/postgres-exports.ts` only |
| `db/postgres-exports.ts` | LEGACY | `db/postgres-schema.ts` only |
| `db/postgres-schema.ts` | SHIM | `db/neon-connection.ts` (for schema import) |

Chain: `neon-connection.ts` → `postgres-schema.ts` → `postgres-exports.ts` → `postgres-connection.ts`
This chain needs cleanup — `neon-connection.ts` should import schema directly from `schema/index.ts`.

### 3.5 parseInt() Missing Radix (CLAUDE.md Rule 9)

| File | Line | Expression | Fix |
|------|------|-----------|-----|
| `account-misc.ts` | 422-453 | 10 occurrences of `parseInt(x)` | Add `, 10` radix |
| `transfers-ext.ts` | 53-88 | 8 occurrences of `parseInt(x)` | Add `, 10` radix |
| `bas.ts` | 40-41 | `parseInt(q)`, `parseInt(year)` | Add `, 10` radix |
| `tax-ext.ts` | 37-38 | `parseInt(q)`, `parseInt(year)` | Add `, 10` radix |
| `tax.ts` | 63-64, 197-198 | 4 occurrences | Add `, 10` radix |
| `market-prices.ts` | 43 | `parseInt(c.req.query('days') ?? '30')` | Add `, 10` radix |
| `market-sentiment.ts` | 32 | `parseInt(c.req.query('days') ?? '30')` | Add `, 10` radix |
| `pipeline.ts` | 244-245 | `parseInt(match[1])`, `parseInt(match[2])` | Add `, 10` radix |

---

## 4. Atomic Task Plan

### Phase 1: Foundation (P0, No-Regression) — 3 days

**TASK-001** | Priority: P0 | Effort: S | Owner: db-specialist
- What: Delete deprecated `db/index.ts` (unused by any live code)
- Why: Dead code removal — file is a SQLite/PG switcher that nothing imports
- Files: `server/src/db/index.ts`
- Acceptance: File deleted, `npx tsc --noEmit` passes, `grep -r "db/index" server/src/` returns nothing
- Depends on: none

**TASK-002** | Priority: P0 | Effort: S | Owner: db-specialist
- What: Redirect `db/neon-connection.ts` to import schema from `../schema/index.js` instead of `./postgres-schema.js`
- Why: Break the dependency chain through deprecated files (neon-connection → postgres-schema → postgres-exports → postgres-connection)
- Files: `server/src/db/neon-connection.ts` (line 14)
- Acceptance: Import updated, `tsc --noEmit` passes, neon-connection no longer depends on postgres-* files
- Depends on: none

**TASK-003** | Priority: P0 | Effort: S | Owner: db-specialist
- What: Delete deprecated `db/postgres-connection.ts`, `db/postgres-exports.ts`, `db/postgres-schema.ts`
- Why: Dead code — these files only existed to serve neon-connection.ts (fixed in TASK-002)
- Files: 3 files in `server/src/db/`
- Acceptance: Files deleted, `tsc --noEmit` passes, no broken imports
- Depends on: TASK-002

**TASK-004** | Priority: P0 | Effort: M | Owner: db-specialist
- What: Replace `schema/connection.ts` single pool with imports from `db/neon-connection.ts`, keeping `wrapPgDb()` proxy intact for backward compatibility
- Why: Consolidate to one pool management system; enable dual-pool without breaking existing code
- Files: `server/src/schema/connection.ts`
- Acceptance: `schema/connection.ts` imports pool from `neon-connection.ts` instead of creating its own; `wrapPgDb(drizzle(pool))` still works; `tsc --noEmit` passes; `curl localhost:3501/health` returns 200
- Depends on: TASK-002

**TASK-005** | Priority: P0 | Effort: S | Owner: db-specialist
- What: Export `getProductionDb()`, `getMaskedDb()`, `getReadDb()` from `schema/index.ts` barrel
- Why: Make dual-pool accessible through the canonical import path (`../schema.js`)
- Files: `server/src/schema/index.ts`
- Acceptance: `import { getProductionDb, getMaskedDb } from '../schema.js'` works; `tsc --noEmit` passes
- Depends on: TASK-004

**TASK-006** | Priority: P0 | Effort: S | Owner: db-specialist
- What: Add graceful shutdown hook in `server/src/index.ts` to call `closePools()` on SIGTERM/SIGINT
- Why: Prevent connection leaks on server restart; Neon charges for idle connections
- Files: `server/src/index.ts`
- Acceptance: Server logs "All pools closed" on `docker compose restart server`; `tsc --noEmit` passes
- Depends on: TASK-004

**TASK-007** | Priority: P0 | Effort: S | Owner: db-specialist
- What: Clean up deprecated schema validation reports in `db/` (`SCHEMA_VALIDATION_REPORT.md`, `TYPE_SAFETY_SUMMARY.md`, `admin-schema.ts`, `cdr-schema.ts`, `market-schema.ts`)
- Why: These files are either documentation artifacts or duplicate schemas — verify zero imports before deleting
- Files: 5 files in `server/src/db/`
- Acceptance: `grep -r` confirms zero imports for each; files deleted; `tsc --noEmit` passes
- Depends on: TASK-003

### Phase 2: Validation Coverage (P0, CLAUDE.md Compliance) — 3 days

**TASK-008** | Priority: P0 | Effort: S | Owner: route-fixer
- What: Add `zValidator('json', ...)` to `charts.ts` POST handler (line 23)
- Why: CLAUDE.md rule 7 — POST handler reads `c.req.json()` without validation
- Files: `server/src/routes/charts.ts`
- Acceptance: `zValidator` imported and applied; `c.req.valid('json')` replaces `c.req.json()`; `tsc --noEmit` passes
- Depends on: none

**TASK-009** | Priority: P0 | Effort: S | Owner: route-fixer
- What: Add `zValidator('json', ...)` to `stream-sessions.ts` POST handler (line 20)
- Why: CLAUDE.md rule 7 — raw JSON read without validation
- Files: `server/src/routes/stream-sessions.ts`
- Acceptance: Schema defined, zValidator applied, `tsc --noEmit` passes
- Depends on: none

**TASK-010** | Priority: P0 | Effort: S | Owner: route-fixer
- What: Add `zValidator('json', ...)` to `stream-schema.ts` POST /validate handler (line 98)
- Why: CLAUDE.md rule 7 — raw JSON read without validation
- Files: `server/src/routes/stream-schema.ts`
- Acceptance: Schema defined, zValidator applied, `tsc --noEmit` passes
- Depends on: none

**TASK-011** | Priority: P0 | Effort: S | Owner: route-fixer
- What: Add `zValidator('json', ...)` to `invitations-ext.ts` POST /accept handler (line 19)
- Why: CLAUDE.md rule 7 — uses `as { token; userId }` type cast instead of validation
- Files: `server/src/routes/invitations-ext.ts`
- Acceptance: Schema defined, zValidator applied, type cast removed, `tsc --noEmit` passes
- Depends on: none

**TASK-012** | Priority: P0 | Effort: S | Owner: route-fixer
- What: Add `zValidator('json', ...)` to `migration-ext.ts` POST /apply handler (line 18)
- Why: CLAUDE.md rule 7 — raw JSON read without validation
- Files: `server/src/routes/migration-ext.ts`
- Acceptance: Schema defined, zValidator applied, `tsc --noEmit` passes
- Depends on: none

**TASK-013** | Priority: P0 | Effort: M | Owner: route-fixer
- What: Add `zValidator('json', ...)` to all 5 POST/PUT handlers in `tax-ext.ts` (lines 48, 80, 197, 252, 323)
- Why: CLAUDE.md rule 7 — 5 handlers all use raw `c.req.json()`
- Files: `server/src/routes/tax-ext.ts`
- Acceptance: 5 Zod schemas defined, 5 zValidator applied, `tsc --noEmit` passes
- Depends on: none

**TASK-014** | Priority: P0 | Effort: S | Owner: route-fixer
- What: Add `zValidator('json', ...)` to `admin-ext.ts` POST /cognee/index handler (line 15)
- Why: CLAUDE.md rule 7 — raw JSON read without validation
- Files: `server/src/routes/admin-ext.ts`
- Acceptance: Schema defined, zValidator applied, `tsc --noEmit` passes
- Depends on: none

**TASK-015** | Priority: P0 | Effort: S | Owner: route-fixer
- What: Replace `validateBody()` with `zValidator()` in `chat.ts` POST handler (line 82)
- Why: CLAUDE.md rule 7 — custom `validateBody()` duplicates `zValidator` functionality
- Files: `server/src/routes/chat.ts`
- Acceptance: `validateBody` import removed, zValidator applied, `c.req.valid('json')` used, `tsc --noEmit` passes
- Depends on: none

**TASK-016** | Priority: P0 | Effort: M | Owner: route-fixer
- What: Replace `parseBody()` with `zValidator()` in all 6 `agent-routes-extended/` sub-route files
- Why: CLAUDE.md rule 7 — `parseBody()` is a custom utility that duplicates zValidator
- Files: `routes-merchant.ts`, `routes-financial.ts`, `routes-tax.ts`, `routes-categorize.ts`, `routes-payroll.ts`, `routes-parse.ts`
- Acceptance: All 7 handlers use zValidator; `parseBody` import removed from all; `tsc --noEmit` passes
- Depends on: none

### Phase 3: Auth Hardening (P1) — 2 days

**TASK-017** | Priority: P1 | Effort: S | Owner: security-fixer
- What: Add `tenantAuthMiddleware` to `migration.ts` and `migration-ext.ts`
- Why: **CRITICAL** — migration endpoints executable without authentication
- Files: `server/src/routes/migration.ts`, `server/src/routes/migration-ext.ts`
- Acceptance: Both files import and apply `tenantAuthMiddleware` or `adminAuthMiddleware`; `tsc --noEmit` passes
- Depends on: none

**TASK-018** | Priority: P1 | Effort: S | Owner: security-fixer
- What: Add `tenantAuthMiddleware` to `batch-uploads.ts`
- Why: **HIGH** — arbitrary file upload endpoint without authentication
- Files: `server/src/routes/batch-uploads.ts`
- Acceptance: Middleware applied, `tsc --noEmit` passes
- Depends on: none

**TASK-019** | Priority: P1 | Effort: S | Owner: security-fixer
- What: Add `tenantAuthMiddleware` to `transfers.ts` and `transfers-ext.ts`
- Why: **HIGH** — money movement endpoints without authentication
- Files: `server/src/routes/transfers.ts`, `server/src/routes/transfers-ext.ts`
- Acceptance: Middleware applied, `tsc --noEmit` passes
- Depends on: none

**TASK-020** | Priority: P1 | Effort: S | Owner: security-fixer
- What: Add `tenantAuthMiddleware` to `payroll.ts`
- Why: **HIGH** — employee PII exposure without authentication
- Files: `server/src/routes/payroll.ts`
- Acceptance: Middleware applied, `tsc --noEmit` passes
- Depends on: none

**TASK-021** | Priority: P1 | Effort: S | Owner: security-fixer
- What: Add `tenantAuthMiddleware` to `agent-routes-extended.ts`, `agents-ext.ts`, `ai-agents.ts`
- Why: **HIGH** — AI agent endpoints without authentication allow LLM access
- Files: 3 route files
- Acceptance: Middleware applied to all 3, `tsc --noEmit` passes
- Depends on: none

**TASK-022** | Priority: P1 | Effort: S | Owner: security-fixer
- What: Add `tenantAuthMiddleware` to `charts.ts`, `dashboard.ts`, `reports.ts`
- Why: MEDIUM — financial data exposure without authentication
- Files: 3 route files
- Acceptance: Middleware applied to all 3, `tsc --noEmit` passes
- Depends on: none

**TASK-023** | Priority: P1 | Effort: S | Owner: security-fixer
- What: Add `tenantAuthMiddleware` to `settings.ts` and `stream-schema.ts`
- Why: MEDIUM — preference modification and schema access without authentication
- Files: 2 route files
- Acceptance: Middleware applied, `tsc --noEmit` passes
- Depends on: none

**TASK-024** | Priority: P1 | Effort: S | Owner: security-fixer
- What: Add `adminAuthMiddleware` to `admin-ext.ts` and `admin-auth-routes.ts` (non-login routes)
- Why: Admin endpoints should require admin-level authentication
- Files: 2 route files
- Acceptance: Admin middleware applied to non-public endpoints, `tsc --noEmit` passes
- Depends on: none

**TASK-025** | Priority: P2 | Effort: S | Owner: security-fixer
- What: Add `tenantAuthMiddleware` to `market-prices.ts` and `market-sentiment.ts`
- Why: LOW — market data is semi-public but should still be tenant-scoped
- Files: 2 route files
- Acceptance: Middleware applied, `tsc --noEmit` passes
- Depends on: none

### Phase 3b: parseInt Radix Fix (P1, Quick Win) — 0.5 days

**TASK-026** | Priority: P1 | Effort: S | Owner: code-quality
- What: Add radix 10 to all `parseInt()` calls in `account-misc.ts` (10 occurrences)
- Why: CLAUDE.md rule 9 — `parseInt()` without radix can produce unexpected results
- Files: `server/src/routes/account-misc.ts`
- Acceptance: All `parseInt(x)` → `parseInt(x, 10)`; `tsc --noEmit` passes
- Depends on: none

**TASK-027** | Priority: P1 | Effort: S | Owner: code-quality
- What: Add radix 10 to all `parseInt()` calls in `transfers-ext.ts` (8 occurrences)
- Why: CLAUDE.md rule 9
- Files: `server/src/routes/transfers-ext.ts`
- Acceptance: All `parseInt(x)` → `parseInt(x, 10)`; `tsc --noEmit` passes
- Depends on: none

**TASK-028** | Priority: P1 | Effort: S | Owner: code-quality
- What: Add radix 10 to `parseInt()` in `bas.ts` (lines 40-41), `tax-ext.ts` (lines 37-38), `tax.ts` (lines 63-64, 197-198)
- Why: CLAUDE.md rule 9
- Files: 3 route files
- Acceptance: All `parseInt(x)` → `parseInt(x, 10)`; `tsc --noEmit` passes
- Depends on: none

**TASK-029** | Priority: P1 | Effort: S | Owner: code-quality
- What: Add radix 10 to `parseInt()` in `market-prices.ts` (line 43), `market-sentiment.ts` (line 32), `pipeline.ts` (lines 244-245)
- Why: CLAUDE.md rule 9
- Files: 3 route files
- Acceptance: All `parseInt(x)` → `parseInt(x, 10)`; `tsc --noEmit` passes
- Depends on: none

### Phase 3c: Oversized File Splitting (P1) — 2 days

**TASK-030** | Priority: P1 | Effort: L | Owner: route-splitter
- What: Split `account-misc.ts` (797 lines) into `account-misc/` directory with sub-modules
- Why: CLAUDE.md file rule — no file >300 lines
- Files: `server/src/routes/account-misc.ts` → `server/src/routes/account-misc/` (index.ts + 3-4 sub-modules)
- Acceptance: Original file replaced with 1-line shim; all sub-modules <300 lines; `tsc --noEmit` passes
- Depends on: TASK-026 (parseInt fix should land first to avoid conflicts)

**TASK-031** | Priority: P1 | Effort: M | Owner: route-splitter
- What: Split `pipeline.ts` (428 lines) into `pipeline/` directory
- Why: CLAUDE.md file rule — >300 line limit
- Files: `server/src/routes/pipeline.ts` → `server/src/routes/pipeline/`
- Acceptance: Original file is 1-line shim; `tsc --noEmit` passes
- Depends on: TASK-029

**TASK-032** | Priority: P1 | Effort: M | Owner: route-splitter
- What: Split `chat.ts` (421 lines) into `chat/` directory
- Why: CLAUDE.md file rule — >300 line limit
- Files: `server/src/routes/chat.ts` → `server/src/routes/chat/`
- Acceptance: Original file is 1-line shim; `tsc --noEmit` passes
- Depends on: TASK-015

**TASK-033** | Priority: P1 | Effort: M | Owner: route-splitter
- What: Split `tax-ext.ts` (384 lines) into `tax-ext/` directory
- Why: CLAUDE.md file rule — >300 line limit
- Files: `server/src/routes/tax-ext.ts` → `server/src/routes/tax-ext/`
- Acceptance: Original file is 1-line shim; `tsc --noEmit` passes
- Depends on: TASK-013

**TASK-034** | Priority: P1 | Effort: M | Owner: route-splitter
- What: Split `tenants.ts` (353 lines) into `tenants/` directory
- Why: CLAUDE.md file rule — >300 line limit
- Files: `server/src/routes/tenants.ts` → `server/src/routes/tenants/`
- Acceptance: Original file is 1-line shim; `tsc --noEmit` passes
- Depends on: none

**TASK-035** | Priority: P1 | Effort: M | Owner: route-splitter
- What: Split `invoicing-routes.ts` (347 lines) into `invoicing/` directory
- Why: CLAUDE.md file rule — >300 line limit
- Files: `server/src/routes/invoicing-routes.ts` → `server/src/routes/invoicing/`
- Acceptance: Original file is 1-line shim; `tsc --noEmit` passes
- Depends on: none

**TASK-036** | Priority: P2 | Effort: S | Owner: route-splitter
- What: Split `accounts.ts` (310 lines) into `accounts/` directory
- Why: CLAUDE.md file rule — marginally over 300 line limit
- Files: `server/src/routes/accounts.ts` → `server/src/routes/accounts/`
- Acceptance: Original file is 1-line shim; `tsc --noEmit` passes
- Depends on: none

**TASK-037** | Priority: P2 | Effort: S | Owner: route-splitter
- What: Split `bas.ts` (304 lines) into `bas/` directory
- Why: CLAUDE.md file rule — marginally over 300 line limit
- Files: `server/src/routes/bas.ts` → `server/src/routes/bas/`
- Acceptance: Original file is 1-line shim; `tsc --noEmit` passes
- Depends on: TASK-028

### Phase 4: Native Neon Migration (P1, Break the wrapPgDb Proxy) — 8-12 days

**TASK-038** | Priority: P1 | Effort: S | Owner: schema-migrator
- What: Create `server/src/schema/pg-helpers.ts` with shared PG column definitions (timestamps, uuid primary key, tenant_id, etc.)
- Why: Avoid repeating common column patterns across 17 schema files during migration
- Files: NEW `server/src/schema/pg-helpers.ts`
- Acceptance: Helper functions exported; `tsc --noEmit` passes
- Depends on: TASK-004

**TASK-039** | Priority: P1 | Effort: M | Owner: schema-migrator
- What: Migrate `schema/ui.ts` (3 tables, LOW complexity) from `sqliteTable()` to `pgTable()`
- Why: Smallest schema file — proves the migration pattern before tackling larger files
- Files: `server/src/schema/ui.ts` + all consumers (dashboards, charts routes)
- Acceptance: All 3 tables use `pgTable()`; `InferSelectModel`/`InferInsertModel` types exported; `.get()`/`.all()`/`.run()` removed from consumers; `tsc --noEmit` passes
- Depends on: TASK-038

**TASK-040** | Priority: P1 | Effort: M | Owner: schema-migrator
- What: Migrate `schema/pwa.ts` (4 tables, LOW complexity) from `sqliteTable()` to `pgTable()`
- Why: Self-contained schema with few cross-references — low risk pilot
- Files: `server/src/schema/pwa.ts` + consumers
- Acceptance: All 4 tables use `pgTable()`; `tsc --noEmit` passes
- Depends on: TASK-039 (pattern proven)

**TASK-041** | Priority: P1 | Effort: M | Owner: schema-migrator
- What: Migrate `schema/agents.ts` (4 tables, LOW complexity) from `sqliteTable()` to `pgTable()`
- Files: `server/src/schema/agents.ts` + agent monitoring service
- Acceptance: `pgTable()`, type exports, `tsc --noEmit` passes
- Depends on: TASK-039

**TASK-042** | Priority: P1 | Effort: M | Owner: schema-migrator
- What: Migrate `schema/documents.ts` (6 tables, LOW complexity) from `sqliteTable()` to `pgTable()`
- Files: `server/src/schema/documents.ts` + OCR/matching services
- Acceptance: `pgTable()`, type exports, `tsc --noEmit` passes
- Depends on: TASK-039

**TASK-043** | Priority: P1 | Effort: M | Owner: schema-migrator
- What: Migrate `schema/banking.ts` (5 tables, LOW complexity) from `sqliteTable()` to `pgTable()`
- Files: `server/src/schema/banking.ts` + CDR services
- Acceptance: `pgTable()`, type exports, `tsc --noEmit` passes
- Depends on: TASK-039

**TASK-044** | Priority: P1 | Effort: L | Owner: schema-migrator
- What: Migrate `schema/cognee.ts` (10 tables, LOW-MEDIUM complexity) from `sqliteTable()` to `pgTable()`
- Files: `server/src/schema/cognee.ts` + Cognee services
- Acceptance: `pgTable()`, type exports, `tsc --noEmit` passes
- Depends on: TASK-039

**TASK-045** | Priority: P1 | Effort: L | Owner: schema-migrator
- What: Migrate `schema/core.ts` (5 tables, HIGH complexity) from `sqliteTable()` to `pgTable()`
- Why: Core tables (users, accounts, transactions, statements, settings) are referenced by almost every service
- Files: `server/src/schema/core.ts` + 50+ consumer files
- Acceptance: `pgTable()`, type exports, ALL consumers updated, `tsc --noEmit` passes
- Depends on: TASK-039, TASK-040, TASK-041, TASK-042 (pattern well-proven)

**TASK-046** | Priority: P1 | Effort: XL | Owner: schema-migrator
- What: Migrate remaining 10 schema files (`tax.ts`, `payables.ts`, `accounting.ts`, `reporting.ts`, `multitenant.ts`, `analytics.ts`, `invoicing.ts`, `payroll.ts`, `transactions.ts`, `teams.ts`) from `sqliteTable()` to `pgTable()`
- Why: Complete the migration — each file follows the pattern proven in TASK-039 through TASK-045
- Files: 10 schema files + all their consumers
- Acceptance: Zero `sqliteTable()` calls remaining in codebase; `tsc --noEmit` passes
- Depends on: TASK-045

**TASK-047** | Priority: P1 | Effort: M | Owner: schema-migrator
- What: Remove `wrapPgDb()` and `addSqliteCompat()` from `schema/connection.ts`; export typed `db` directly from Drizzle
- Why: After all consumers are migrated off `.get()`/`.all()`/`.run()`, the proxy is dead code
- Files: `server/src/schema/connection.ts`
- Acceptance: `wrapPgDb` function deleted; `db` has real Drizzle type (not `any`); `grep -r 'wrapPgDb' server/src/` returns 0; `tsc --noEmit` passes
- Depends on: TASK-046

### Phase 5: Production Hardening (P2) — 2-3 days

**TASK-048** | Priority: P2 | Effort: S | Owner: ops-engineer
- What: Add `DB_POOL_MAX` and `DB_POOL_MIN` env vars to Docker compose and server/.env.example
- Why: Pool size should be configurable without code changes
- Files: `docker-compose.yml`, `server/.env.example`
- Acceptance: Env vars documented and wired; neon-connection.ts already reads them
- Depends on: TASK-004

**TASK-049** | Priority: P2 | Effort: M | Owner: ops-engineer
- What: Add connection pool metrics endpoint at `GET /api/admin/pool-stats`
- Why: Monitor pool utilization (totalCount, idleCount, waitingCount) for capacity planning
- Files: `server/src/routes/admin-ext.ts` or new route file
- Acceptance: Endpoint returns JSON with pool stats for both production and masked pools; `tsc --noEmit` passes
- Depends on: TASK-004, TASK-005

**TASK-050** | Priority: P2 | Effort: L | Owner: security-fixer
- What: Add Row-Level Security (RLS) policies to tenant-scoped tables
- Why: Defense-in-depth — even if application middleware is bypassed, DB enforces tenant isolation
- Files: New migration SQL, `server/src/schema/multitenant.ts`
- Acceptance: RLS policies active on `accounts`, `transactions`, `statements` tables; cross-tenant query returns empty set; `tsc --noEmit` passes
- Depends on: TASK-046 (requires pgTable migration)

**TASK-051** | Priority: P2 | Effort: S | Owner: ops-engineer
- What: Add connection error retry with exponential backoff to `neon-connection.ts`
- Why: Neon cold-start can cause first-connection failures; retry prevents 500 errors
- Files: `server/src/db/neon-connection.ts`
- Acceptance: Pool creation retries up to 3 times with 1s/2s/4s backoff; `tsc --noEmit` passes
- Depends on: TASK-004

**TASK-052** | Priority: P2 | Effort: M | Owner: ops-engineer
- What: Add Drizzle prepared statements for the 10 most-executed queries (transaction list, account balance, BAS totals, etc.)
- Why: 10-30% performance improvement on hot paths by avoiding repeated query planning
- Files: `server/src/db/prepared-queries.ts` (new), consuming route files
- Acceptance: 10 prepared statements defined and used; benchmark shows measurable improvement; `tsc --noEmit` passes
- Depends on: TASK-047

---

## 5. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `wrapPgDb()` removal breaks all queries | **High** | **Critical** | Incremental file-by-file migration with `tsc --noEmit` gate after every change. Keep proxy alive until all consumers migrated. |
| `sqliteTable()` → `pgTable()` column type mismatches | **High** | **High** | Pilot with smallest schema files first (ui.ts, pwa.ts). Run Drizzle migration diff to catch type mismatches. |
| Two concurrent pg.Pool instances exceed Neon connection limits | **Medium** | **High** | TASK-004 consolidates to single pool management. Monitor pool stats via TASK-049. |
| Auth middleware addition breaks existing client integrations | **Medium** | **Medium** | Add auth middleware with `optional: true` flag initially; switch to required after client updated. |
| zValidator rejection on currently-accepted malformed requests | **Medium** | **Medium** | Audit client code to ensure request shapes match new Zod schemas before deploying. |
| Drizzle migration generates destructive ALTER TABLE | **Low** | **Critical** | Always run `drizzle-kit generate` in dry-run mode first. Review SQL before applying. Backup via Neon branching. |
| Phase 4 migration takes longer than estimated due to hidden `.get()/.all()/.run()` usage | **High** | **Medium** | Track all proxy method usage with `grep` before starting. Maintain a checklist of every consumer file. |
| RLS policies lock out application queries if session variable not set | **Medium** | **High** | Test RLS in Neon branch first. Add `SET app.tenant_id` to pool `on('connect')` handler. |

---

## 6. Verification Gates

### Phase 1 Gate
```bash
# No deprecated files remain
ls server/src/db/index.ts server/src/db/postgres-connection.ts server/src/db/postgres-exports.ts 2>&1 | grep "No such file"

# Single pool management (schema/connection.ts imports from neon-connection)
grep -c "neon-connection" server/src/schema/connection.ts  # should be >= 1

# tsc clean
cd server && npx tsc --noEmit  # 0 errors

# Docker health
docker compose up -d && sleep 10 && curl -s http://localhost:3501/health | jq .status  # "ok"
```

### Phase 2 Gate
```bash
# No raw c.req.json() in route POST/PATCH/PUT handlers
grep -rn 'c\.req\.json()' server/src/routes/ --include='*.ts' | wc -l  # should be 0

# zValidator present in all route files with mutation handlers
grep -rL 'zValidator' server/src/routes/ --include='*.ts' | \
  xargs grep -l 'app\.\(post\|put\|patch\|delete\)' 2>/dev/null  # should be empty

# tsc clean
cd server && npx tsc --noEmit  # 0 errors
```

### Phase 3 Gate
```bash
# tenantAuthMiddleware coverage
grep -rL 'tenantAuthMiddleware\|adminAuthMiddleware' server/src/routes/ --include='*.ts' | \
  grep -v 'api-auth\|auth-routes' | wc -l  # should be 0 (excluding intentionally public)

# parseInt radix
grep -rn 'parseInt([^,)]*)[^,]' server/src/routes/ --include='*.ts' | wc -l  # should be 0

# No file >300 lines
find server/src/routes/ -name '*.ts' -exec wc -l {} + | awk '$1 > 300 {print}' | grep -v total  # should be empty

# tsc clean
cd server && npx tsc --noEmit  # 0 errors
```

### Phase 4 Gate
```bash
# No sqliteTable() remaining
grep -rn 'sqliteTable' server/src/schema/ --include='*.ts' | wc -l  # should be 0

# No wrapPgDb() remaining
grep -rn 'wrapPgDb' server/src/ --include='*.ts' | wc -l  # should be 0

# No .get()/.all()/.run() on db queries
grep -rn '\.get()\|\.all()\|\.run()' server/src/routes/ server/src/services/ --include='*.ts' | wc -l  # should be 0

# db export has real type (not any)
grep 'export const db' server/src/schema/connection.ts  # should show typed declaration

# tsc clean
cd server && npx tsc --noEmit  # 0 errors
cd client && npx tsc --noEmit  # 0 errors
```

### Phase 5 Gate
```bash
# Pool stats endpoint works
curl -s http://localhost:3501/api/admin/pool-stats | jq .production.status  # "healthy"

# RLS active (if implemented)
psql $NEON_DATABASE_URL -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';"

# Full Docker health
docker compose ps --format '{{.Name}} {{.Status}}' | grep -v healthy | wc -l  # should be 0

# Final tsc
cd server && npx tsc --noEmit  # 0 errors
cd client && npx tsc --noEmit  # 0 errors
```

---

## Appendix A: Full Route Audit Table

| # | File | Lines | zValidator | tenantAuth | POST/PUT/PATCH | parseInt Radix | Notes |
|---|------|-------|-----------|------------|---------------|---------------|-------|
| 1 | account-misc.ts | 797 | yes | yes (via transfers-ext) | 1 | **MISSING x10** | SPLIT REQUIRED |
| 2 | accounts.ts | 310 | yes | yes | 3 | ok | SPLIT (marginal) |
| 3 | admin-auth-routes.ts | ~120 | yes | **no** | 2 | ok | Needs adminAuth |
| 4 | admin-ext.ts | ~80 | **no** | **no** | 1 | ok | Needs zValidator + adminAuth |
| 5 | agent-routes-extended/ | ~300 | **parseBody** | yes (index.ts) | 7 | ok | Replace parseBody with zValidator |
| 6 | agent-streaming.ts | ~150 | yes | yes | 1 | ok | OK |
| 7 | agents.ts | ~200 | yes | yes | 2 | ok | OK |
| 8 | agents-ext.ts | ~100 | yes | **no** | 1 | ok | Needs tenantAuth |
| 9 | ai-agents.ts | ~150 | yes | **no** | 2 | ok | Needs tenantAuth |
| 10 | analytics.ts | ~100 | yes | yes | 0 | ok | OK |
| 11 | ap-extras.ts | ~80 | yes | yes | 1 | ok | OK |
| 12 | api-auth.ts | ~120 | yes | **public** | 2 | ok | Intentionally public |
| 13 | auth-routes.ts | ~100 | yes | **public** | 2 | ok | Intentionally public |
| 14 | bas.ts | 304 | yes | yes | 1 | **MISSING x2** | SPLIT (marginal), fix parseInt |
| 15 | batch-uploads.ts | ~150 | yes | **no** | 2 | ok | Needs tenantAuth |
| 16 | bills.ts | ~200 | yes | yes | 3 | ok | OK |
| 17 | budgets.ts | ~180 | yes | yes | 3 | ok | OK |
| 18 | charts.ts | ~60 | **no** | **no** | 1 | ok | Needs zValidator + tenantAuth |
| 19 | chat.ts | 421 | **custom** | yes | 1 | ok | SPLIT REQUIRED, replace validateBody |
| 20 | cognee.ts | ~120 | yes | yes | 2 | ok | OK |
| 21 | dashboard.ts | ~100 | yes | **no** | 0 | ok | Needs tenantAuth |
| 22 | invitations-ext.ts | ~40 | **no** | yes | 1 | ok | Needs zValidator |
| 23 | invoicing-routes.ts | 347 | yes | yes | 5 | ok | SPLIT REQUIRED |
| 24 | market-alerts.ts | ~80 | yes | yes | 1 | ok | OK |
| 25 | market-calendar.ts | ~80 | yes | yes | 0 | ok | OK |
| 26 | market-feeds.ts | ~100 | yes | yes | 1 | ok | OK |
| 27 | market-indicators.ts | ~100 | yes | yes | 0 | ok | OK |
| 28 | market-prices.ts | ~80 | yes | **no** | 0 | **MISSING x1** | Needs tenantAuth, fix parseInt |
| 29 | market-sentiment.ts | ~60 | yes | **no** | 0 | **MISSING x1** | Needs tenantAuth, fix parseInt |
| 30 | members.ts | ~120 | yes | yes | 2 | ok | OK |
| 31 | merchant-ops.ts | ~269 | yes | yes | 2 | ok | OK (under 300) |
| 32 | migration.ts | ~80 | **no** | **no** | 1 | ok | CRITICAL: Needs auth + zValidator |
| 33 | migration-ext.ts | ~60 | **no** | **no** | 1 | ok | CRITICAL: Needs auth + zValidator |
| 34 | misc.ts | ~100 | yes | yes | 0 | ok | OK |
| 35 | payroll.ts | ~200 | yes | **no** | 3 | ok | Needs tenantAuth |
| 36 | pipeline.ts | 428 | yes | yes | 3 | **MISSING x2** | SPLIT REQUIRED, fix parseInt |
| 37 | purchase-orders.ts | ~250 | yes | yes | 4 | ok | OK |
| 38 | reports.ts | ~200 | yes | **no** | 0 | ok | Needs tenantAuth |
| 39 | settings.ts | ~80 | yes | **no** | 1 | ok | Needs tenantAuth |
| 40 | statements.ts | ~150 | yes | yes | 1 | ok | OK |
| 41 | stream-schema.ts | ~120 | **no** | **no** | 1 | ok | Needs zValidator + tenantAuth |
| 42 | stream-sessions.ts | ~120 | **no** | yes | 1 | ok | Needs zValidator |
| 43 | subscriptions.ts | ~150 | yes | yes | 2 | ok | OK |
| 44 | suppliers.ts | ~180 | yes | yes | 3 | ok | OK |
| 45 | tax.ts | ~220 | yes | yes | 2 | **MISSING x4** | Fix parseInt |
| 46 | tax-ext.ts | 384 | **no** | yes | 5 | **MISSING x2** | SPLIT REQUIRED, needs zValidator x5 |
| 47 | tenants.ts | 353 | yes | yes | 4 | ok | SPLIT REQUIRED |
| 48 | transactions.ts | ~250 | yes | yes | 2 | ok | OK |
| 49 | transfers.ts | ~150 | yes | **no** | 2 | ok | Needs tenantAuth |
| 50 | transfers-ext.ts | ~265 | yes | **no** | 1 | **MISSING x8** | Needs tenantAuth, fix parseInt |
| 51 | invitations-ext.ts | ~40 | **no** | yes | 1 | ok | Needs zValidator |

---

## Appendix B: DB File Inventory

| File | Path | Lines | Status | Purpose | Used By |
|------|------|-------|--------|---------|---------|
| connection.ts | schema/ | 117 | **CANONICAL** | Single pg.Pool + wrapPgDb proxy → `db` (typed as `any`) | ALL routes and services (via schema/index.ts) |
| neon-connection.ts | db/ | 292 | **BUILT, UNUSED** | Dual-pool (production + AI masked) with typed Drizzle | Health check endpoint only |
| index.ts | db/ | ~80 | **DEPRECATED** | SQLite/PG switcher (dynamic import) | Nothing — safe to delete |
| postgres-connection.ts | db/ | ~60 | **LEGACY** | Single PG pool (old approach) | postgres-exports.ts only |
| postgres-exports.ts | db/ | ~10 | **LEGACY** | Re-exports postgres-connection | postgres-schema.ts only |
| postgres-schema.ts | db/ | ~5 | **SHIM** | 2-line barrel re-export | neon-connection.ts (needs redirect) |
| pg-db.ts | db/ | ~40 | **ACTIVE** | SQLite placeholder converter (.get/.all/.run) | 3 services |
| typed-queries.ts | db/ | ~200 | **ACTIVE** | ProxiedQueryChain typed query builders | Multiple services |
| validate-schema.ts | db/ | ~80 | **ACTIVE** | Schema validation utility | Admin routes |
| admin-schema.ts | db/ | ~50 | **UNKNOWN** | Admin-specific schema (may be duplicate) | Needs audit |
| cdr-schema.ts | db/ | ~50 | **UNKNOWN** | CDR-specific schema (may be duplicate) | Needs audit |
| market-schema.ts | db/ | ~50 | **UNKNOWN** | Market-specific schema (may be duplicate) | Needs audit |
| SCHEMA_VALIDATION_REPORT.md | db/ | — | **DOCS** | Validation report artifact | Nothing — safe to delete |
| TYPE_SAFETY_SUMMARY.md | db/ | — | **DOCS** | Type safety report artifact | Nothing — safe to delete |
| queries/ | db/ | — | **ACTIVE** | Query type definitions | typed-queries.ts |
