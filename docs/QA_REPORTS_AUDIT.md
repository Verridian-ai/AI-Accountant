# QA Reports Audit

**Auditor**: reports-auditor
**Date**: 2026-02-20
**Scope**: Financial report generation (server routes + client components + exports + charts)

## Summary

| Category | Issues Found |
|----------|-------------|
| Stub server routes | 2 (BAS drill-down + GST input-tax-credits error fallbacks return `c.json([])`) |
| Stub client API functions | **17+** (analytics.ts: 4 stubs, misc.ts: 100+ stubs including forecastApi, tax.ts: 10 stubs) |
| GST Summary response shape mismatch | **1 critical** — server omits `breakdown` + `previousPeriodNetGST` fields |
| Missing export functions | **1** — no PDF export for financial reports (CSV works for transactions) |
| Hardcoded sparkline data | **4** — GSTPage.tsx summary cards use static arrays |
| Chart data issues | **1** — CustomDashboard silently falls back to demo data on fetch failure |
| Date filter issues | **0** — report routes properly accept and apply date params |
| Total | **26 issues** |

---

## Server Route Issues

### P&L Route — OK
- **File**: `server/src/routes/reports.ts:94-108`
- **Status**: Real implementation. Calls `FinancialReportService.generateProfitAndLoss()`.
- Accepts `start`, `end`, `accountId` query params.
- Returns structured P&L with revenue/expense category groups.

### Balance Sheet Route — OK
- **File**: `server/src/routes/reports.ts:110-122`
- **Status**: Real implementation. Calls `FinancialReportService.generateBalanceSheet()`.
- Returns assets/liabilities/equity sections with `isBalanced` check.

### Cash Flow Route — OK
- **File**: `server/src/routes/reports.ts:124-137`
- **Status**: Real implementation. Calls `FinancialReportService.generateCashFlow()`.
- Returns operating/investing/financing sections with opening/closing balances.

### Trial Balance Route — OK
- **File**: `server/src/routes/reports.ts:139-151`
- **Status**: Real implementation. Calls `FinancialReportService.generateTrialBalance()`.
- Has synthetic fallback when no chart of accounts exists (generates from transaction categories).

### KPI Route — OK
- **File**: `server/src/routes/reports.ts:153-164`
- **Status**: Real implementation. Calls `FinancialReportService.getKPIs()`.
- Delegates to `ReportAnalytics`.

### Period Comparison Route — OK
- **File**: `server/src/routes/reports.ts:167-185`
- **Status**: Real implementation. Calls `FinancialReportService.comparePeriods()`.

### BAS Routes — OK (with minor issues)
- **File**: `server/src/routes/bas/handlers.ts`
- **Status**: Real implementation. 9 endpoints all call `BASService` methods.
- **Issue [LOW]**: Drill-down endpoint (`/:quarter/drill-down/:label`) at line 303 catches all errors and returns `c.json([])` — silently swallows errors instead of returning 500.

### GST Summary Route — RESPONSE SHAPE MISMATCH [CRITICAL]
- **File**: `server/src/routes/tax.ts:94-136`
- **Status**: Real implementation BUT returns different shape than client expects.
- **Server returns**:
  ```json
  { "gstCollected": N, "gstCredits": N, "netGST": N, "transactionsClassified": N, "transactionsNeedReview": N }
  ```
- **Client expects** (per `GSTSummaryData` type in `client/src/features/gst/types.ts:30-44`):
  ```json
  {
    "gstCollected": N, "gstCredits": N, "netGST": N,
    "breakdown": {
      "taxable": { "sales": N, "purchases": N },
      "gstFree": { "sales": N, "purchases": N },
      "inputTaxed": N, "capital": N, "private": N
    },
    "transactionsClassified": N, "transactionsNeedReview": N,
    "previousPeriodNetGST": N
  }
  ```
- **Impact**: `GSTSummary.tsx` tries to access `data.breakdown.taxable.sales` etc. — will crash with `TypeError: Cannot read properties of undefined (reading 'taxable')`.
- **Fix**: Either add `breakdown` + `previousPeriodNetGST` to the server response, or add null guards in GSTSummary component.

### GST Input Tax Credits Route — Minor issue
- **File**: `server/src/routes/tax-ext/gst-handlers.ts:86-139`
- **Status**: Real implementation.
- **Issue [LOW]**: Error catch at line 137 returns `c.json([])` — silently swallows errors.

### Analytics Routes — OK
- **File**: `server/src/routes/analytics.ts`
- **Status**: All 6 endpoints are real implementations.
- Category breakdown, spending trends, recurring payments, budget vs actual, anomalies, cash flow forecast all query real data.

---

## Client API Stub Issues

### analytics.ts — 4 stubs
- **File**: `client/src/api/analytics.ts:138-141`
- `fetchBillAlerts` → `Promise.resolve([])`
- `projectRevenue` → `Promise.resolve({})`
- `projectExpenses` → `Promise.resolve({})`
- `calculateWealthProjection` → `Promise.resolve({})`
- **Impact**: Low — these are supplementary analytics not core reports.

### tax.ts — 10 stubs
- **File**: `client/src/api/tax.ts:212-221`
- `fetchCompanyReturn`, `fetchPersonalReturn`, `fetchSoleTraderReturn`, `fetchTrustReturn` → `Promise.resolve({})`
- `fetchStrategies`, `generateStrategies`, `updateStrategyStatus` → stubs
- `scanEquity`, `confirmEquityEvent`, `fetchEquitySummary` → stubs
- **Impact**: Medium — tax return views and strategy features will display empty/blank.

### misc.ts — 100+ stubs [HIGH]
- **File**: `client/src/api/misc.ts`
- **ALL functions** in this file are stubs returning `Promise.resolve({})` or `Promise.resolve([])`.
- **Critical stubs include**:
  - `forecastApi` (lines 32-39): `list`, `getById`, `generate`, `archive`, `compare`, `calculateAccuracy`, `updateActuals` — ALL stubs. **ForecastDashboard component calls these and will always show empty state**.
  - `anomalyApi` (lines 133-139): `list`, `stats`, `scan`, `acknowledge`, `resolve`, `dismiss` — ALL stubs
  - `complianceApi` (lines 143-148): `calendar`, `obligations`, `risk`, `report`, `generateSchedule`, `lodge` — ALL stubs
  - `knowledgeApi` (lines 60-72): DataPoints, ontologies, feedback, graph — ALL stubs
  - `inventoryApi` (lines 76-84): items, stock levels, valuation — ALL stubs
  - `matchingApi` (lines 88-96): auto-match, confirm, reject — ALL stubs
  - `reconciliationApi` (lines 100-108): sessions, matching — ALL stubs
  - `invoiceApi` (lines 112-118): CRUD, variance — ALL stubs
  - `documentApi` (lines 159-168): list, classify, OCR — ALL stubs
  - `forecastScenariosApi` (lines 172-176): scenarios — ALL stubs
  - Plus 30+ standalone stubs for CDR, admin, subscription features

---

## Client Component Issues

### Reports Dashboard — OK
- **File**: `client/src/features/reports/components/ReportsDashboard.tsx`
- **Status**: Fully wired. Tab navigation, FY selector, date pickers, account filter all work.
- Passes correct props to each sub-component (ProfitAndLoss, BalanceSheet, CashFlow, TrialBalance, PeriodComparison, KPIDashboard).

### P&L Component — OK
- **File**: `client/src/features/reports/components/ProfitAndLoss.tsx`
- **Status**: Calls `reportsApi.fetchPnL()` with date range. Renders revenue/expense tables with category breakdown.
- Has proper loading/error/empty states.

### Balance Sheet Component — OK
- **File**: `client/src/features/reports/components/BalanceSheet.tsx`
- **Status**: Calls `reportsApi.fetchBalanceSheet()`. Renders 3-column layout (Assets/Liabilities/Equity).
- Has defensive `Array.isArray()` checks for items arrays.
- Shows balance check indicator.

### Cash Flow Component — OK
- **File**: `client/src/features/reports/components/CashFlow.tsx`
- **Status**: Calls `reportsApi.fetchCashFlow()`. Renders waterfall chart + 3 flow sections.
- Handles null items with `?? []` fallback.

### Trial Balance Component — OK
- **File**: `client/src/features/reports/components/TrialBalance.tsx`
- **Status**: Calls `reportsApi.fetchTrialBalance()`. Sortable table with balance check.

### KPI Dashboard — OK
- **File**: `client/src/features/reports/components/KPIDashboard.tsx`
- **Status**: Calls `reportsApi.fetchKPIs()`. Properly extracts `metrics` array from response.
- Shows progress bars toward targets.

### Period Comparison — OK
- **File**: `client/src/features/reports/components/PeriodComparison.tsx`
- **Status**: Calls `reportsApi.comparePeriods()`. Manual date selection with compare button.
- Shows significant changes cards + detailed comparison table.

### BAS Dashboard — OK
- **File**: `client/src/features/bas/components/BASDashboard/BASDashboard.tsx`
- **Status**: Fully wired. Uses `useBASDashboard` hook. Calculate/Breakdown/History tabs.

### GST Summary — WILL CRASH [CRITICAL]
- **File**: `client/src/features/gst/components/GSTSummary.tsx`
- **Status**: Calls `gstApi.fetchSummary()` which calls real server route.
- **Problem**: Server returns flat object without `breakdown` field (see Server section above). Component tries to render `data.breakdown.taxable.sales` at line 110 — will throw `TypeError`.

### GST Page — HARDCODED DATA [MEDIUM]
- **File**: `client/src/features/gst/components/GSTPage.tsx:248-302`
- **4 sparkline summary cards** use hardcoded static data arrays:
  - `data={[820, 950, 870, 1100, 1050, 1200]}` — "GST Collected"
  - `data={[300, 280, 350, 310, 290, 320]}` — "GST Free"
  - `data={[50, 60, 45, 70, 55, 65]}` — "Input Taxed"
  - `data={[1, 2, 3, 3, 4, 4]}` — "BAS Ready"
- **Impact**: Summary cards display fake trend data, not real financial data.

### Forecast Dashboard — ALL STUBS [HIGH]
- **File**: `client/src/features/forecasting/components/ForecastDashboard.tsx`
- **Status**: Fully built UI with generation controls, forecast list, chart/accuracy/scenario tabs.
- **Problem**: Imports `forecastApi` from `../../../api` which resolves to `client/src/api/misc.ts` — ALL stubs returning empty data.
- `forecastApi.list()` returns `[]` → always shows "No forecasts yet"
- `forecastApi.generate()` returns `{}` → generation appears to succeed but nothing is created
- `forecastApi.getById()` returns `{}` → no periods data for chart
- **Impact**: Entire forecasting feature is non-functional despite having complete UI.

### Custom Dashboard — Silent fallback
- **File**: `client/src/features/dashboards/components/CustomDashboard/CustomDashboard.tsx:45-47`
- **Status**: Fetches widget data from `dataSourceUrl`.
- **Issue [LOW]**: On fetch failure, silently catches error (comment says "widget will show demo data"). Should at least log or show a warning indicator.

---

## Export Function Issues

### Transaction CSV/XLSX Export — OK
- **File**: `server/src/routes/transactions.ts:82-104`
- **Status**: Real implementation. Supports `csv` and `xlsx` formats.
- Accepts `startDate`, `endDate`, `category`, `search` filters.
- Sets proper Content-Type and Content-Disposition headers.

### Invoice PDF Export — OK
- **File**: `server/src/routes/invoicing/invoice-handlers.ts:163`
- **Status**: Real implementation for individual invoice PDF download.

### Financial Report PDF Export — MISSING [MEDIUM]
- No server route exists for exporting P&L, Balance Sheet, Cash Flow, or Trial Balance as PDF.
- No export buttons exist in the report components (ProfitAndLoss, BalanceSheet, CashFlow, TrialBalance).
- The GST Summary has an "Export CSV" button (`GSTSummary.tsx:158`) but it's not wired to any handler (just a `<Button>` with no onClick).

---

## Chart Data Issues

### Recharts Components — OK (library level)
- **File**: `client/src/components/charts/`
- 10 chart components (BarChart, LineChart, PieChart, etc.) are properly built wrappers.
- Accept data arrays as props — correctness depends on parent components passing real data.

### BAS Bar Chart — OK
- `BASDashboard` hook generates `barChartData` from real BAS calculation results.

### Cash Flow Waterfall — OK
- `CashFlow.tsx` builds waterfall segments from real API data.

### Forecast Chart — DEAD [HIGH]
- `ForecastChart.tsx` expects `periods` prop from `ForecastDashboard`.
- Since `forecastApi` is all stubs, `periods` is always `[]` → empty chart.

### GST Sparklines — HARDCODED [MEDIUM]
- See GST Page section above. 4 sparklines with static data.

---

## Date Filter Issues

### Report Routes — OK
- All report routes (`/pnl`, `/cash-flow`, `/compare`) accept and validate date params.
- `FinancialReportService` methods pass dates to SQL WHERE clauses.

### BAS Routes — OK
- Uses `resolvePeriod()` to convert quarter strings to financial year + quarter number.
- `getQuarterDates()` generates proper start/end dates for Australian FY quarters.

### Analytics Routes — OK
- `getRelativeCutoff()` computes date range relative to latest transaction.

### Client Date Handling — OK
- `ReportsDashboard` generates Australian FY date ranges (Jul 1 to Jun 30).
- Custom date pickers sync with FY selector.

---

## Severity Classification

### CRITICAL (will crash or show completely wrong data)
1. **GST Summary response shape mismatch** — GSTSummary.tsx will throw TypeError accessing `data.breakdown.taxable.sales` because server doesn't return `breakdown` field.

### HIGH (feature entirely non-functional)
2. **forecastApi is all stubs** — ForecastDashboard, ForecastChart, AccuracyPanel, ScenarioComparer are all dead UI.
3. **100+ misc.ts stubs** — Anomaly, compliance, knowledge, inventory, matching, reconciliation, document, CDR features all return empty data.
4. **tax.ts stubs** — Tax return views (company, personal, sole trader, trust) all return empty.

### MEDIUM (data quality issues)
5. **GST sparklines hardcoded** — 4 summary cards show fake trend data.
6. **No PDF export for financial reports** — Users can't export P&L/BS/CF/TB.
7. **GST Export CSV button not wired** — Button exists but has no onClick handler.

### LOW (minor)
8. **BAS drill-down silently returns `[]` on error** — Should return 500.
9. **GST input-tax-credits silently returns `[]` on error** — Should return 500.
10. **CustomDashboard silently falls back to demo data** — No error indicator.
