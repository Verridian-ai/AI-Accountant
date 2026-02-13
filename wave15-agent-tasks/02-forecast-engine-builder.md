# Agent W15-02: Forecast Engine Builder

## Role
Build the cash flow forecasting engine with linear, seasonal, and ML-weighted prediction models.

## Priority: WAVE 15 (After W15-01 completes schema)

## Wait Condition
Check for `.agent-done-W15-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/cash-flow-forecast.ts`
**Purpose**: Multi-model cash flow forecasting engine
**Pattern**: Follow existing service pattern from `server/src/services/tax-return.ts`

- [ ] Create `CashFlowForecastService` class with the following methods:

  - `generateForecast(userId: string, accountId: string | null, options: ForecastOptions): Promise<CashFlowForecast>` -- Main entry point. Options include `type` ('linear' | 'seasonal' | 'ml_weighted'), `startDate`, `endDate`, `granularity` ('daily' | 'weekly' | 'monthly' | 'quarterly'). Fetches historical transactions, selects model, generates period predictions with confidence bands.

  - `projectPeriods(transactions: Transaction[], model: ForecastModel, granularity: string): Promise<ForecastPeriod[]>` -- Generates per-period predictions. For 'linear': least-squares regression on net cash flow. For 'seasonal': decompose into trend + seasonal indices (12-month cycle). For 'ml_weighted': weighted ensemble of linear (0.3), seasonal (0.5), and recent-trend (0.2).

  - `calculateAccuracy(forecastId: string): Promise<AccuracyMetrics>` -- Compares predicted vs actual for periods with actual data. Returns MAE, RMSE, MAPE, and direction accuracy (% of periods where predicted direction matched actual).

  - `compareForecasts(forecastIds: string[]): Promise<ForecastComparison>` -- Side-by-side comparison of multiple forecasts. Returns per-period deltas, accuracy rankings, and recommendation.

  - `updateActuals(forecastId: string): Promise<void>` -- Backfills actual_inflow, actual_outflow, actual_net for past periods from real transaction data. Calculates variance and variance_pct.

  - `getForecasts(userId: string, status?: string): Promise<CashFlowForecast[]>` -- List forecasts with optional status filter.

  - `getForecastById(forecastId: string): Promise<CashFlowForecast & { periods: ForecastPeriod[] }>` -- Single forecast with all periods.

  - `archiveForecast(forecastId: string): Promise<void>` -- Set status to 'archived'.

- [ ] Implement private helper methods:
  - `_linearRegression(dataPoints: number[]): { slope: number; intercept: number; r2: number }` -- Least-squares fit
  - `_seasonalDecompose(dataPoints: number[], periodLength: number): { trend: number[]; seasonal: number[]; residual: number[] }` -- Classical decomposition
  - `_calculateConfidenceBands(predicted: number, stdDev: number, confidence: number): { lower: number; upper: number }` -- Z-score based
  - `_aggregateTransactionsByPeriod(transactions: Transaction[], granularity: string): Map<string, { inflow: number; outflow: number }>` -- Group and sum

- [ ] Define TypeScript interfaces:
  ```typescript
  interface ForecastOptions {
    type: 'linear' | 'seasonal' | 'ml_weighted';
    startDate: string;
    endDate: string;
    granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    confidenceLevel?: number;
    categoryBreakdown?: boolean;
  }
  interface ForecastPeriod {
    periodStart: string;
    periodEnd: string;
    predictedInflow: number;
    predictedOutflow: number;
    predictedNet: number;
    confidenceLower: number;
    confidenceUpper: number;
    breakdown?: Record<string, number>;
  }
  interface AccuracyMetrics {
    mae: number;
    rmse: number;
    mape: number;
    directionAccuracy: number;
    periodsEvaluated: number;
  }
  interface ForecastComparison {
    forecasts: Array<{ id: string; type: string; accuracy: AccuracyMetrics }>;
    recommendation: string;
    periodDeltas: Array<{ period: string; values: Record<string, number> }>;
  }
  ```

- [ ] Wire Drizzle ORM queries against `cashFlowForecasts` and `cashFlowForecastPeriods` tables (from schema.ts)
- [ ] Wire transaction queries: `db.select().from(transactions).where(and(eq(transactions.userId, userId), gte(transactions.date, startDate)))` for historical data

## Files to MODIFY

### 2. `server/src/services/claude/types.ts`
- [ ] Add `forecasting_agent` to `AgentType` union type (after existing agent types)
- [ ] Add interfaces: `ForecastingAgentInput { userId: string; accountId?: string; forecastType: string; period: string }`, `ForecastingAgentOutput { forecast: CashFlowForecast; insights: string[]; recommendations: string[] }`

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `CashFlowForecastService` can be instantiated without errors
- [ ] `generateForecast()` returns valid forecast structure with periods
- [ ] `_linearRegression()` produces correct slope/intercept for known test data
- [ ] `_seasonalDecompose()` correctly identifies monthly patterns
- [ ] Create marker file: `.agent-done-W15-02`

## Dependencies
- **Requires**: W15-01 (`.agent-done-W15-01`) -- schema tables must exist
- **Reuses**: schema.ts (cashFlowForecasts, cashFlowForecastPeriods, transactions)
