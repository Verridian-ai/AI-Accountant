# GoldLedger TypeScript Error & Any-Type Report

**Generated**: 2026-02-17
**Branch**: `refactor/REFACTOR-018-account-service`
**Client tsc**: 0 errors (clean)
**Server tsc**: 119 errors
**`: any` occurrences**: 560 (across 82 files)
**`as any` occurrences**: 299

---

## 1. Error Summary by Category

| Error Code | Count | Description |
|-----------|-------|-------------|
| **TS2307** | 49 | Cannot find module (missing files) |
| **TS7006** | 39 | Parameter implicitly has 'any' type |
| **TS2304** | 17 | Cannot find name 'sessionId' |
| **TS2554** | 10 | Wrong argument count (related to sessionId) |
| **TS18046** | 2 | Value is of type 'unknown' |
| **TS2459** | 1 | Module doesn't export member |
| **TS2339** | 1 | Property doesn't exist on type |

---

## 2. Error Category A: Missing Modules (49 errors — TS2307)

These are files that import from modules that don't exist. **Root cause**: previous agents created files that reference sub-modules but never created those sub-modules.

### A1. `lib/logger.js` — 11 files (logger exists at `utils/logger.ts`)

**Fix**: Create `server/src/lib/logger.ts` that re-exports from `../utils/logger.js`

| Importing File |
|---------------|
| `db/index.ts` |
| `routes/agent-routes-extended.ts` |
| `routes/chat-core.ts` |
| `routes/payroll.ts` |
| `services/admin-auth.ts` |
| `services/cognee/auth.ts` |
| `services/cognee/cognify.ts` |
| `services/cognee/data-ops.ts` |
| `services/cognee/datasets.ts` |
| `services/cognee/memify-rules.ts` |
| `services/cognee/merchant-memory.ts` |
| `services/cognee/search.ts` |
| `services/bills/payment-tracking.ts` |

### A2. `lib/config.js` — 3 files

**Fix**: Create `server/src/lib/config.ts` with env var exports. Read importing files to determine exports needed.

| Importing File |
|---------------|
| `db/index.ts` |
| `routes/payroll.ts` |
| `services/auth/auth-service.ts` |

### A3. `utils/auth-helpers.js` — 8 files

**Fix**: Create `server/src/utils/auth-helpers.ts`. Read one importing file to determine what functions are needed.

| Importing File |
|---------------|
| `routes/auth-routes.ts` |
| `routes/bills.ts` |
| `routes/members.ts` |
| `routes/misc.ts` |
| `routes/purchase-orders.ts` |
| `routes/subscriptions.ts` |
| `routes/suppliers.ts` |
| `routes/tenants.ts` |

### A4. `bank-reconciliation/` sub-modules — 7 files missing

**Fix**: Read `bank-reconciliation/reconciliation.ts` to determine all imports, then create stubs that re-export from the parent monolith `../bank-reconciliation.ts`.

| Missing Module | Imported By |
|---------------|-------------|
| `./types.js` | reconciliation.ts:15 |
| `./matching.js` | reconciliation.ts:16 |
| `./suggestions.js` | reconciliation.ts:17 |
| `./balance-check.js` | reconciliation.ts:24 |
| `./match-operations.js` | reconciliation.ts:30 |
| `./rules.js` | reconciliation.ts:37 |
| `./auto-match.js` | reconciliation.ts:38 |

### A5. `bas/` sub-modules — 5 files missing

**Fix**: Read `bas/bas-service.ts` and create stubs re-exporting from parent `../bas.ts`.

| Missing Module | Imported By |
|---------------|-------------|
| `./types.js` | bas-service.ts:9,10 |
| `./quarter-utils.js` | bas-service.ts:11 |
| `./available-quarters.js` | bas-service.ts:12 |
| `./bas-persistence.js` | bas-service.ts:19 |

### A6. `bills/` sub-modules — 3 files missing

| Missing Module | Imported By |
|---------------|-------------|
| `./types.js` | bill-crud.ts:13, payment-tracking.ts:18 |
| `./bill-mutations.js` | bill-crud.ts:17 |

### A7. `budgets/` sub-modules — 2 files missing

| Missing Module | Imported By |
|---------------|-------------|
| `./types.js` | budget-crud.ts:10 |
| `./budget-generation.js` | budget-crud.ts:11 |

### A8. `cash-flow-forecast/` sub-modules — 2 files missing

| Missing Module | Imported By |
|---------------|-------------|
| `./types.js` | forecast-service.ts:11 |
| `./projections.js` | forecast-service.ts:12 |

### A9. `email/` sub-modules — 4 files missing

| Missing Module | Imported By |
|---------------|-------------|
| `./types.js` | email-service.ts:5 |
| `./templates.js` | email-service.ts:6 |
| `./sender.js` | email-service.ts:15 |
| `./sender-templates.js` | email-service.ts:21 |

### A10. `enrichment/` sub-modules — 2 files missing

| Missing Module | Imported By |
|---------------|-------------|
| `./types.js` | enrichment-service.ts:21 |
| `./merchant-pipeline.js` | enrichment-service.ts:22 |

---

## 3. Error Category B: Missing `sessionId` Variable (27 errors — TS2304 + TS2554)

All in Vercel agent files. These agents reference `sessionId` in tool callbacks but the variable is not in scope. The `buildTools()` method needs a `sessionId` parameter.

| File | Errors |
|------|--------|
| `vercel/tax-strategy.ts` | 8 (lines 130, 183, 213, 246, 296 + argument count) |
| `vercel/merchant-intelligence.ts` | 5 (lines 233, 465, 482 + argument count) |
| `vercel/financial-planner.ts` | 5 (lines 398, 424, 474 + argument count) |
| `vercel/transaction-categorizer.ts` | 5 (lines 185, 217, 252 + argument count) |
| `agents/gst-calculator.ts` | 3 (lines 708, 710) |
| `vercel/budget-analyzer.ts` | 1 (line 361) |

**Fix**: Add `sessionId?: string` parameter to each `buildTools()` method signature. The parameter is already being passed in some call sites — it just needs declaring.

---

## 4. Error Category C: Implicit `any` Parameters (39 errors — TS7006)

Callback parameters that TypeScript can't infer because the source array is untyped (usually from `(db as any).select()...all()`).

### C1. `index.ts` — 34 errors

| Line | Parameter | Context |
|------|-----------|---------|
| 1008 | `err` | catch block |
| 1590, 1591, 1609 | `s` | `.map((s) =>` on schedule rows |
| 1732, 1893 | `row` | `.map((row) =>` on DB query results |
| 2168, 2184, 2187 | `a` | `.map((a) =>` on account rows |
| 2840, 3216, 3239 | `tx` | transaction processing callbacks |
| 3665, 3764-3776, 3793, 3832 | `t`, `account` | dashboard aggregation |
| 3842, 3851, 3867, 3870 | `a`, `l` | account/line item callbacks |
| 4050, 4051, 4104, 4123, 4134-4149, 4280 | `t`, `l` | report generation |

**Fix**: Add explicit types to each callback parameter using `typeof tableName.$inferSelect`.

### C2. Other files — 5 errors

| File | Line | Parameter | Fix |
|------|------|-----------|-----|
| `budgets/budget-crud.ts` | 54 | `l` | `l: typeof budgetLines.$inferSelect` |
| `cash-flow-forecast/forecast-service.ts` | 149 | `f` | `f: typeof forecastPeriods.$inferSelect` |
| `cash-flow-forecast/forecast-service.ts` | 151 | `a`, `b` | sort comparator types |
| `enrichment/enrichment-service.ts` | 126 | `m` | merchant result type |

---

## 5. Error Category D: Other Errors (4 errors)

| File | Line | Code | Issue |
|------|------|------|-------|
| `index.ts` | 76 | TS2459 | `ValidationError` not exported from `./validation/index.js` |
| `index.ts` | 310 | TS18046 | `e` is of type 'unknown' (needs type guard) |
| `index.ts` | 1008 | TS18046 | `e` is of type 'unknown' (needs type guard) |
| `index.ts` | 2221 | TS2339 | `accountName` doesn't exist on type `{}` |

---

## 6. `: any` Type Density — Top 40 Files

| Rank | Count | File |
|------|-------|------|
| 1 | 47 | `services/cross-module-intelligence.ts` |
| 2 | 34 | `index.ts` |
| 3 | 30 | `services/market-cognee-indexer.ts` |
| 4 | 24 | `services/pipeline.ts` |
| 5 | 22 | `services/anomaly-detection.ts` |
| 6 | 20 | `services/cognee-sessions.ts` |
| 7 | 18 | `db/typed-queries.ts` |
| 8 | 17 | `services/cdr-products.ts` |
| 9 | 15 | `services/sentiment-analysis.ts` |
| 10 | 14 | `services/system-health.ts` |
| 11 | 14 | `services/cdr-cognee-indexer.ts` |
| 12 | 13 | `services/compliance-monitor.ts` |
| 13 | 12 | `services/ocr-processing.ts` |
| 14 | 12 | `services/cdr-crawler.ts` |
| 15 | 11 | `services/suppliers.ts` |
| 16 | 11 | `services/cognee-feedback.ts` |
| 17 | 11 | `schema.ts` |
| 18 | 10 | `routes/invoicing-routes.ts` |
| 19 | 9 | `services/claude/agents/ocr-processing.ts` |
| 20 | 8 | `services/rag/citations/index.ts` |
| 21 | 8 | `services/purchase-orders.ts` |
| 22 | 8 | `services/inventory.ts` |
| 23 | 7 | `services/owner-equity.ts` |
| 24 | 7 | `services/fixed-assets.ts` |
| 25 | 7 | `services/financial-reports.ts` |
| 26 | 7 | `services/export.ts` |
| 27 | 7 | `services/employee.ts` |
| 28 | 7 | `services/budgets.ts` |
| 29 | 7 | `routes/pipeline.ts` |
| 30 | 6 | `services/enrichment.ts` |
| 31 | 6 | `services/claude/mutation-tools.ts` |
| 32 | 6 | `services/agents.ts` |
| 33 | 5 | `services/tenant.ts` |
| 34 | 5 | `services/intelligence-subscriptions.ts` |
| 35 | 5 | `services/enrichment/enrichment-service.ts` |
| 36 | 5 | `services/data-refresh-scheduler.ts` |
| 37 | 5 | `services/claude/agents/compliance-monitoring-agent.ts` |
| 38 | 5 | `services/bills.ts` |
| 39 | 5 | `routes/budgets.ts` |
| 40 | 4 | `services/sync.ts` |

**Remaining ≤4**: 42 more files with 1-4 `: any` each.

---

## 7. Recommended Agent Task Assignments

### Agent 1: Missing Modules (49 errors → 0)
**Scope**: Create all missing module files (A1-A10 above)
- Create `lib/logger.ts` (re-export from `../utils/logger.js`)
- Create `lib/config.ts` (read importers to determine shape)
- Create `utils/auth-helpers.ts` (read importers to determine functions)
- Create 25 sub-module stubs across 7 service directories
- **Approach**: Read each importing file, determine what it needs, create minimal file
- **Verify**: `npx tsc --noEmit 2>&1 | grep "TS2307" | wc -l` should be 0

### Agent 2: Vercel Agent sessionId (27 errors → 0)
**Scope**: Fix `sessionId` not in scope across 6 agent files
- Add `sessionId?: string` parameter to `buildTools()` in each Vercel agent
- Fix `gst-calculator.ts` similarly
- Fix any argument count mismatches after adding the parameter
- **Files**: `vercel/tax-strategy.ts`, `vercel/merchant-intelligence.ts`, `vercel/financial-planner.ts`, `vercel/transaction-categorizer.ts`, `vercel/budget-analyzer.ts`, `agents/gst-calculator.ts`
- **Verify**: `npx tsc --noEmit 2>&1 | grep "TS2304\|TS2554" | wc -l` should be 0

### Agent 3: index.ts Implicit Any (38 errors → 0)
**Scope**: Fix all 38 TS errors in `index.ts`
- Add type annotations to 34 callback parameters (TS7006)
- Fix `ValidationError` export (TS2459)
- Add type guards for `unknown` errors (TS18046)
- Fix `accountName` property access (TS2339)
- **Pattern**: Add `typeof transactions.$inferSelect`, `typeof accounts.$inferSelect`, etc.
- **Verify**: `npx tsc --noEmit 2>&1 | grep "src/index.ts" | wc -l` should be 0

### Agent 4: Remaining TS7006 (5 errors → 0)
**Scope**: Fix 5 implicit any errors outside index.ts
- `budgets/budget-crud.ts:54` — type the `l` parameter
- `cash-flow-forecast/forecast-service.ts:149,151` — type `f`, `a`, `b` parameters
- `enrichment/enrichment-service.ts:126` — type `m` parameter
- **Verify**: `npx tsc --noEmit 2>&1 | grep "TS7006" | grep -v "index.ts" | wc -l` should be 0

### Agent 5: Any-Type Elimination — Tier 1 (top 6 files, ~170 any)
**Scope**: Eliminate `: any` from the 6 highest-density files
- `cross-module-intelligence.ts` (47)
- `index.ts` (34)
- `market-cognee-indexer.ts` (30)
- `pipeline.ts` (24)
- `anomaly-detection.ts` (22)
- `cognee-sessions.ts` (20)
- **Pattern**: Replace `(db as any)` query results with typed local interfaces, replace callback `(x: any)` with inferred or explicit types, replace `catch (err: any)` with `catch (err: unknown)` + type guard
- **Verify**: `grep -c ": any" <file>` for each should be 0

### Agent 6: Any-Type Elimination — Tier 2 (files 7-18, ~153 any)
**Scope**: Eliminate `: any` from the next 12 files
- `db/typed-queries.ts` (18), `cdr-products.ts` (17), `sentiment-analysis.ts` (15), `system-health.ts` (14), `cdr-cognee-indexer.ts` (14), `compliance-monitor.ts` (13), `ocr-processing.ts` (12), `cdr-crawler.ts` (12), `suppliers.ts` (11), `cognee-feedback.ts` (11), `schema.ts` (11), `routes/invoicing-routes.ts` (10)
- **Verify**: Same grep pattern per file

### Agent 7: Any-Type Elimination — Tier 3 (files 19-40+, ~237 any)
**Scope**: Eliminate `: any` from remaining 62 files
- All files with 1-9 `: any` occurrences
- **Verify**: `grep -rn ": any" server/src/ --include="*.ts" | grep -v test | grep -v .d.ts | wc -l` target < 100

---

## 8. Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| Server TS errors | 119 | 0 |
| Client TS errors | 0 | 0 (maintain) |
| `: any` occurrences | 560 | < 50 |
| `as any` occurrences | 299 | < 30 |
| Files with `: any` | 82 | < 10 |

---

## 9. Key Patterns for Agents

### Pattern 1: Missing module stub
```typescript
// server/src/lib/logger.ts
export { logger } from '../utils/logger.js';
```

### Pattern 2: sessionId parameter
```typescript
// Before:
buildTools(): ToolSet {
  // ...uses sessionId but it's not declared
}

// After:
buildTools(sessionId?: string): ToolSet {
  // sessionId is now in scope
}
```

### Pattern 3: Typed DB query results
```typescript
// Before:
const rows: any[] = await (db as any).select()...all();
rows.map((r: any) => r.amount);

// After:
type TxRow = typeof transactions.$inferSelect;
const rows = await (db as any).select()...all() as TxRow[];
rows.map((r) => r.amount);  // r is inferred as TxRow
```

### Pattern 4: Error handling
```typescript
// Before:
catch (err: any) { return err.message; }

// After:
catch (err: unknown) {
  return err instanceof Error ? err.message : 'Unknown error';
}
```

### Pattern 5: Condition arrays
```typescript
// Before:
const conditions: any[] = [];

// After:
import { SQL } from 'drizzle-orm';
const conditions: (SQL | undefined)[] = [];
```
