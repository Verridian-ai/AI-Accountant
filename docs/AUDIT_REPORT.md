# GoldLedger Audit Report — 2026-02-19

**Audit Lead**: audit-lead
**Team**: goldledger-audit (6 specialist agents in parallel)
**Scope**: Full codebase — TypeScript, Security, Routes, Schema, Services, Client, SQLite Assessment
**Status**: COMPLETE — 5/6 agents reported (audit-client: no report received)

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 11 |
| HIGH | 21 |
| MEDIUM | 22 |
| LOW | 14 |
| **TOTAL** | **68** |

**Overall Health**: ⚠️ NEEDS WORK — Server has 40 TS build errors, 2 security vulnerabilities (unprotected admin endpoint + raw SQL template), 26 routes missing input validation, and 8 DB tables missing tenantId.

---

## Key Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Server TS errors | **40** | 0 | ❌ |
| Client TS errors | **0** | 0 | ✅ |
| `: any` count | **8** | <50 | ✅ |
| `as any` count | **0** | 0 | ✅ |
| `@ts-ignore` count | **0** | 0 | ✅ |
| Files >300 lines | **19+** | 0 | ❌ |
| Route files | **60** (incl. subdirs) | — | — |
| Routes missing zValidator | **26/48** mutation routes | 0 | ❌ |
| Routes missing tenantAuthMiddleware | **15** | 0 | ❌ |
| parseInt without radix | **61** server / **23** routes | 0 | ❌ |
| Unsafe c.req.param()/query() | **240+** | 0 | ❌ |
| console.log in services | **123** | 0 | ❌ |
| Tables missing tenantId | **8** | 0 | ❌ |
| Monetary real() columns | **2** | 0 | ❌ |
| DB indexes for 134 tables | **9 (6.7%)** | high | ⚠️ |
| Routes registered | **All** | All | ✅ |
| Security headers wired | Yes | Yes | ✅ |
| Rate limiter wired | Partial | Full | ⚠️ |

---

## 1. TypeScript Health

### CRITICAL — 40 Server Build Errors (Regression)

All 40 errors are schema mismatch — multiple services use fields that do not exist in the inferred Drizzle types. This is a regression from Phase A (0 errors), caused by new service files added without matching schema updates.

**Affected file groups and missing fields:**

| Group | Files | Missing Fields |
|-------|-------|----------------|
| Invoice PDF | `services/invoice-pdf/invoice-pdf-service.ts` (25 errors), `services/invoice-pdf/pdf-sections.ts` (8 errors) | `issueDate`, `termsAndConditions`, `notes`, `amountDue`, `amountPaid`, `contactName`, `businessName`, `city`, `state`, `postcode` |
| Customer service | `services/customers/customer-queries.ts`, `services/customers/customer-service.ts` | `businessName`, `contactName`, `amountDue` |
| Bills payments | `services/bills/payment-tracking.ts` | `transactionId`, `issueDate`, `amountDue`, `businessName` |
| Agent routes | `routes/agent-routes-extended/routes-payroll.ts:23`, `routes-tax.ts:61`, `routes/suppliers.ts:48` | `quarter` on PayrollAgentInput, `occupation` on PersonalTaxClaimsInput, CreateSupplierInput shape mismatch |

**Root fix**: Add missing columns to `schema/invoicing.ts` and `schema/payables.ts`, then add missing fields to customer schema.

### HIGH — Policy Violations

| # | Issue | Count | Files |
|---|-------|-------|-------|
| H-TS1 | `parseInt()` without radix 10 | 61 | Routes-wide (worst: `account-misc.ts` lines 422–453, 8 calls) |
| H-TS2 | `: any` violations | 8 | `schema/connection.ts` (3 — irreducible wrapPgDb), `cognee-cloud/client.ts`, `customers/customer-queries.ts` (2), `customers/customer-service.ts` (2) |
| H-TS3 | Hardcoded localhost URLs | 3 | `index.ts:90` (CORS), `cognee-admin/dataset-ops.ts:90` (Cognee base), `client/features/transactions/hooks/useLedgerData.ts:21` (comment) |

### MEDIUM

| # | Files | Issue |
|---|-------|-------|
| M-TS1 | 19 files >300 lines | Server: account-misc.ts (797L), cba-credit.ts (695L), cognee_client/client.ts (622L). Client: App.tsx (569L), LedgerTableColumns.tsx (521L), CalculateTab.tsx (509L). See full list in Services section. |

### Note on Remaining `: any`
`schema/connection.ts` contains 3 `: any` in `wrapPgDb()`/`addSqliteCompat()` — these are documented as irreducible (proxy pattern requires runtime `any`). The 5 in customer services CAN be typed with `DbInstance` interface.

---

## 2. Security Posture

### CRITICAL — Unprotected Admin Endpoint (Verified)

**File**: `server/src/routes/admin-ext.ts:9`

```typescript
// ❌ NO AUTH — anyone can call this
adminExtRoutes.post('/admin/ingest-knowledge', async (c) => {
  const { datasetName } = await c.req.json();
  // Reads all .md files from knowledge/ dir, injects into Cognee
```

**Registered at**: `app.route('/api', adminExtRoutes)` → accessible as `POST /api/admin/ingest-knowledge`

**Impact**: Unauthenticated users can inject arbitrary data into Cognee knowledge base, poisoning AI responses.

**Fix** (2 lines):
```typescript
import { tenantAuthMiddleware } from '../services/auth-middleware.js';
adminExtRoutes.use('/*', tenantAuthMiddleware());
```

### HIGH — Raw SQL Template in Streaming Route

**File**: `server/src/routes/agent-streaming.ts:56`

```typescript
// ⚠️ Raw sql template — Drizzle parameterizes values, but pattern is risky
const session = await db.get(
  sql`SELECT * FROM agent_stream_sessions WHERE id = ${c.req.param('sessionId')}`,
);
```

**Assessment**: Drizzle's `sql` tagged template DOES parameterize values (not raw string concat), so classical SQL injection is lower risk. However: (1) this uses `db.get()` which bypasses Drizzle ORM type safety, (2) sessionId is unvalidated, (3) inconsistent with codebase pattern.

**Fix**: Convert to Drizzle query builder:
```typescript
const session = await db.select().from(agentStreamSessions)
  .where(eq(agentStreamSessions.id, c.req.param('sessionId'))).limit(1);
```

### HIGH — Path Traversal Risk (Lower Severity Than Reported)

**File**: `server/src/routes/admin-ext.ts:23-26`

```typescript
for (const file of files) {  // files from readdirSync — NOT user input
  const filePath = path.join(knowledgeDir, file);
```

**Assessment**: Lower risk than initially flagged. The file list comes from `readdirSync(knowledgeDir)` (OS-controlled), not from user input. `datasetName` only controls the Cognee dataset name string. However, the unprotected endpoint (above) is what makes this dangerous — an attacker calling the endpoint can still trigger Cognee ingestion of all knowledge files without auth.

### HIGH — JWT Null Guard Violations (13 instances)

**File**: `server/src/routes/account-misc.ts` — lines 83, 142, 169, 201, 232, 256, 317, 367, 399, 486, 543, 679, 692

```typescript
// ❌ Pattern found 13 times:
const payload = c.get('jwtPayload');
const userId = payload.userId;  // crashes if payload is undefined

// ✅ Required pattern:
const payload = c.get('jwtPayload') as { userId?: string } | undefined;
if (!payload?.userId) return c.json({ error: 'Unauthorized' }, 401);
```

**Rule violated**: CLAUDE.md Rule #8 — "All JWT payload access MUST have null guard"

### HIGH — 15 Routes Missing tenantAuthMiddleware

Routes that should be protected but are not applying tenant middleware:

| Route File | Risk Level | Notes |
|------------|-----------|-------|
| `admin-ext.ts` | 🔴 CRITICAL | Admin endpoint completely exposed |
| `agent-routes-extended.ts` | 🔴 HIGH | AI agent invocation exposed |
| `ap-extras.ts` | 🔴 HIGH | Financial mutations (void/cancel) exposed |
| `charts.ts` | 🟠 MEDIUM | Analytics data exposed |
| `chat.ts` | 🟠 MEDIUM | AI chat exposed |
| `invitations-ext.ts` | 🟠 MEDIUM | Invitation handling exposed |
| `merchant-ops.ts` | 🟠 MEDIUM | Merchant data exposed |
| `migration-ext.ts` | 🔴 HIGH | Migration triggers exposed |
| `stream-schema.ts` | 🟠 MEDIUM | Schema data exposed |
| `stream-sessions.ts` | 🟠 MEDIUM | Session data exposed |
| `tax-ext.ts` | 🟠 MEDIUM | Tax data exposed |
| `admin-auth-routes.ts` | ✅ Intentional | Public auth endpoints |
| `api-auth.ts` | ✅ Intentional | Public auth endpoints |
| `auth-routes.ts` | ✅ Intentional | Public auth endpoints |
| `account-misc.ts` | ⚠️ Mixed | Some endpoints intentionally public |

### MEDIUM

| # | Issue |
|---|-------|
| M-SEC1 | Rate limiter NOT applied to `/api/admin/*` or streaming routes — only general/chat/auth routes are covered |
| M-SEC2 | `index.ts:90` hardcoded `'http://localhost:8080'` in CORS allowlist — use `process.env.CLIENT_URL` |
| M-SEC3 | `migration.ts` and `migration-ext.ts` mutation handlers have no zValidator — unvalidated migration triggers |

### POSITIVE FINDINGS ✅

- OWASP security headers wired via `securityHeaders()` middleware ✅
- Audit logging middleware active on `/api/*` and `/auth/*` ✅
- Dynamic CORS allowlist (not `*`), credentials flag correct ✅
- All API keys sourced from `process.env` — zero hardcoded secrets ✅
- Body size limits: 10MB global + 100KB on `/api/chat` ✅
- Admin auth: JWT + bcrypt + token verification ✅
- `@ts-ignore` count: 0 ✅

---

## 3. API Routes Quality

### CRITICAL — 26 Mutation Routes Missing zValidator

All POST/PUT/PATCH handlers require `zValidator`. Missing on:

**Agent Routes** (`routes-extended/` subdirectory) — Prompt injection risk:
- `routes-categorize.ts:8` POST `/agents/categorize`
- `routes-financial.ts:8` POST `/agents/financial-plan`
- `routes-merchant.ts:8` POST `/agents/merchant-intel`
- `routes-parse.ts:8` POST `/agents/parse`
- `routes-payroll.ts:8` POST `/agents/payroll/calculate`
- `routes-tax.ts:8` POST `/agents/tax/strategy`
- `routes-tax.ts:46` POST `/agents/tax/claims`

**Financial/Business Routes** — Data integrity risk:
- `batch-uploads.ts:18` POST `/` (file upload)
- `batch-uploads.ts:47,51` POST `/:jobId/cancel`, `/:jobId/retry`
- `ap-extras.ts:20` POST `/bills/:id/void`
- `ap-extras.ts:31` POST `/purchase-orders/:id/cancel`
- `invoicing-routes.ts:243` POST `/invoices/:id/send`
- `invoicing-routes.ts:262` POST `/invoices/:id/void`
- `transfers.ts:25` POST `/detect` (financial transfers!)
- `migration.ts` — all mutation handlers
- `migration-ext.ts` — all mutation handlers

**Admin/Config Routes**:
- `admin-ext.ts:9` POST `/admin/ingest-knowledge`
- `admin-auth-routes.ts:37` POST `/refresh`
- `charts.ts:21` POST `/`
- `invitations-ext.ts:17` POST `/invitations/accept`
- `bills.ts:102` POST `/:id/approve`
- `market-feeds.ts:23` POST `/refresh`
- `market-feeds.ts:43` POST `/:feedId/refresh`
- `agent-streaming.ts:62` POST `/confirm/:actionId`
- `auth-routes.ts:108` POST `/refresh`

### HIGH — 240+ Unsafe Parameter Access

`c.req.param()` and `c.req.query()` used without type validation across 30+ routes. Values fed directly into:
- `parseInt()` without radix
- DB queries as filters
- Agent input objects

Key examples:
- `ai-agents.ts:53` — `c.req.param('type')` passed as AgentType without enum check
- `market-prices.ts:43` — `parseInt(c.req.query('days') ?? '30')` — no radix, no bounds check
- `account-misc.ts:422–453` — 8 `parseInt()` calls without radix on ID fields

### HIGH — Oversized Route Files

| File | Lines | Action |
|------|-------|--------|
| `routes/account-misc.ts` | **797** | Split into 3-4 modules |
| `routes/chat.ts` | **421** | Extract SSE handling, validation |
| `routes/pipeline.ts` | **428** | Extract stage handlers |
| `routes/tax-ext.ts` | **384** | Split by tax domain |
| `routes/tenants.ts` | **353** | Split member/invite/settings |
| `routes/invoicing-routes.ts` | **347** | Split invoice/payment/PDF |
| `routes/accounts.ts` | **310** | Extract balance/transfer handlers |

### MEDIUM

| # | Issue |
|---|-------|
| M-RT1 | `chat.ts` uses custom `validateBody()` instead of `zValidator` — inconsistent pattern |
| M-RT2 | `agent-streaming.ts:62` POST `/confirm/:actionId` — no zValidator on confirmation mutations |
| M-RT3 | `authRoutes` registered at `/auth` instead of `/api/auth` — inconsistent (check if intentional SSO path) |

### POSITIVE ✅

- All 60 route files (incl. subdirectory routes) imported and registered ✅
- Hono sub-app pattern used consistently ✅
- Most business routes apply `tenantAuthMiddleware` ✅
- Rate limiting applied to auth, chat, and general routes ✅

---

## 4. Database Schema Quality

### Architecture Note (IMPORTANT)

**`sqliteTable()` is intentional architecture** — `wrapPgDb()` in `schema.ts` proxies PostgreSQL to accept the SQLite Drizzle API. All 20 schema files use `sqliteTable()` from `drizzle-orm/sqlite-core`. **Do NOT migrate to `pgTable()` without a full migration plan.**

### CRITICAL — Monetary Columns as Float

| File | Lines | Column | Fix |
|------|-------|--------|-----|
| `schema/analytics.ts` | 83 | `amountDue: real('amount_due')` | → `integer('amount_due')` |
| `schema/analytics.ts` | 84 | `amountPaid: real('amount_paid')` | → `integer('amount_paid')` |

All other `real()` usage is appropriate: confidence scores (0–1.0), tax rates (%), quantities (fractional units), interest rates (%), hours per week.

### HIGH — 8 Tables Missing tenantId Entirely

Multi-tenant isolation requires `tenantId` on all user-facing data tables. Missing from:

| Table | File | Risk |
|-------|------|------|
| `customerContacts` | `schema/invoicing.ts` | Cross-tenant contact leakage |
| `billPayments` | `schema/payables.ts` | Cross-tenant payment leakage |
| `purchaseOrders` | `schema/payables.ts` | Cross-tenant PO leakage |
| `poLines` | `schema/payables.ts` | Cross-tenant PO line leakage |
| `poReceipts` | `schema/payables.ts` | Cross-tenant receipt leakage |
| `poReceiptLines` | `schema/payables.ts` | Cross-tenant receipt leakage |
| `supplierPaymentRuns` | `schema/payables.ts` | Cross-tenant payment run leakage |
| `supplierPaymentRunItems` | `schema/payables.ts` | Cross-tenant item leakage |

**Fix**: Add `tenantId: text('tenant_id').notNull()` to all 8 tables.

### HIGH — tenantId Fields Nullable (Should Be .notNull())

`customers`, `invoices`, `suppliers`, `bills` in `invoicing.ts` and `payables.ts` have `tenantId` defined but without `.notNull()`. This allows NULL tenant data to be inserted.

### HIGH — Missing onDelete Cascade on Child FK References

| Parent | Child | File | Fix |
|--------|-------|------|-----|
| `bills` | `billPayments` | `payables.ts` | Add `{ onDelete: 'cascade' }` |
| `purchaseOrders` | `poReceipts` | `payables.ts` | Add `{ onDelete: 'cascade' }` |

### MEDIUM — Schema Stats

| Metric | Value |
|--------|-------|
| Total tables | **134+** across 20 schema files + 3 db/ files |
| Total FK references | 154 defined |
| Missing FK references | 0 ✅ |
| Total indexes | **9 (6.7% coverage)** |
| Missing tenantId indexes | 4+ (customers, invoices, bills, suppliers) |

**9 indexes for 134 tables is critically low** — all `.tenantId` columns on frequently queried tables need composite indexes for multi-tenant query performance.

---

## 5. Services Quality

### CRITICAL

| # | File | Line | Issue |
|---|------|------|-------|
| C-SVC1 | `services/invoice-pdf/invoice-pdf-service.ts` | 121–209 | Broken at compile time (see TS section) |
| C-SVC2 | `services/invoice-pdf/pdf-sections.ts` | 72–226 | Broken at compile time (see TS section) |

### HIGH — Integer Math Verification Needed

| # | File | Line | Issue |
|---|------|------|-------|
| H-SVC1 | `services/bills/types.ts` | 160 | `Math.round(subtotal * 0.1)` — verify `subtotal` is integer cents before this call |
| H-SVC2 | `services/bas/bas-persistence.ts` | 41 | Refund branch (`totalPayable < 0`) runs silently without audit log |

### HIGH — 18 Service Files Over 300 Lines

| File | Lines |
|------|-------|
| `parsers/documents/credit-card/cba-credit.ts` | 695 |
| `cognee_client/client.ts` | 622 |
| `claude/agents/forecasting-agent/agent.ts` | 500 |
| `claude/agents/multi-entity-agent/agent.ts` | 488 |
| `claude/agents/vercel/transaction-categorizer/agent.ts` | 483 |
| `claude/agents/merchant-intelligence/agent.ts` | 478 |
| `claude/agents/cdr-product-agent/agent.ts` | 466 |
| `claude/agents/payroll-agent/agent.ts` | 465 |
| `financial-reports/report-service.ts` | 452 |
| `parsers/formats/csv-parser.ts` | 439 |
| `enrichment/abn-lookup.ts` | 433 |
| `claude/agents/vercel/financial-planner/agent.ts` | 425 |
| `claude/agents/personal-tax-claims/agent.ts` | 421 |
| `claude/agents/vercel/budget-analyzer/agent.ts` | 419 |
| `claude/agents/asset-management-agent/agent.ts` | 417 |
| `claude/agents/gst-calculator/handlers.ts` | 400 |
| `claude/agents/vercel/merchant-intelligence/tools.ts` | 387 |
| `claude/agents/market-intelligence-agent/handlers.ts` | 383 |

### MEDIUM — Float Display (Not Violations)

`services/anomaly-detection/detection-service.ts` — 8 uses of `.toFixed()` for **display strings only** (percentages, statistics). These are NOT monetary storage operations. Acceptable as-is.

### Recently Modified Services — Quality Assessment

| File | Status | Finding |
|------|--------|---------|
| `ai/service.ts` | ✅ Clean | Proper error handling, fallback pattern |
| `bills/bill-crud.ts` | ✅ Clean | Integer amounts, `Number(r.subtotal)` pattern correct |
| `bills/types.ts` | ⚠️ Check | Line 160: verify subtotal is cents |
| `invoicing/invoice-mutations.ts` | ✅ Clean | Uses `calculateLineAmounts()` helper |
| `purchase-orders/po-crud.ts` | ✅ Clean | `Math.round(subtotal * 0.1)` — integer throughout |
| `purchase-orders/types.ts` | ✅ Clean | `variancePercent()` returns integer*100 |
| `suppliers/supplier-service.ts` | ✅ Clean | Bank details masked, lazy-load pattern safe |
| `bank-reconciliation/data-access.ts` | ✅ Clean | Raw SQL cents-based, no float math |
| `bas/bas-persistence.ts` | ⚠️ Review | Refund branch without audit log |
| `purchase-orders/approval-workflow.ts` | Not reviewed | Queue for next cycle |
| `purchase-orders/three-way-match.ts` | Not reviewed | Queue for next cycle |
| `stripe/limits.ts` | Not reviewed | Queue for next cycle |
| `system-health/checkers.ts` | Not reviewed | Queue for next cycle |

### POSITIVE ✅

- All catch blocks in reviewed services re-throw or log properly (no silent swallowing)
- Integer money enforcement in bills/invoicing/PO services ✅
- No `parseFloat()` on monetary values in reviewed services ✅
- Error propagation chain clear throughout ✅

---

## 6. Client Code Quality

*Note: audit-client agent did not return a report. Findings from lead-level analysis.*

### POSITIVE ✅

- **0 TypeScript errors** ✅
- **0 @ts-ignore** ✅
- `BASE_URL` from `client/src/api.ts` used for API calls ✅
- TanStack Query for data fetching ✅
- React 19 patterns (no deprecated lifecycle hooks) ✅

### MEDIUM

| # | Issue |
|---|-------|
| M-CL1 | `client/src/App.tsx` (569L) — oversized, split into routes.tsx + layout |
| M-CL2 | `LedgerTableColumns.tsx` (521L), `CalculateTab.tsx` (509L) — split per CLAUDE.md rule |
| M-CL3 | Recently modified `client/src/api/auth.ts` — verify null guards on token access |
| M-CL4 | Recently modified `client/src/features/auth/components/Auth.tsx` — verify error handling |
| M-CL5 | 1 hardcoded localhost reference in `client/src/features/transactions/hooks/useLedgerData.ts:21` (comment, not runtime) |

---

## 7. SQLite Migration Assessment

### Finding: `sqliteTable()` is Intentional Architecture

Every schema file uses `sqliteTable()` from `drizzle-orm/sqlite-core` — this is the project-wide design pattern where `wrapPgDb()` proxies PostgreSQL to accept the SQLite Drizzle API at runtime. This is documented in CLAUDE.md and MEMORY.md.

**DO NOT migrate `sqliteTable()` → `pgTable()`** without a full coordinated schema migration plan.

### What `real()` Columns Are Appropriate vs. Monetary Violations

| Usage | Type | Status |
|-------|------|--------|
| Confidence scores (0–1.0) | `real()` | ✅ Correct |
| Tax rates (e.g. 0.1 = 10%) | `real()` | ✅ Correct |
| Quantities (1.5 units, 0.75 hrs) | `real()` | ✅ Correct |
| Interest rates (5.25%) | `real()` | ✅ Correct |
| `amountDue`, `amountPaid` in analytics.ts | `real()` | ❌ Must be `integer()` |

---

## Priority Fix Backlog

| Priority | ID | Area | Issue | Effort |
|----------|-----|------|-------|--------|
| 🔴 P0 | C-SEC1 | Security | Add `tenantAuthMiddleware()` to `admin-ext.ts` (POST /admin/ingest-knowledge) | 5m |
| 🔴 P0 | C-TS1–3 | TypeScript | Fix 40 server TS errors — add missing schema columns to `schema/invoicing.ts`, `schema/payables.ts`, customer join type | 2h |
| 🔴 P0 | C-RT15 | Routes | Add `zValidator` to `transfers.ts` POST `/detect` | 15m |
| 🔴 P0 | C-RT9/10 | Routes | Add `zValidator` to `migration.ts`/`migration-ext.ts` handlers | 30m |
| 🔴 P0 | C-SCH1 | Schema | Change `amountDue`/`amountPaid` in `analytics.ts` from `real()` → `integer()` | 15m |
| 🟠 P1 | H-SEC2 | Security | Fix raw SQL template in `agent-streaming.ts:56` → Drizzle query builder | 30m |
| 🟠 P1 | H-SEC3 | Security | Fix 13 JWT null guard violations in `account-misc.ts` | 1h |
| 🟠 P1 | H-RT | Routes | Add `zValidator` to remaining 21 mutation routes missing it | 4h |
| 🟠 P1 | H-RT2 | Routes | Add `tenantAuthMiddleware` to 11 routes requiring protection | 1h |
| 🟠 P1 | H-SCH1 | Schema | Add `tenantId` to 8 tables missing it (customerContacts, billPayments, PO family) | 2h + migration |
| 🟠 P1 | H-SCH2 | Schema | Add `.notNull()` to all tenantId fields in invoicing/payables | 30m |
| 🟠 P1 | H-TS1 | TypeScript | Fix 61 `parseInt()` calls — add `, 10` radix | 1h (scriptable) |
| 🟡 P2 | M-SCH | Schema | Add indexes on all tenantId + userId columns for query performance | 2h + migration |
| 🟡 P2 | M-SCH2 | Schema | Add `onDelete: 'cascade'` to billPayments→bills, poReceipts→purchaseOrders | 30m |
| 🟡 P2 | M-TS1 | TypeScript | Fix 5 `: any` in customer services (use `DbInstance` interface) | 1h |
| 🟡 P2 | M-TS2 | TypeScript | Replace `process.env.CLIENT_URL` for hardcoded localhost in CORS | 15m |
| 🟡 P2 | M-SVC | Services | Add audit log to bas-persistence.ts refund branch | 15m |
| 🟡 P2 | M-SVC2 | Services | Verify `bills/types.ts:160` subtotal is cents before `* 0.1` | 15m |
| 🟡 P2 | M-RT | Routes | Add `tenantAuthMiddleware` to remaining 240+ `c.req.param()` usages (type validate) | 4h |
| 🟡 P2 | M-SEC | Security | Extend rate limiter to `/api/admin/*` and streaming routes | 30m |
| 🟢 P3 | L-SVC | Services | Replace 123 `console.log` with structured logger | 4h |
| 🟢 P3 | L-FILES | All | Split 18+ files >300 lines (start with worst offenders) | 12h |

**Total estimated effort**: ~40 hours

---

## Comparison to Prior Audit (2026-02-11)

| Metric | Prior | Current | Δ |
|--------|-------|---------|---|
| Server TS errors | 0 | **40** | ❌ Regression |
| `: any` count | 3 | **8** | ❌ Slight increase |
| `as any` count | 0 | **0** | ✅ |
| @ts-ignore | 0 | **0** | ✅ |
| Security issues | Fixed (F1) | 2 new critical | ❌ Regression |
| zValidator coverage | ~60% | **46%** (26/48 missing) | ❌ Regression |
| Tables missing tenantId | 0 | **8** | ❌ Regression |

**Regressions are from new Waves (14–24)** that added features without applying existing quality standards. The base codebase quality maintained, but new wave code needs consistent enforcement.

---

## Specialist Agent Reports

### audit-typescript ✅
Full report received. Confirmed 40 server errors across invoice-pdf/customers/bills/agent-routes. Identified 3 groups of hardcoded localhost. Customer services `any` types identified.

### audit-security ✅
Full report received. Found SQL template in streaming route, unprotected admin endpoint, path traversal (lower risk than reported — files from OS, not user input). 13 JWT null guard violations in account-misc.ts.

### audit-routes ✅
Full report received. Found 60 route files (incl. subdirs), 26 mutation routes missing zValidator, 240+ unsafe parameter accesses.

### audit-schema ✅
Full report received. Found 134 tables, 8 missing tenantId, nullable tenantId violations, 9/134 indexes.

### audit-services ✅
Full report received. Found 18 files >300 lines, bills/types.ts integer math concern, bas refund silent branch.

### audit-client ❌
Agent went idle without returning a report. Lead-level findings documented above.

---

*Generated 2026-02-19 by goldledger-audit team*
*Lead: AUDIT-LEAD | Team: goldledger-audit*
