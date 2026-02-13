# Agent W15-04: Forecasting Agent Builder

## Role
Build the forecasting Claude agent with tools for forecast generation, seasonality analysis, scenario comparison, and trend explanation.

## Priority: WAVE 15 (After W15-02 completes forecast engine)

## Wait Condition
Check for `.agent-done-W15-02` marker file before starting.

## Context
- Agent base class: `server/src/services/claude/agents/` -- follow `financial-planner.ts` pattern exactly
- Agent types: `server/src/services/claude/types.ts` -- AgentType union, I/O interfaces
- Agent config: `server/src/services/claude/config.ts` -- token budgets and model assignments
- Orchestrator: `server/src/services/claude/orchestrator.ts` -- agent registration

## Files to CREATE

### 1. `server/src/services/claude/agents/forecasting-agent.ts`
**Pattern**: Follow `server/src/services/claude/agents/financial-planner.ts` exactly

- [ ] Create `ForecastingAgent extends ClaudeAgent<ForecastingAgentInput, ForecastingAgentOutput>` with:

  - **System prompt**: "You are an expert financial forecasting analyst for Australian businesses. You analyze transaction patterns, seasonal trends, and economic indicators to generate accurate cash flow predictions. You understand Australian business cycles (BAS quarters, EOFY patterns, holiday spending). You provide clear explanations of trends and confidence levels."

  - **4 tools**:

    1. `generate_forecast` -- Parameters: `{ userId: string, accountId?: string, type: 'linear' | 'seasonal' | 'ml_weighted', startDate: string, endDate: string, granularity: string }`. Handler: calls `CashFlowForecastService.generateForecast()`. Returns forecast summary with period predictions.

    2. `analyze_seasonality` -- Parameters: `{ userId: string, accountId?: string, months: number }`. Handler: fetches historical transactions, runs `_seasonalDecompose()`, identifies peak/trough months, calculates seasonal indices. Returns: `{ seasonalIndices: number[], peakMonths: string[], troughMonths: string[], dominantCycle: string, strength: number }`.

    3. `compare_scenarios` -- Parameters: `{ forecastIds: string[] }` OR `{ userId: string, scenarios: Array<{ name: string, adjustments: Record<string, number> }> }`. Handler: calls `CashFlowForecastService.compareForecasts()` for existing, or generates ad-hoc scenario forecasts with adjustments (e.g., "revenue +10%", "rent increase 5%"). Returns side-by-side comparison.

    4. `explain_trend` -- Parameters: `{ userId: string, metric: 'inflow' | 'outflow' | 'net', period: string }`. Handler: analyzes transaction data for the period, identifies top contributing categories, merchants, and events. Uses Cognee search for context (e.g., known business events, economic changes). Returns narrative explanation.

  - **Tool handlers**: Wire to `CashFlowForecastService` (from W15-02), `cogneeTools.search()` for context enrichment

## Files to MODIFY

### 2. `server/src/services/claude/types.ts`
- [ ] Verify `forecasting_agent` exists in `AgentType` union (added by W15-02), add if missing
- [ ] Verify `ForecastingAgentInput` and `ForecastingAgentOutput` interfaces exist, add if missing

### 3. `server/src/services/claude/config.ts`
- [ ] Add to `AGENT_TOKEN_BUDGETS` (after existing entries):
  ```typescript
  forecasting_agent: { maxInputTokens: 80000, maxOutputTokens: 8192 },
  ```
- [ ] Add to `AGENT_MODELS` (after existing entries):
  ```typescript
  forecasting_agent: 'claude-sonnet-4-20250514',
  ```

### 4. `server/src/services/claude/orchestrator.ts`
- [ ] Import `ForecastingAgent` from `./agents/forecasting-agent.js`
- [ ] Register in agent map: `forecasting_agent: ForecastingAgent`

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `ForecastingAgent` can be instantiated via orchestrator
- [ ] All 4 tools are registered and callable
- [ ] `generate_forecast` tool handler correctly calls CashFlowForecastService
- [ ] `explain_trend` tool handler integrates Cognee search results
- [ ] Create marker file: `.agent-done-W15-04`

## Dependencies
- **Requires**: W15-02 (`.agent-done-W15-02`) -- CashFlowForecastService must exist
- **Reuses**: base-agent.ts, cognee-tools.ts, CashFlowForecastService
