# QA Data Flow Audit

**Auditor**: data-flow-auditor
**Date**: 2026-02-20
**Scope**: Neon DB → Hono API → React Query → Components

---

## Summary

| Metric | Count |
|--------|-------|
| **Server route files** | 50+ files |
| **Stub routes (return {} with no DB query)** | 0 |
| **Silent error catch → empty array** | 3 routes |
| **Missing tenantAuthMiddleware** | 3 route files (security risk) |
| **Missing zValidator on POST** | 3 routes (2 acceptable) |
| **Client API stub functions** | ~150+ functions |
| **DB connection issues** | No (Neon dual-pool working) |
| **Auth flow issues** | Minor (see details) |

### Severity Assessment

- **CRITICAL**: ~150 client API functions return hardcoded empty data — entire feature areas are non-functional from the UI
- **HIGH**: 3 server route files missing tenantAuthMiddleware — unauthenticated access possible
- **MEDIUM**: 3 server error handlers silently return empty arrays — errors invisible to users
- **LOW**: Minor auth edge cases

---

## 1. Server Route Stub Analysis

### No Empty-Object Stubs Found

Searched `return c.json({})` — **0 matches**. All server route handlers make real DB queries before returning data.

### Silent Error → Empty Array (3 cases)

These catch blocks silently swallow errors and return empty arrays, hiding failures from users:

| File | Line | Route | Issue |
|------|------|-------|-------|
| `server/src/routes/bas/handlers.ts` | 304 | GET BAS drill-down | `catch { return c.json([]); }` — hides DB query failures |
| `server/src/routes/tax.ts` | 167 | GET tax review items | `catch { return c.json([]); }` — hides DB query failures |
| `server/src/routes/tax-ext/gst-handlers.ts` | 137 | GET input tax credits | `catch { return c.json([]); }` — hides DB query failures |

**Impact**: User sees empty data but no error message. Real DB errors (connection timeout, query failure) are invisible.

**Fix**: Return `c.json({ error: '...' }, 500)` or at minimum log the error and return a proper error response.

---

## 2. Missing tenantAuthMiddleware (3 route files)

These route files create a `new Hono()` sub-app but do NOT apply `tenantAuthMiddleware()`:

| File | Routes | Risk |
|------|--------|------|
| `server/src/routes/merchant-ops.ts:22` | POST /pending-categorizations/:id/resolve, PATCH /merchant-memory/:id, POST /transfers, POST /reconciliation-alerts/:id/resolve | **HIGH** — accesses `c.get('jwtPayload')` without middleware to set it. Will get `undefined` payload if called without auth. |
| `server/src/routes/ap-extras.ts:9` | POST /bills/:id/void, POST /ap/aging, POST /supplier-payments | **HIGH** — no auth check, uses `getUserId(c)` which may throw. |
| `server/src/routes/stream-sessions.ts:12` | POST /stream/agent/:agentType, GET /stream/history, etc. | **MEDIUM** — uses `sseStreamMiddleware()` but no tenant auth. Streaming endpoints accessible without JWT. |

### Correctly Unprotected (Expected)

| File | Reason |
|------|--------|
| `server/src/routes/auth-routes.ts` | Login/register — must be public |
| `server/src/routes/api-auth.ts` | Login/register — must be public |
| `server/src/routes/admin-auth-routes.ts` | Admin login — must be public |

### Using Alternative Auth (Acceptable)

| File | Auth Used |
|------|-----------|
| `server/src/routes/migration-ext.ts` | `adminAuthMiddleware()` — admin-only routes |
| `server/src/routes/admin-ext.ts` | `adminAuthMiddleware()` — admin-only routes |
| `server/src/routes/invitations-ext.ts` | No middleware, but invitation acceptance is semi-public by design |

---

## 3. Missing zValidator on POST/PATCH/PUT

Only 3 POST routes lack `zValidator`:

| File | Line | Route | Assessment |
|------|------|-------|------------|
| `server/src/routes/statements.ts` | 30 | POST /upload | **Acceptable** — multipart FormData upload, not JSON body |
| `server/src/routes/batch-uploads.ts` | 19 | POST / | **Acceptable** — multipart FormData upload, not JSON body |
| `server/src/routes/market-prices.ts` | 20 | POST /refresh | **Should fix** — no body validation, though body is unused |

Auth-related POST /refresh routes (`auth-routes.ts:75`, `admin-auth-routes.ts:44`) also lack zValidator but take no request body — acceptable.

**All PATCH/PUT routes have zValidator** — 0 missing.

---

## 4. Client API Stubs (~150 functions returning hardcoded data)

### CRITICAL: `client/src/api/misc.ts` — 130+ stub functions

This file contains entire API modules that return `Promise.resolve({})` or `Promise.resolve([])` with no `fetch()` call:

| API Object | Stub Count | Would-Be Feature |
|------------|------------|------------------|
| `entityApi` | 6 | Multi-entity management |
| `assetApi` | 5 | Asset register & depreciation |
| `forecastApi` | 7 | Cash flow forecasting |
| `intelligenceApi` | 12 | Cross-module intelligence |
| `knowledgeApi` | 12 | Knowledge graph DataPoints |
| `inventoryApi` | 9 | Inventory management |
| `matchesApi` | 9 | Payment matching |
| `reconApi` | 9 | Bank reconciliation |
| `budgetsApi` | 7 | Budget management |
| `loanApi` | 5 | Loan calculators |
| `anomalyApi` | 6 | Anomaly detection |
| `complianceApi` | 6 | Compliance monitoring |
| `consolidationApi` | 4 | Report consolidation |
| `documentsApi` | 8 | OCR document processing |
| `forecastsApi` | 5 | Forecast scenarios |
| `transactionsApi` | 1 | Transaction audit log |

Individual standalone stubs in `misc.ts` (lines 199-271):

| Function | Line |
|----------|------|
| `fetchActivityLog` | 199 |
| `fetchActivitySummary` | 201 |
| `fetchAdminUsers` | 209 |
| `fetchAgentConfigs` | 211 |
| `fetchAgentCosts` | 213 |
| `fetchAgentExecutions` | 215 |
| `fetchAgentStats` | 217 |
| `fetchBestRates` | 219 |
| `fetchCdrAlerts` | 221 |
| `fetchCdrProducts` | 223 |
| `fetchCogneeAdminDatasets` | 225 |
| `fetchCogneeDatasetDetail` | 228 |
| `fetchCogneeGraphStats` | 231 |
| `fetchDataHolders` | 234 |
| `fetchDiskUsage` | 236 |
| `fetchFeatureFlags` | 238 |
| `fetchHealthHistory` | 240 |
| `fetchSystemHealth` | 242 |
| `fetchSystemMetrics` | 244 |
| `testCogneeSearch` | 246 |
| `reindexCogneeDataset` | 248 |
| `triggerCdrCrawl` | 250 |
| `compareCdrProducts` | 252 |
| `calculateSavings` | 254 |
| `createAdminUser` | 256 |
| `createCdrAlert` | 258 |
| `createFeatureFlag` | 260 |
| `deleteAdminUser` | 262 |
| `deleteCdrAlert` | 264 |
| `updateAdminUser` | 266 |
| `updateAgentConfig` | 268 |
| `updateFeatureFlag` | 270 |

### `client/src/api/tax.ts` — 10 stub functions (lines 212-221)

| Function | Line | Returns |
|----------|------|---------|
| `taxApi.fetchCompanyReturn` | 212 | `Promise.resolve({} as any)` |
| `taxApi.fetchPersonalReturn` | 213 | `Promise.resolve({} as any)` |
| `taxApi.fetchSoleTraderReturn` | 214 | `Promise.resolve({} as any)` |
| `taxApi.fetchTrustReturn` | 215 | `Promise.resolve({} as any)` |
| `taxApi.fetchStrategies` | 216 | `Promise.resolve([] as any[])` |
| `taxApi.generateStrategies` | 217 | `Promise.resolve({} as any)` |
| `taxApi.updateStrategyStatus` | 218 | `Promise.resolve({} as any)` |
| `taxApi.scanEquity` | 219 | `Promise.resolve({} as any)` |
| `taxApi.confirmEquityEvent` | 220 | `Promise.resolve({} as any)` |
| `taxApi.fetchEquitySummary` | 221 | `Promise.resolve({} as any)` |

### `client/src/api/analytics.ts` — 4 stub functions (lines 138-141)

| Function | Line | Returns |
|----------|------|---------|
| `analyticsApi.fetchBillAlerts` | 138 | `Promise.resolve([] as any[])` |
| `analyticsApi.projectRevenue` | 139 | `Promise.resolve({} as any)` |
| `analyticsApi.projectExpenses` | 140 | `Promise.resolve({} as any)` |
| `analyticsApi.calculateWealthProjection` | 141 | `Promise.resolve({} as any)` |

### Working Client APIs (Real fetch calls)

These client API files are fully functional with real `fetch()` calls:

| File | Status |
|------|--------|
| `client/src/api/accounts.ts` | All 7 functions make real API calls |
| `client/src/api/transactions.ts` | All 12 functions make real API calls |
| `client/src/api/reports.ts` | All 7 functions make real API calls |
| `client/src/api/statements.ts` | All 8 functions make real API calls |
| `client/src/api/auth.ts` | All 3 functions make real API calls |
| `client/src/api/settings.ts` | Both functions make real API calls |
| `client/src/api/invoicing.ts` | All 15 functions make real API calls |
| `client/src/api/payroll.ts` | All 15 functions make real API calls |
| `client/src/api/tenants.ts` | All 17 functions make real API calls |
| `client/src/api/market.ts` | All 18 functions make real API calls |
| `client/src/api/ap.ts` | All 25+ functions make real API calls |
| `client/src/api/client.ts` | Auth header utility (BASE_URL, getAuthHeaders) — working |
| `client/src/api/agents.ts` | Chat, streaming, mutation, schema APIs — all real |

### Partially Functional

| File | Working | Stubbed |
|------|---------|---------|
| `client/src/api/tax.ts` | basApi (9 fns), taxApi (11 fns), gstApi (10 fns) | taxApi (10 fns — returns, strategies, equity) |
| `client/src/api/analytics.ts` | 13 functions | 4 functions (bill alerts, projections) |
| `client/src/api/misc.ts` | adminLogin, fetchAdminProfile, fetchAdminLedgerSummary, fetchAdminBasSummary, dashboardApi (7 fns) | 130+ stub functions |

---

## 5. Database Connection

### Status: HEALTHY

**Connection chain**: `db-adapter.ts` → `schema/connection.ts` → `db/neon-connection.ts`

- `db-adapter.ts` (line 5): `export { db } from './schema/connection.js';` — single re-export
- `schema/connection.ts` (line 16): `export const pool = getProductionPool();` — gets Neon pool
- `schema/connection.ts` (line 83): `export const db = wrapPgDb(drizzle(pool));` — Drizzle + SQLite compat proxy

### Neon Dual-Pool Architecture (`db/neon-connection.ts`)

| Pool | Purpose | Config Source |
|------|---------|---------------|
| Production | Real data for writes + user reads | `NEON_DATABASE_URL` (if `USE_NEON=true`) or `DATABASE_URL` |
| AI Masked | Pseudonymized data for LLM/Cognee | `NEON_AI_BRANCH_URL` (optional, falls back to production) |

- Pool creation: `pg.Pool` with SSL for `*.neon.tech`, max 20/min 2 connections
- Warmup: 3 retries with exponential backoff (1s, 2s, 4s) — handles Neon cold starts
- Hot-swap: `swapMaskedPool()` for branch refresh (atomic swap, old pool drained)
- Fallback: `USE_NEON=false` → both pools use `DATABASE_URL` (local PostgreSQL)
- Health check: `neonHealthCheck()` pings both pools, returns stats

### SQLite Compat Proxy (`wrapPgDb`)

- Adds `.get()`, `.all()`, `.run()` methods to Drizzle query chains
- Allows all existing service code to work without modification
- **Returns `any`** — this is the only remaining `any` in the codebase (irreducible)

### Issue: No Schema Type Safety

All DB queries go through the `any`-typed proxy. Drizzle's type inference is lost at the `wrapPgDb` boundary. This means:
- Query results are untyped at runtime
- No compile-time validation of column names
- Type errors only surface at runtime

---

## 6. Authentication Flow

### Status: WORKING with minor issues

**Auth chain**: Login → JWT generation → `tenantAuthMiddleware` → Route handlers

### Login Flow (`auth-routes.ts`)

1. POST `/auth/login` with `{ username, password, tenantId? }`
2. Try `authService.login()` (users table) — if fails, try `adminAuthService.login()` (admin_users table)
3. Lookup user's tenants via `tenantService.getMemberTenants()`
4. Generate tenant-scoped JWT via `adminAuthService.generateTenantToken()`
5. Return `{ token, user, tenants, activeTenant }`

### Middleware Validation (`auth-middleware.ts`)

Multi-tier token validation:
1. **Tenant token** (primary): Verifies JWT, checks X-Tenant-Id header matches token, verifies tenant is active
2. **Admin token** (fallback): Checks for `adminId` in payload, grants `owner` role
3. **Legacy JWT** (fallback): Verifies with JWT_SECRET, checks tenant membership
4. Public paths bypass: `/api/auth/*`, `/health`, etc.

### Client Auth (`client.ts`)

- Token stored in `localStorage.getItem('token')`
- Tenant ID in `localStorage.getItem('tenantId')`
- `getAuthHeaders()` sends both `Authorization: Bearer <token>` and `X-Tenant-Id: <id>`

### Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| Legacy JWT fallback grants `owner` role | LOW | Line 168: `c.set('role', 'owner')` — legacy tokens get maximum privileges |
| Admin super-user bypasses tenant checks | LOW | Line 138-146: Admin token skips tenant verification, X-Tenant-Id is optional |
| JWT_SECRET default is empty string | MEDIUM | Line 20: `const JWT_SECRET = process.env.JWT_SECRET \|\| ''` — empty secret allows signing with no key |

---

## 7. React Query Wiring Issues

### No Critical Wiring Issues Found

The working client API functions correctly map to server routes:

| Client API | Server Route | Match |
|------------|-------------|-------|
| `fetchAccounts()` → `GET /api/accounts` | `accounts/index.ts` | Correct |
| `fetchTransactions()` → `GET /api/transactions` | `transactions.ts` | Correct |
| `reportsApi.fetchPnL()` → `GET /api/reports/pnl` | `reports.ts` | Correct |
| `fetchStatements()` → `GET /api/statements` | `statements.ts` | Correct |
| `basApi.calculateBAS()` → `GET /api/bas/:quarter/calculate` | `bas/handlers.ts` | Correct |
| `taxApi.calculateTax()` → `GET /api/tax/calculate/:year` | `tax.ts` | Correct |

### Stub-Based Wiring (Non-Functional)

Components using the 150+ stub functions in `misc.ts` will render with empty data but no errors:
- Admin dashboard components → stub data
- Knowledge graph UI → stub data
- Compliance dashboards → stub data
- Anomaly detection UI → stub data
- Budget management UI → stub data
- Document processing UI → stub data
- CDR/banking products UI → stub data
- Inventory management → stub data
- Reconciliation UI → stub data

These components mount successfully but display blank/empty states because their API functions return `Promise.resolve({})`.

---

## 8. Prioritized Fix List

### P0 — Security (Fix Immediately)

1. **Add `tenantAuthMiddleware()` to `merchant-ops.ts`** — unprotected write operations on transactions
2. **Add `tenantAuthMiddleware()` to `ap-extras.ts`** — unprotected bill void and payment operations
3. **Add `tenantAuthMiddleware()` to `stream-sessions.ts`** — unprotected streaming endpoints
4. **Set JWT_SECRET to a strong value** in production `.env` — empty default allows trivially forged tokens

### P1 — Data Flow (Fix Before Release)

5. **Replace 3 silent error catch blocks** in `bas/handlers.ts:304`, `tax.ts:167`, `gst-handlers.ts:137` with proper error responses
6. **Wire top-priority client API stubs** — budgets, anomaly, compliance, documents, knowledge (these have real server endpoints already built)

### P2 — Completeness (Fix Over Time)

7. **Wire remaining misc.ts stubs** — admin dashboard, CDR, forecasts, inventory, reconciliation
8. **Wire tax.ts stubs** — tax returns, strategies, equity (may need new server endpoints)
9. **Wire analytics.ts stubs** — bill alerts, projections

### P3 — Quality

10. **Add zValidator to `market-prices.ts:20`** POST /refresh route
11. **Remove legacy JWT owner-level fallback** or reduce default role to `viewer`
12. **Add schema type safety** — consider typed Drizzle query wrappers to replace `any` proxy
