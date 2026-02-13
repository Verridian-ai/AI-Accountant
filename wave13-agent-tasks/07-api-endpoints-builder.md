# Agent 7: API Endpoints Builder

## Role
Wire 22 new API routes in server/src/index.ts for financial reports, budgets, forecasts, and KPIs.

## Priority: WAVE 13 (After Agents 2, 3 complete)

## Wait Condition
Check for `.agent-done-W13-02` and `.agent-done-W13-03` marker files before starting.

## File to MODIFY

### `server/src/index.ts`
**Current state**: ~4,707 lines, existing routes for tax, BAS, analytics, loans
**Insert location**: After the last existing route block, before the claude-agents mount section

- [ ] Add imports for 3 new services after existing imports (~line 2070):
```typescript
import { FinancialReportService } from './services/financial-reports.js';
import { BudgetService } from './services/budgets.js';
import { ForecastingService } from './services/forecasting.js';
```

- [ ] Instantiate 3 services after existing service instantiation:
```typescript
const financialReportService = new FinancialReportService();
const budgetService = new BudgetService();
const forecastingService = new ForecastingService();
```

### Report Routes (7 endpoints)

- [ ] `GET /api/reports/pnl` -- Generate Profit & Loss statement
  - Query params: `userId`, `periodStart`, `periodEnd`, `accountId` (optional)
  - Handler: `financialReportService.generateProfitAndLoss(userId, periodStart, periodEnd, accountId)`

- [ ] `GET /api/reports/balance-sheet` -- Generate Balance Sheet
  - Query params: `userId`, `asAtDate`
  - Handler: `financialReportService.generateBalanceSheet(userId, asAtDate)`

- [ ] `GET /api/reports/cash-flow` -- Generate Cash Flow Statement
  - Query params: `userId`, `periodStart`, `periodEnd`
  - Handler: `financialReportService.generateCashFlow(userId, periodStart, periodEnd)`

- [ ] `GET /api/reports/trial-balance` -- Generate Trial Balance
  - Query params: `userId`, `asAtDate`
  - Handler: `financialReportService.generateTrialBalance(userId, asAtDate)`

- [ ] `GET /api/reports/compare` -- Compare two periods
  - Query params: `userId`, `currentStart`, `currentEnd`, `priorStart`, `priorEnd`, `reportType`
  - Handler: `financialReportService.comparePeriods()`

- [ ] `POST /api/reports/snapshot` -- Save report snapshot
  - Body: `{ templateId, reportData }`
  - Handler: `financialReportService.createSnapshot(templateId, reportData)`

- [ ] `GET /api/reports/kpis` -- Get KPI metrics
  - Query params: `userId`, `period`
  - Handler: `financialReportService.getKPIs(userId, period)`

### Budget Routes (8 endpoints)

- [ ] `POST /api/budgets` -- Create a new budget
  - Body: `{ userId, name, budgetType, periodStart, periodEnd, accountId?, autoGenerate?, lookbackMonths? }`
  - Handler: `budgetService.createBudget(userId, body)`

- [ ] `GET /api/budgets` -- List budgets for user
  - Query params: `userId`, `status` (optional)
  - Handler: `budgetService.listBudgets(userId, status)`

- [ ] `GET /api/budgets/:id` -- Get budget with lines
  - Handler: `budgetService.getBudget(id)`

- [ ] `PUT /api/budgets/:id` -- Update budget
  - Body: partial budget updates
  - Handler: `budgetService.updateBudget(id, body)`

- [ ] `DELETE /api/budgets/:id` -- Delete budget
  - Handler: `budgetService.deleteBudget(id)`

- [ ] `POST /api/budgets/:id/lines` -- Add budget line
  - Body: `{ category, subcategory?, period, budgetedAmount, notes? }`
  - Handler: `budgetService.addBudgetLine(id, body)`

- [ ] `GET /api/budgets/:id/variance` -- Calculate variance
  - Handler: `budgetService.calculateVariance(id)` + `budgetService.getVarianceSummary(id)`
  - Returns both line-level variance and summary

- [ ] `GET /api/budgets/:id/variance/summary` -- Get variance summary only
  - Handler: `budgetService.getVarianceSummary(id)`

### Forecast Routes (5 endpoints)

- [ ] `POST /api/forecasts/scenarios` -- Create forecast scenario
  - Body: `{ userId, name, scenarioType, basePeriodStart, basePeriodEnd, forecastMonths, assumptions? }`
  - Handler: `forecastingService.createScenario(userId, body)`

- [ ] `GET /api/forecasts/scenarios` -- List scenarios for user
  - Query params: `userId`
  - Handler: `forecastingService.listScenarios(userId)`

- [ ] `GET /api/forecasts/scenarios/:id` -- Get scenario with periods
  - Handler: `forecastingService.getScenario(id)`

- [ ] `POST /api/forecasts/scenarios/:id/generate` -- Generate forecast
  - Handler: `forecastingService.generateForecast(id)`

- [ ] `POST /api/forecasts/compare` -- Compare multiple scenarios
  - Body: `{ scenarioIds: string[] }`
  - Handler: `forecastingService.compareScenarios(scenarioIds)`

### KPI Routes (2 endpoints)

- [ ] `GET /api/kpis/:userId` -- Get latest KPIs
  - Query params: `period`
  - Handler: `financialReportService.getKPIs(userId, period)`

- [ ] `GET /api/kpis/:userId/history` -- Get KPI history for trend charts
  - Query params: `metricName`, `periods` (comma-separated)
  - Handler: Query `kpi_metrics` table filtered by userId and metricName, ordered by period

### Route Pattern (follow existing pattern from server/src/index.ts):
```typescript
app.get('/api/reports/pnl', async (c) => {
    try {
        const userId = c.req.query('userId') ?? 'default';
        const periodStart = c.req.query('periodStart');
        const periodEnd = c.req.query('periodEnd');
        const accountId = c.req.query('accountId');
        if (!periodStart || !periodEnd) {
            return c.json({ error: 'periodStart and periodEnd are required' }, 400);
        }
        const result = await financialReportService.generateProfitAndLoss(userId, periodStart, periodEnd, accountId ?? undefined);
        return c.json(result);
    } catch (err) {
        console.error('P&L generation failed:', err);
        return c.json({ error: 'Failed to generate P&L report' }, 500);
    }
});
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 22 routes are accessible (test with curl after Docker rebuild)
- [ ] No route path conflicts with existing routes (check for `/api/reports/`, `/api/budgets/`, `/api/forecasts/`, `/api/kpis/`)
- [ ] GET endpoints return data, POST endpoints create resources, PUT/DELETE modify/remove
- [ ] Budget CRUD lifecycle works: create -> get -> update -> delete
- [ ] Create marker file: `.agent-done-W13-07`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-W13-02`), Agent 3 (`.agent-done-W13-03`)
- **IMPORTANT**: Only this agent modifies server/src/index.ts during Wave 13
