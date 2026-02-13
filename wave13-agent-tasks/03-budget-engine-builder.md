# Agent 3: Budget Engine Builder

## Role
Build budget CRUD service, budget-vs-actual comparison engine, and multi-scenario forecasting service with confidence intervals.

## Priority: WAVE 13 (After Agent 1 completes schema)

## Wait Condition
Check for `.agent-done-W13-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/budgets.ts`
**Purpose**: Full budget lifecycle management with automated generation from historical data
**Pattern**: Follow `server/src/services/bas.ts` (service class with Drizzle queries)

- [ ] Create `BudgetService` class with the following methods:

#### CRUD Operations
- `createBudget(userId: string, params: CreateBudgetParams): Promise<Budget>`
  - Insert into `budgets` table, generate UUID
  - If `autoGenerate: true`, call `generateFromHistory()` to populate budget lines
  - Return full budget with lines

- `getBudget(budgetId: string): Promise<Budget & { lines: BudgetLine[] }>`
  - Fetch budget + all budget_lines via JOIN
  - Include calculated totals per category

- `listBudgets(userId: string, status?: string): Promise<Budget[]>`
  - Filter by user, optional status filter
  - Order by period_start DESC

- `updateBudget(budgetId: string, updates: Partial<Budget>): Promise<Budget>`
  - Update budget metadata (name, status, dates)
  - Recalculate total_amount from budget_lines

- `deleteBudget(budgetId: string): Promise<void>`
  - CASCADE delete removes budget_lines and budget_vs_actual

#### Budget Line Operations
- `addBudgetLine(budgetId: string, line: CreateBudgetLineParams): Promise<BudgetLine>`
  - Insert into `budget_lines` table
  - Enforce UNIQUE(budget_id, category, period) constraint

- `updateBudgetLine(lineId: string, updates: Partial<BudgetLine>): Promise<BudgetLine>`
  - Update budgeted_amount, notes
  - Recalculate parent budget total

- `deleteBudgetLine(lineId: string): Promise<void>`

#### Auto-Generation
- `generateFromHistory(userId: string, periodStart: string, periodEnd: string, lookbackMonths: number): Promise<BudgetLine[]>`
  - Query transactions for the lookback period, grouped by category and month
  - Calculate average monthly spend per category
  - Apply seasonal adjustment: compare each month's historical average to overall average
  - Generate budget_lines for each category and each month in the target period
  - Set `source_method` to 'historical_average'
  - Return generated lines

#### Budget vs Actual
- `calculateVariance(budgetId: string): Promise<BudgetVsActual[]>`
  - For each budget_line, query actual transactions matching category + period
  - Calculate: `actual_amount`, `variance_amount` (actual - budgeted), `variance_percent`
  - Upsert into `budget_vs_actual` table
  - Return array with over/under indicators

- `getVarianceSummary(budgetId: string): Promise<VarianceSummary>`
  - Aggregate all lines: `totalBudgeted`, `totalActual`, `totalVariance`
  - Categories over budget (positive variance for expenses)
  - Categories under budget
  - Top 5 largest absolute variances
  - Overall budget health: 'on_track' | 'over_budget' | 'under_budget'

### 2. `server/src/services/forecasting.ts`
**Purpose**: Multi-scenario financial forecasting with confidence intervals
**Pattern**: Standalone service class

- [ ] Create `ForecastingService` class with the following methods:

#### Scenario Management
- `createScenario(userId: string, params: CreateScenarioParams): Promise<ForecastScenario>`
  - Insert into `forecast_scenarios` table
  - Validate: `forecastMonths` between 1 and 60
  - Default assumptions per type:
    - optimistic: `{ growthRate: 0.10, inflationAdjust: true, seasonalWeight: 0.8 }`
    - realistic: `{ growthRate: 0.03, inflationAdjust: true, seasonalWeight: 1.0 }`
    - pessimistic: `{ growthRate: -0.05, inflationAdjust: true, seasonalWeight: 1.2 }`

- `getScenario(scenarioId: string): Promise<ForecastScenario & { periods: ForecastPeriod[] }>`

- `listScenarios(userId: string): Promise<ForecastScenario[]>`

- `deleteScenario(scenarioId: string): Promise<void>`

#### Forecast Generation
- `generateForecast(scenarioId: string): Promise<ForecastPeriod[]>`
  - Fetch scenario + historical data for base period
  - Group historical transactions by category and month
  - For each forecast month and category:
    1. Calculate base amount from historical average
    2. Apply growth rate: `base * (1 + growthRate) ^ monthIndex`
    3. Apply seasonal factor from historical pattern
    4. Calculate confidence interval: `mean +/- (1.96 * stddev)` for 95% CI
    5. Set method: 'linear_trend' (default), 'seasonal_decomposition' if seasonal variance > 20%
  - Insert/upsert into `forecast_periods` table
  - Return all generated periods

- `compareScenarios(scenarioIds: string[]): Promise<ScenarioComparison>`
  - Load all scenarios + periods
  - For each month: show optimistic, realistic, pessimistic amounts side-by-side
  - Calculate total forecast per scenario
  - Return `{ months: [{ period, scenarios: { [scenarioId]: amount } }], totals: { [scenarioId]: totalAmount } }`

#### Utility Methods
- `calculateSeasonalFactors(transactions: Transaction[], months: number): Map<number, number>`
  - Group by month (1-12), calculate average per month
  - Divide each month average by overall average = seasonal factor
  - Factor of 1.0 = no seasonal effect, >1 = seasonal peak, <1 = seasonal trough

- `calculateConfidenceInterval(values: number[], confidenceLevel: number): { lower: number; upper: number }`
  - Mean +/- (z-score * standard deviation / sqrt(n))
  - z-score for 95% = 1.96, 90% = 1.645

### 3. Type definitions (at top of respective files):
```typescript
// budgets.ts types
export interface CreateBudgetParams {
  name: string;
  budgetType: 'annual' | 'quarterly' | 'monthly' | 'project';
  periodStart: string;
  periodEnd: string;
  accountId?: string;
  autoGenerate?: boolean;
  lookbackMonths?: number;
}

export interface VarianceSummary {
  totalBudgeted: number;
  totalActual: number;
  totalVariance: number;
  overBudgetCategories: Array<{ category: string; variance: number; percent: number }>;
  underBudgetCategories: Array<{ category: string; variance: number; percent: number }>;
  topVariances: Array<{ category: string; budgeted: number; actual: number; variance: number }>;
  health: 'on_track' | 'over_budget' | 'under_budget';
}

// forecasting.ts types
export interface CreateScenarioParams {
  name: string;
  scenarioType: 'optimistic' | 'realistic' | 'pessimistic' | 'custom';
  basePeriodStart: string;
  basePeriodEnd: string;
  forecastMonths: number;
  assumptions?: Record<string, any>;
}

export interface ScenarioComparison {
  months: Array<{ period: string; scenarios: Record<string, number> }>;
  totals: Record<string, number>;
}
```

## Files to MODIFY
None -- standalone service files.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `BudgetService` generates budget lines from historical transactions
- [ ] Variance calculation: `variance_amount = actual_amount - budgeted_amount`
- [ ] Forecast respects growth rates (optimistic > realistic > pessimistic)
- [ ] Confidence intervals: lower bound < forecast < upper bound
- [ ] Seasonal factors average to approximately 1.0 across all months
- [ ] Create marker file: `.agent-done-W13-03`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W13-01`) -- schema tables (budgets, budget_lines, budget_vs_actual, forecast_scenarios, forecast_periods)
- **Reuses**: schema.ts (transactions table for historical data), categories.ts
