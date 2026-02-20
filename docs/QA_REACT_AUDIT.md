# QA React Audit

**Date**: 2026-02-20
**Auditor**: react-auditor (QA Team)
**Scope**: All React components in `client/src/`

## Summary

- **Total issues found**: 87
- **Critical (breaks functionality)**: 14
- **High (data not showing)**: 45
- **Medium (UX/accessibility)**: 18
- **Low (code quality)**: 10

---

## TypeScript Errors

**`cd client && npx tsc --noEmit` → 0 errors (CLEAN)**

No TypeScript compilation errors found. Client builds successfully.

---

## Critical: API Stub Functions Returning Empty Data

The single largest issue: **~130 API functions are stubs** that return `Promise.resolve({})` or `Promise.resolve([])` instead of making real `fetch()` calls. Every component consuming these stubs renders blank/empty.

### api/tax.ts — 10 stubs (lines 212-221)

| Line | Function | Returns | Affected Component |
|------|----------|---------|-------------------|
| 212 | `fetchCompanyReturn` | `{} as any` | `CompanyReturn.tsx` — renders null |
| 213 | `fetchPersonalReturn` | `{} as any` | `PersonalReturn.tsx` — renders null |
| 214 | `fetchSoleTraderReturn` | `{} as any` | `SoleTraderReturn.tsx` — renders null |
| 215 | `fetchTrustReturn` | `{} as any` | `TrustReturn.tsx` — renders null |
| 216 | `fetchStrategies` | `[] as any[]` | `TaxOptimizerPanel.tsx` — empty list |
| 217 | `generateStrategies` | `{} as any` | `TaxOptimizerPanel.tsx` — no-op |
| 218 | `updateStrategyStatus` | `{} as any` | `TaxOptimizerPanel.tsx` — no-op |
| 219 | `scanEquity` | `{} as any` | `OwnerEquityPanel.tsx` — no-op |
| 220 | `confirmEquityEvent` | `{} as any` | `OwnerEquityPanel.tsx` — no-op |
| 221 | `fetchEquitySummary` | `{} as any` | `OwnerEquityPanel.tsx` — renders null |

### api/analytics.ts — 4 stubs (lines 138-141)

| Line | Function | Returns | Affected Component |
|------|----------|---------|-------------------|
| 138 | `fetchBillAlerts` | `[] as any[]` | `BillAlerts.tsx` — empty |
| 139 | `projectRevenue` | `{} as any` | `BudgetProjections.tsx` — empty |
| 140 | `projectExpenses` | `{} as any` | `BudgetProjections.tsx` — empty |
| 141 | `calculateWealthProjection` | `{} as any` | Analytics — empty |

### api/misc.ts — ~120 stubs (lines 11-271)

**Every function in this file is a stub.** Affected feature areas:

| API Object | # Stubs | Affected Features |
|-----------|---------|------------------|
| `entityApi` | 6 | `features/entities/` — EntitiesDashboard, InterEntityTransactionsView, EntitySettingsPanel |
| `assetApi` | 5 | `features/assets/` — AssetsDashboard, AssetRegisterTable |
| `forecastApi` | 7 | `features/forecasting/` — ForecastDashboard, AccuracyPanel, ScenarioComparer |
| `intelligenceApi` | 12 | `features/intelligence/` — IntelligenceDashboard, InsightFeed, TemporalQueryBuilder, SubscriptionManager, ModuleConnectionMap, CorrelationExplorer, IntelligenceTimeline |
| `knowledgeApi` | 12 | `features/knowledge/` — KnowledgeDashboard, DataPointManager, OntologyManager, FeedbackPanel, GraphStatsPanel, KnowledgeGraphExplorer |
| `inventoryApi` | 9 | `features/inventory/` — InventoryDashboard, InventoryItemList, StockLevelPanel, ValuationReport, WarehouseManager, MovementHistory, COGSCalculator |
| `matchesApi` | 9 | `features/matching/` — MatchingDashboard, MatchReviewPanel, RuleManager, MatchStatistics, AutoMatchView |
| `reconApi` | 9 | `features/reconciliation/` — ReconDashboard, ReconMatchingWorkspace, ReconRulesManager, ReconSummaryCard |
| `budgetsApi` | 7 | `features/budgets/` — BudgetsDashboard, BudgetEditor, VarianceView |
| `loanApi` | 5 | `features/loans/` — LoanDashboard |
| `anomalyApi` | 6 | `features/compliance/` — AnomalyAlertPanel |
| `complianceApi` | 6 | `features/compliance/` — ComplianceDashboard, ObligationTracker, ComplianceCalendar, RiskAssessmentPanel |
| `consolidationApi` | 4 | Consolidation reports |
| `documentsApi` | 8 | `features/documents/` — DocumentsDashboard, DocumentViewer, LineItemEditor, ProcessingQueue |
| `forecastsApi` | 5 | `features/budgets/` — ForecastScenarios, ScenarioComparison |
| `transactionsApi` | 1 | `features/transactions/` — AuditTrailViewer |
| Admin stubs | ~40 | `features/admin/` — AgentMonitor, AgentCostDashboard, AgentConfigManager, SystemHealthDashboard, SystemMetricsCharts, UserManager, ActivityLog, FeatureFlagManager, CogneeManager, CogneeDatasetDetail, CogneeSearchTester, CogneeGraphViewer |

**Impact**: All listed components will render empty data, loading skeletons, or "no data" placeholders. Users see blank pages in 15+ navigation tabs.

---

## `any` Type Issues

### api/tax.ts — 14 occurrences
- Lines 212-221: `(..._args: any[]) => Promise.resolve({} as any)` (10 instances)
- Line 196: `calculateDepreciation` returns `Promise<any>`
- Line 225: `fetchReviewQueue` returns `Promise<any[]>`
- Line 251: `fetchSummary` returns `Promise<any>`
- Line 269: `saveBASdraft` param `data: any`

### api/analytics.ts — 11 occurrences
- Lines 138-141: `(..._args: any[]) => Promise.resolve(... as any)` (4 instances)
- Lines 29, 41, 58, 69, 77, 85, 93, 102, 113, 130: Various return types as `Promise<any[]>` or `Promise<any>`

### api/payroll.ts — 18 occurrences
- Line 11: `Promise<{ data: any[]; total: number }>`
- Line 24: `createEmployee(data: any): Promise<any>`
- Line 42: `updateEmployee(id: string, data: any): Promise<any>`
- Line 69: `addBankDetails(employeeId: string, data: any): Promise<any>`
- Line 87: `addSuperFund(employeeId: string, data: any): Promise<any>`
- Line 105: `submitTaxDeclaration(employeeId: string, data: any): Promise<any>`
- Line 121: `fetchPayCategories` returns `{ data: any[]; total: number }`
- Line 132: `createPayCategory(data: any): Promise<any>`
- Line 162-170: `fetchPayStructure`/`setPayStructure` return `Promise<any>`

### api/invoicing.ts — 7 occurrences
- Lines 30, 40, 67, 107, 117, 151, 161: All accept `data: any` parameters

### api/ap.ts — 1 occurrence
- Line 272: `const run: any = await apApi.fetchPaymentRun(id)`

**Total `any` usage in API layer: ~51 occurrences**

---

## Data Display Issues

### Components Rendering Empty Due to Stubs (CRITICAL)

These components call stub APIs and will always show empty/blank content:

1. **Tax Returns** — `CompanyReturn.tsx`, `PersonalReturn.tsx`, `SoleTraderReturn.tsx`, `TrustReturn.tsx` — call `taxApi.fetch*Return()` which returns `{}`, so `!data` check at line 48 returns null (blank page)
2. **Tax Optimizer** — `TaxOptimizerPanel.tsx:21` calls `taxApi.fetchStrategies()` → gets `[]` → shows empty strategies
3. **Owner Equity** — `OwnerEquityPanel.tsx:24` calls `taxApi.fetchEquitySummary()` → gets `{}` → shows blank
4. **Bill Alerts** — `BillAlerts.tsx` calls `analyticsApi.fetchBillAlerts()` → gets `[]` → no alerts shown
5. **Budget Projections** — `BudgetProjections.tsx` calls `analyticsApi.projectRevenue()` → gets `{}` → blank
6. **All admin dashboard panels** — AgentMonitor, AgentCostDashboard, SystemHealthDashboard, SystemMetricsCharts, FeatureFlagManager, etc. — all backed by misc.ts stubs
7. **All intelligence panels** — InsightFeed, CorrelationExplorer, TemporalQueryBuilder, etc.
8. **All compliance panels** — ComplianceDashboard, ObligationTracker, ComplianceCalendar, etc.
9. **All forecasting panels** — ForecastDashboard, AccuracyPanel, ScenarioComparer
10. **All inventory panels** — InventoryDashboard, InventoryItemList, StockLevelPanel, etc.
11. **All documents panels** — DocumentsDashboard, DocumentViewer, ProcessingQueue, etc.
12. **All matching panels** — MatchingDashboard, MatchReviewPanel, AutoMatchView, etc.
13. **All reconciliation panels** — ReconDashboard, ReconMatchingWorkspace, etc.
14. **Audit trail** — AuditTrailViewer.tsx calls `transactionsApi.fetchAuditLog()` → gets `{ entries: [], total: 0 }`

### Working API Clients (NOT stubs)

These API files make real `fetch()` calls and should display data correctly:
- `api/transactions.ts` — all functions are real fetches
- `api/accounts.ts` — all functions are real fetches
- `api/statements.ts` — all functions are real fetches
- `api/reports.ts` — all 6 report functions are real fetches (P&L, Balance Sheet, Cash Flow, Trial Balance, KPIs, Compare)
- `api/tax.ts` — BAS/GST functions (lines 19-78) and core tax functions (lines 81-210) are real; only lines 212-221 are stubs
- `api/analytics.ts` — transfer/analytics functions (lines 5-136) are real; only lines 138-141 are stubs
- `api/ap.ts` — all supplier/bill/PO functions are real fetches
- `api/invoicing.ts` — all customer/invoice functions are real fetches
- `api/market.ts` — all market data functions are real fetches
- `api/settings.ts` — both functions are real fetches
- `api/auth.ts` — real login/register functions

---

## useEffect Issues

### Missing Dependency — Stale Closure Risk

1. **`TaxOptimizerPanel.tsx:27-29`** — `useEffect` calls `loadStrategies()` but `loadStrategies` is a regular function (not memoized) that captures `year` from closure. The function ref is not in the deps array. While `[year]` covers the `year` dependency, ESLint exhaustive-deps would flag this.

2. **`MemberManager.tsx:52`** — `useEffect(load, [tenantId])` — passes function reference directly as the effect callback. If `load` captures props/state, this pattern can be fragile.

### Fetch Without Abort Controller (Medium)

The following components fetch data in useEffect without AbortController cleanup. If the component unmounts during a pending request, React may warn about state updates on unmounted components:

- `CompanyReturn.tsx:19-27`
- `PersonalReturn.tsx:19-27`
- `OwnerEquityPanel.tsx:22-29`
- `ReportsDashboard.tsx:57-62`
- `KPIDashboard.tsx:57`
- `TrialBalance.tsx:49`
- `ProfitAndLoss.tsx:77`
- `BalanceSheet.tsx:61`
- `CashFlow.tsx:82`
- `AccountsOverview.tsx:37`
- `AccountManager.tsx:89`

(Pattern repeats across ~100+ components — systemic issue, not individual bug)

### Multiple Sequential useEffects on Same Dependencies

- `BASComparison.tsx:74,83` — two separate useEffects with overlapping dependencies
- `KnowledgeDashboard.tsx:44,62` — two separate useEffects that both fire on mount
- `ReportsDashboard.tsx:57,62` — two separate useEffects that both fire on mount
- `GSTPage.tsx:131,135` — two separate useEffects with near-identical patterns

---

## Accessibility Issues

### Modals/Dialogs Missing `role="dialog"`

Only **3** components properly use `role="dialog"` and/or `aria-labelledby`:
- `DeleteConfirmDialog.tsx:125` — has `aria-labelledby`
- `SplitTransactionModal.tsx:144` — has `role="dialog"` + `aria-labelledby`
- `BottomSheet.tsx:391` — has `role="dialog"` + `aria-modal="true"` + `aria-label`

**Missing** `role="dialog"` on modals in:
- `AgentConfigManager.tsx:159` — edit modal div lacks role/aria
- `FeatureFlagManager.tsx` — flag edit modal lacks role/aria
- `UserManager.tsx` — user edit modal lacks role/aria
- `InvoiceEditor.tsx` — invoice modal lacks role/aria
- `BillEntry.tsx` — bill entry modal lacks role/aria
- `PurchaseOrderEditor.tsx` — PO editor modal lacks role/aria
- `WidgetConfigPanel.tsx` — config panel lacks role/aria
- `CategorySelect.tsx` — dropdown overlay lacks role
- `AccountSetupWizard.tsx` — wizard overlay lacks role/aria

### Icon-Only Buttons Missing `aria-label`

Most icon-only buttons in `HeaderBar.tsx` have proper `aria-label` (verified: merchant memory, settings, refresh, logout buttons all have `aria-label`). However:

- `AgentConfigManager.tsx:127-136` — toggle enable/disable button lacks `aria-label`
- `AgentConfigManager.tsx:140-146` — settings button lacks `aria-label`
- `AgentConfigManager.tsx:171-176` — close modal button lacks `aria-label`
- Various table action buttons across admin components lack `aria-label`

### Tables Missing `aria-label` or `<caption>`

Data tables across the application generally lack accessibility attributes:
- `AgentConfigManager.tsx:99` — `<table>` without `aria-label` or `<caption>`
- Similar pattern in: MatchStatistics, BillingHistory, MemberManager, PermissionMatrix, AssetRegisterTable, EmployeeList, POList, BillList, TrialBalance, ProfitAndLoss

### Images — OK

No `<img>` tags found without `alt` attributes. The single `<img>` in `HeaderBar.tsx:49` has `alt="GoldLedger"`.

---

## Missing Key Props

All `.map()` calls reviewed have proper `key` props. The codebase consistently uses:
- `key={item.id}` for data items
- `key={index}` for stable arrays (tabs, menu items)
- `key={uniqueField}` for objects with unique identifiers

No missing key props found.

---

## Broken Imports

No broken imports detected. All import paths resolve to existing files.

---

## API Client Consistency Issue

### Mixed URL Constants

- Most API files use `API_URL` from `client.ts` (which is `BASE_URL + '/api'`)
- `api/payroll.ts` uses `BASE_URL` directly and manually prefixes `/api/payroll/...`

While both resolve correctly, this inconsistency could cause issues if the URL scheme changes.

**Files using `API_URL`**: tax.ts, analytics.ts, ap.ts, invoicing.ts, reports.ts, accounts.ts, transactions.ts, statements.ts, settings.ts, market.ts, misc.ts
**Files using `BASE_URL`**: payroll.ts (line 1 imports `BASE_URL`, lines 17/25/35/43 etc. use `${BASE_URL}/api/payroll/...`)

---

## Recommendations (Priority Order)

### P0 — Critical (Blocks User Functionality)
1. **Replace all stubs in `api/misc.ts`** with real `fetch()` calls — this alone unlocks 15+ feature tabs
2. **Replace stubs in `api/tax.ts:212-221`** — enables all tax return views
3. **Replace stubs in `api/analytics.ts:138-141`** — enables bill alerts and projections

### P1 — High (Data Quality)
4. **Type the payroll API** — replace all `any` with proper interfaces
5. **Type the invoicing API** — replace `data: any` params with proper types
6. **Standardize API URL usage** — use `API_URL` consistently in payroll.ts

### P2 — Medium (Accessibility)
7. **Add `role="dialog"` + `aria-labelledby`** to all modal/overlay components
8. **Add `aria-label`** to all icon-only buttons
9. **Add `aria-label`** or `<caption>` to data tables

### P3 — Low (Code Quality)
10. **Add AbortController** to useEffect fetch patterns (systemic — create a `useFetchEffect` hook)
11. **Consolidate duplicate useEffects** in BASComparison, KnowledgeDashboard, ReportsDashboard, GSTPage
