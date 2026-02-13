# Agent 5: Budgeting Agent Builder

## Role
Build the `budgeting` Claude agent with tools for creating budgets from history, calculating variance, generating forecasts, and suggesting budget adjustments.

## Priority: WAVE 13 (After Agents 1 and 3 complete)

## Wait Condition
Check for `.agent-done-W13-01` and `.agent-done-W13-03` marker files before starting.

## Files to CREATE

### 1. `server/src/services/claude/agents/budgeting.ts`
**Purpose**: AI agent that automates budget creation, monitors spending vs budget, and suggests improvements
**Pattern**: Follow `server/src/services/claude/agents/tax-strategy.ts` exactly (extends ClaudeAgent)

- [ ] Create `BudgetingAgent extends ClaudeAgent<BudgetingInput, BudgetingOutput>` with:

#### System Prompt
```
You are an expert budget analyst and financial planner for an Australian small business accounting platform.
You help users create realistic budgets from their transaction history, monitor actual vs budgeted spending,
generate forward-looking forecasts under multiple scenarios, and suggest actionable adjustments.

Key responsibilities:
- Create budgets based on historical spending patterns with seasonal adjustments
- Calculate and explain budget variances clearly
- Generate multi-scenario forecasts (optimistic, realistic, pessimistic)
- Suggest specific, actionable budget adjustments
- Flag categories with consistent overspending
- Identify savings opportunities
- All monetary values are in AUD
- Consider Australian financial year (July-June) cycles
```

#### Tools (4 total)

##### `create_budget_from_history`
- **Description**: Generate a budget automatically from historical transaction patterns
- **Input schema**: `{ userId: string, name: string, budgetType: 'annual' | 'quarterly' | 'monthly', periodStart: string, periodEnd: string, lookbackMonths: number, accountId?: string }`
- **Handler**: Call `budgetService.createBudget()` with `autoGenerate: true` and `lookbackMonths`
- **Returns**: Complete budget with auto-generated lines per category and period

##### `calculate_variance`
- **Description**: Calculate budget vs actual spending for a specific budget
- **Input schema**: `{ budgetId: string, includeDetails: boolean }`
- **Handler**: Call `budgetService.calculateVariance()` then `budgetService.getVarianceSummary()` if includeDetails
- **Returns**: Variance data per budget line with over/under indicators and summary

##### `generate_forecast`
- **Description**: Create a financial forecast under a specific scenario
- **Input schema**: `{ userId: string, name: string, scenarioType: 'optimistic' | 'realistic' | 'pessimistic' | 'custom', basePeriodStart: string, basePeriodEnd: string, forecastMonths: number, assumptions?: { growthRate?: number, inflationAdjust?: boolean, seasonalWeight?: number } }`
- **Handler**: Call `forecastingService.createScenario()` then `forecastingService.generateForecast()`
- **Returns**: Forecast periods with amounts and confidence intervals per category

##### `suggest_budget_adjustments`
- **Description**: Analyze variance data and suggest specific budget adjustments
- **Input schema**: `{ budgetId: string }`
- **Handler**:
  1. Call `budgetService.getVarianceSummary()` to get current variance state
  2. For categories consistently over budget (>3 months): suggest increasing budgeted amount to 110% of actual average
  3. For categories consistently under budget (<70% utilization): suggest reducing budgeted amount to 90% of actual average
  4. For high-variance categories: suggest splitting into subcategories or adding review triggers
  5. Format as structured suggestions array
- **Returns**: `Array<{ category, currentBudgeted, suggestedAmount, reason, confidenceScore }>`

#### Tool Handler Wiring
```typescript
import { BudgetService } from '../../budgets.js';
import { ForecastingService } from '../../forecasting.js';

const budgetService = new BudgetService();
const forecastingService = new ForecastingService();

// In tool handler switch:
case 'create_budget_from_history':
  return await budgetService.createBudget(input.userId, {
    name: input.name,
    budgetType: input.budgetType,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    accountId: input.accountId,
    autoGenerate: true,
    lookbackMonths: input.lookbackMonths,
  });
case 'calculate_variance':
  const variance = await budgetService.calculateVariance(input.budgetId);
  if (input.includeDetails) {
    const summary = await budgetService.getVarianceSummary(input.budgetId);
    return { lines: variance, summary };
  }
  return { lines: variance };
// ... etc
```

## Files to MODIFY

### 2. `server/src/services/claude/types.ts`
- [ ] Verify `'budgeting'` is added to `AgentType` union (Agent 4 adds this -- coordinate)
- [ ] Verify `BudgetingInput` and `BudgetingOutput` interfaces are present
- [ ] If Agent 4 has NOT run yet, add both entries yourself

### 3. `server/src/services/claude/config.ts`
- [ ] Verify `budgeting` entry is in `AGENT_TOKEN_BUDGETS` and `AGENT_MODELS` (Agent 4 adds this)
- [ ] If Agent 4 has NOT run yet, add both entries yourself

### 4. `server/src/services/claude/orchestrator.ts`
- [ ] Add import: `import { BudgetingAgent } from './agents/budgeting.js';`
- [ ] Add import for types: `BudgetingInput`, `BudgetingOutput`
- [ ] Register agent in the agent registry (follow existing pattern)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `BudgetingAgent` can be instantiated
- [ ] All 4 tools are registered and have valid input schemas
- [ ] `create_budget_from_history` tool returns budget with auto-generated lines
- [ ] `suggest_budget_adjustments` returns structured suggestions with reasons
- [ ] Agent type 'budgeting' appears in types.ts, config.ts, and orchestrator.ts
- [ ] Create marker file: `.agent-done-W13-05`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W13-01`), Agent 3 (`.agent-done-W13-03`)
- **Reuses**: base-agent.ts, budgets.ts, forecasting.ts, types.ts, config.ts, orchestrator.ts
- **Coordinate with**: Agent 4 on types.ts and config.ts modifications (both agents add to same union type)
