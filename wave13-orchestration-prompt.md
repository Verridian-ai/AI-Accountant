# Wave 13 — Financial Reporting & Budgeting — Orchestration Prompt

You are the **Team Lead** for Wave 13: Financial Reporting & Budgeting. You coordinate 10 specialized agents to add comprehensive financial reporting (P&L, Balance Sheet, Cash Flow) and flexible budgeting to GoldLedger.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Existing agents pattern**: `server/src/services/claude/agents/payroll-agent.ts`
- **Base class**: `server/src/services/claude/base-agent.ts` (ClaudeAgent<TInput, TOutput>)
- **Docker stack**: `docker-compose.yml` (5 services)

## Current State (After Wave 12)
- 17 Claude agents (15 + asset_management_agent + multi_entity_agent)
- Fixed assets with depreciation and multi-entity consolidation operational
- Chart of accounts already exists (from base schema)
- Existing budget_analyzer agent handles basic spending analysis
- 14 migrations (0009–0024) applied

## Dependencies
- **Requires**: Wave 12 complete (multi-entity for entity-scoped reports)
- **Estimated Complexity**: HIGH

## Database Schema Changes

### New Tables (8 tables)
| Table | Columns |
|-------|---------|
| `report_templates` | id, userId, name, reportType (profit_loss/balance_sheet/cash_flow/trial_balance/custom), layout (JSON), filters (JSON), isDefault |
| `report_snapshots` | id, userId, entityId, templateId, periodStart, periodEnd, status (draft/final), data (JSON), generatedAt |
| `budgets` | id, userId, entityId, name, financialYear, budgetType (annual/quarterly/monthly/rolling), status (draft/active/closed), startDate, endDate |
| `budget_lines` | id, budgetId, accountCode, category, jul, aug, sep, oct, nov, dec, jan, feb, mar, apr, may, jun, totalBudget |
| `budget_vs_actual` | id, budgetId, accountCode, period, budgetAmount, actualAmount, variance, variancePercent |
| `forecast_scenarios` | id, userId, entityId, name, baselineType (optimistic/realistic/pessimistic), assumptions (JSON), createdAt |
| `forecast_periods` | id, scenarioId, periodStart, periodEnd, projectedRevenue, projectedExpenses, projectedProfit, projectedCashFlow |
| `kpi_metrics` | id, userId, entityId, metricName, metricType (ratio/percentage/currency/count), currentValue, previousValue, target, period, calculatedAt |

**Migration**: `docker/migrations/0025_financial_reporting_budgets.sql`

## API Endpoints (22 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/reports/profit-loss | Profit & Loss report |
| GET | /api/reports/balance-sheet | Balance Sheet report |
| GET | /api/reports/cash-flow | Cash Flow Statement |
| GET | /api/reports/trial-balance | Trial Balance |
| GET | /api/reports/templates | List report templates |
| POST | /api/reports/templates | Create custom template |
| POST | /api/reports/generate | Generate report from template |
| POST | /api/reports/snapshot | Save report snapshot |
| GET | /api/reports/snapshots | List saved snapshots |
| GET | /api/reports/compare | Compare two periods |
| GET | /api/budgets | List budgets |
| POST | /api/budgets | Create budget |
| GET | /api/budgets/:id | Get budget detail with lines |
| PATCH | /api/budgets/:id | Update budget |
| POST | /api/budgets/:id/lines | Add/update budget lines |
| GET | /api/budgets/:id/vs-actual | Budget vs actual report |
| GET | /api/budget-forecasts | List forecast scenarios |
| POST | /api/budget-forecasts | Create forecast scenario |
| GET | /api/budget-forecasts/:id | Get forecast with periods |
| POST | /api/budget-forecasts/:id/recalculate | Recalculate forecast |
| GET | /api/kpis | Get KPI dashboard data |
| POST | /api/kpis/refresh | Recalculate all KPIs |

## UI Components
### `client/src/features/reports/` — New feature folder
- ReportsDashboard.tsx — Report hub with quick-access tiles
- ProfitAndLoss.tsx — P&L report with drill-down by category
- BalanceSheet.tsx — Balance sheet with asset/liability/equity sections
- CashFlowStatement.tsx — Cash flow with operating/investing/financing
- TrialBalance.tsx — Trial balance with debit/credit columns
- ReportComparison.tsx — Side-by-side period comparison
- ReportTemplateEditor.tsx — Custom report template builder

### `client/src/features/budgets/` — New feature folder
- BudgetDashboard.tsx — Budget overview with variance highlights
- BudgetEditor.tsx — Monthly budget line entry grid
- BudgetVsActual.tsx — Budget vs actual with variance chart
- ForecastScenarios.tsx — Multiple scenario comparison
- KPIDashboard.tsx — Key metrics tiles with trend sparklines

**Navigation**: Add `reports` and `budgets` to TabId type

## New Claude Agents (2)
1. **`financial_reporting_agent`** — Generates formatted financial reports, identifies trends, explains variances. Tools: `generate_pnl`, `generate_balance_sheet`, `generate_cash_flow`, `analyze_trends`, `explain_variance`.
2. **`budgeting_agent`** — Creates budgets from historical data, tracks variance, generates forecasts. Tools: `create_budget_from_history`, `calculate_variance`, `generate_forecast`, `suggest_budget_adjustments`.

## Cognee Integration
- **New datasets**: `financial_reports`, `budget_templates`, `kpi_history`
- Index reports for "What was our gross margin last quarter?"
- Index budgets for "Are we over budget on marketing?"
- Index KPIs for "Show me our trending KPIs"
- Use `RAG_COMPLETION` for financial report analysis

## Testing Criteria
- [ ] P&L report balances: Revenue - Expenses = Net Profit
- [ ] Balance Sheet balances: Assets = Liabilities + Equity
- [ ] Cash Flow: Operating + Investing + Financing = Net Cash Change
- [ ] Trial Balance: Total Debits = Total Credits
- [ ] Budget CRUD with 12-month line items
- [ ] Budget vs Actual calculates correct variance
- [ ] Forecast generates 3 scenarios from baseline data
- [ ] KPI dashboard shows current, previous, and target values
- [ ] Period comparison shows delta and percentage change
- [ ] Reports respect entity context (multi-entity scoping)
- [ ] `cd server && npx tsc --noEmit` passes clean

## Debate Findings Applied (D01–D05)

| Finding | Source | Resolution |
|---------|--------|------------|
| Budget columns use calendar year (jan-dec) instead of Aus FY (jul-jun) | D02 ATO-03 | Fixed: `budget_lines` columns reordered to jul→jun for Australian FY alignment |
| `/api/forecasts/:id` route collision with Wave 15 `/api/forecasts/cash-flow` | D04 A01 | Fixed: Renamed Wave 13 forecast routes to `/api/budget-forecasts/*` to avoid collision |
| Report generation (POST /api/reports/generate) will take 5-30s — must be async | D03 §4.1 | IMPORTANT: POST /api/reports/generate MUST return a jobId immediately and process in background. Use existing queue.ts pattern or BullMQ if available. Poll via GET /api/reports/jobs/:jobId for status |
| P&L/Balance Sheet aggregation is expensive (full table scan) | D03 §2.4 | IMPORTANT: Financial report aggregation should use CTEs with GROUP BY, not application-level loops. Consider `CREATE MATERIALIZED VIEW` for P&L and Balance Sheet if performance allows |
| POST /api/kpis/refresh should be async | D03 §4.1 | IMPORTANT: KPI refresh recalculates all KPIs — return jobId, process in background |
| BAS validation unit tests needed | D02 ATO-02 | Agent 10 (testing) should verify GST amounts round to whole dollars and G1/G11/1A/1B values align correctly |
| Report snapshots need access control | D02 FIN-04 | Report snapshots inherit userId access control; `final` snapshots cannot be deleted |
| Dual schema rule reminder | D04 S02 | ENFORCED: Every table in BOTH schema.ts AND postgres-schema.ts |

## Team Structure — 10 Agents

### Agent 1: reporting-schema-builder [PRIORITY: WAVE 1]
**Task file**: `wave13-agent-tasks/01-reporting-schema-builder.md`
**Role**: Create reporting and budget tables + migration SQL

### Agent 2: reporting-engine-builder [PRIORITY: WAVE 1]
**Task file**: `wave13-agent-tasks/02-reporting-engine-builder.md`
**Creates**: server/src/services/financial-reports.ts

### Agent 3: budget-engine-builder [PRIORITY: WAVE 1]
**Task file**: `wave13-agent-tasks/03-budget-engine-builder.md`
**Creates**: server/src/services/budgets.ts, server/src/services/forecasting.ts

### Agent 4: reporting-agent-builder [DEPENDS ON: Agent 2]
**Task file**: `wave13-agent-tasks/04-reporting-agent-builder.md`
**Creates**: server/src/services/claude/agents/financial-reporting-agent.ts

### Agent 5: budgeting-agent-builder [DEPENDS ON: Agent 3]
**Task file**: `wave13-agent-tasks/05-budgeting-agent-builder.md`
**Creates**: server/src/services/claude/agents/budgeting-agent.ts

### Agent 6: cognee-datasets-builder [DEPENDS ON: Agent 1]
**Task file**: `wave13-agent-tasks/06-cognee-datasets-builder.md`

### Agent 7: api-endpoints-builder [DEPENDS ON: Agents 2, 3, 4, 5]
**Task file**: `wave13-agent-tasks/07-api-endpoints-builder.md`

### Agent 8: ui-reports-builder [DEPENDS ON: Agent 7]
**Task file**: `wave13-agent-tasks/08-ui-reports-builder.md`

### Agent 9: ui-budgets-builder [DEPENDS ON: Agent 7]
**Task file**: `wave13-agent-tasks/09-ui-budgets-builder.md`

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Task file**: `wave13-agent-tasks/10-testing-validation-agent.md`

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 5 + Agent 6
Sub-wave 3 (After 2):  Agent 7
Sub-wave 4 (After 3):  Agent 8 + Agent 9
Sub-wave 5 (After 4):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates. Read each agent's task file from `wave13-agent-tasks/`.
