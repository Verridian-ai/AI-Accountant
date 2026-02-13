# Agent 10: Testing & Validation Agent

## Role
Run the full verification plan for Wave 13 Financial Reporting & Budgeting. Verify P&L balance equation, balance sheet equation, cash flow reconciliation, budget variance math, and forecast confidence intervals.

## Priority: WAVE 13 FINAL (After ALL Wave 13 agents complete)

## Wait Condition
Check for ALL marker files: `.agent-done-W13-01` through `.agent-done-W13-09` before starting.

## Verification Tasks

### 1. Compilation
- [ ] Run `cd server && npx tsc --noEmit` -- zero errors
- [ ] Run `cd client && npx tsc --noEmit` -- zero errors
- [ ] Run `docker compose config` -- validates without errors

### 2. Schema & Migration
- [ ] Run migration 0025 against DB:
  ```bash
  docker compose exec postgres psql -U app_user -d ai_accountant -f /docker-entrypoint-initdb.d/0025_financial_reporting.sql
  ```
- [ ] Verify 8 new tables exist:
  ```bash
  docker compose exec postgres psql -U app_user -d ai_accountant -c "\dt report_templates"
  docker compose exec postgres psql -U app_user -d ai_accountant -c "\dt report_snapshots"
  docker compose exec postgres psql -U app_user -d ai_accountant -c "\dt budgets"
  docker compose exec postgres psql -U app_user -d ai_accountant -c "\dt budget_lines"
  docker compose exec postgres psql -U app_user -d ai_accountant -c "\dt budget_vs_actual"
  docker compose exec postgres psql -U app_user -d ai_accountant -c "\dt forecast_scenarios"
  docker compose exec postgres psql -U app_user -d ai_accountant -c "\dt forecast_periods"
  docker compose exec postgres psql -U app_user -d ai_accountant -c "\dt kpi_metrics"
  ```
- [ ] Verify foreign keys are valid (no dangling references)

### 3. Financial Reports -- P&L
- [ ] `curl "localhost:3501/api/reports/pnl?userId=default&periodStart=2024-07-01&periodEnd=2025-06-30"`
- [ ] Verify: `grossRevenue - totalExpenses = netProfitOrLoss` (accounting equation)
- [ ] Verify: all revenue categories sum to grossRevenue
- [ ] Verify: all expense categories sum to totalExpenses
- [ ] Verify: `grossMargin = netProfitOrLoss / grossRevenue * 100` (or 0 if no revenue)

### 4. Financial Reports -- Balance Sheet
- [ ] `curl "localhost:3501/api/reports/balance-sheet?userId=default&asAtDate=2025-06-30"`
- [ ] Verify: `totalAssets = totalLiabilities + totalEquity` (fundamental equation)
- [ ] Verify: `isBalanced = true`
- [ ] Verify: assets section contains positive balances, liabilities contains negative

### 5. Financial Reports -- Cash Flow
- [ ] `curl "localhost:3501/api/reports/cash-flow?userId=default&periodStart=2024-07-01&periodEnd=2025-06-30"`
- [ ] Verify: `openingBalance + netCashChange = closingBalance`
- [ ] Verify: `netCashChange = operating.net + investing.net + financing.net`
- [ ] Verify: all three sections have inflows and outflows summing to their net

### 6. Financial Reports -- Trial Balance
- [ ] `curl "localhost:3501/api/reports/trial-balance?userId=default&asAtDate=2025-06-30"`
- [ ] Verify: `totalDebits = totalCredits` (or difference is within rounding tolerance of $0.01)
- [ ] Verify: `isBalanced = true`

### 7. Period Comparison
- [ ] `curl "localhost:3501/api/reports/compare?userId=default&currentStart=2024-07-01&currentEnd=2025-06-30&priorStart=2023-07-01&priorEnd=2024-06-30&reportType=profit_and_loss"`
- [ ] Verify: variances are calculated as (current - prior)
- [ ] Verify: significantChanges contains only entries with variancePercent > 10%

### 8. KPIs
- [ ] `curl "localhost:3501/api/reports/kpis?userId=default&period=2025-01"`
- [ ] Verify: at least 5 KPI metrics returned
- [ ] Verify: each metric has metricName, value, and trend
- [ ] Verify: trend is one of 'up', 'down', 'stable'

### 9. Budget CRUD
- [ ] Create budget:
  ```bash
  curl -X POST localhost:3501/api/budgets -H "Content-Type: application/json" -d '{"userId":"default","name":"Test Budget","budgetType":"monthly","periodStart":"2025-01-01","periodEnd":"2025-12-31","autoGenerate":true,"lookbackMonths":6}'
  ```
- [ ] Verify: budget created with auto-generated lines (if transactions exist)
- [ ] List budgets: `curl "localhost:3501/api/budgets?userId=default"` -- verify test budget appears
- [ ] Get variance: `curl "localhost:3501/api/budgets/{id}/variance"` -- verify variance_amount = actual - budgeted
- [ ] Get variance summary: verify `health` field is one of 'on_track', 'over_budget', 'under_budget'
- [ ] Delete budget: `curl -X DELETE localhost:3501/api/budgets/{id}`

### 10. Forecasting
- [ ] Create scenario:
  ```bash
  curl -X POST localhost:3501/api/forecasts/scenarios -H "Content-Type: application/json" -d '{"userId":"default","name":"Test Forecast","scenarioType":"realistic","basePeriodStart":"2024-07-01","basePeriodEnd":"2025-06-30","forecastMonths":12}'
  ```
- [ ] Generate forecast: `curl -X POST localhost:3501/api/forecasts/scenarios/{id}/generate`
- [ ] Verify: forecast periods returned with amounts and confidence intervals
- [ ] Verify: `confidenceLower < forecastAmount < confidenceUpper` for each period
- [ ] Verify: optimistic scenario amounts > realistic > pessimistic (create all 3 and compare)

### 11. Agent Registration
- [ ] Verify 2 new agents in types.ts: `financial_reporting`, `budgeting`
- [ ] Verify 2 new entries in config.ts `AGENT_TOKEN_BUDGETS`
- [ ] Verify 2 new entries in config.ts `AGENT_MODELS`
- [ ] Verify 2 new imports in orchestrator.ts

### 12. Cognee Datasets
- [ ] Verify `COGNEE_DATASETS` has 15 entries (12 existing + 3 new: financialReports, budgetTemplates, kpiHistory)
- [ ] Verify 3 new indexing helper methods exist on CogneeTools class
- [ ] Verify 3 new search helper methods exist on CogneeTools class

### 13. Frontend
- [ ] Navigate to Reports tab -- ReportsDashboard renders
- [ ] Navigate to Budgets tab -- BudgetsDashboard renders
- [ ] Reports: all 6 sub-tabs render correct component (P&L, Balance Sheet, Cash Flow, Trial Balance, Comparison, KPIs)
- [ ] Budgets: all 3 sub-tabs render (My Budgets, Create Budget, Forecasts)
- [ ] Styling matches existing components (dark theme, gold #FFCC00 accents, neu-raised/neu-inset classes)

### 14. Generate Verification Report
```
GOLDLEDGER WAVE 13 VERIFICATION REPORT
=======================================
Date: [timestamp]
Schema:           [PASS/FAIL] - 8 tables created, FK valid
P&L Report:       [PASS/FAIL] - revenue - expenses = net profit
Balance Sheet:    [PASS/FAIL] - assets = liabilities + equity
Cash Flow:        [PASS/FAIL] - opening + change = closing
Trial Balance:    [PASS/FAIL] - debits = credits
Period Compare:   [PASS/FAIL] - variances calculated correctly
KPIs:             [PASS/FAIL] - 7 metrics with trends
Budget CRUD:      [PASS/FAIL] - create/list/get/update/delete
Variance:         [PASS/FAIL] - actual - budgeted = variance
Forecasting:      [PASS/FAIL] - confidence intervals valid
Agents:           [PASS/FAIL] - 2 new agents registered
Cognee:           [PASS/FAIL] - 3 new datasets configured
Frontend:         [PASS/FAIL] - 12 components render
Build:            [PASS/FAIL] - server + client compile clean
```

- [ ] Create marker file: `.agent-done-W13-10`

## Dependencies
- **Requires**: ALL Wave 13 agents (`.agent-done-W13-01` through `.agent-done-W13-09`)
- **Docker must be running**: `docker compose up -d`
