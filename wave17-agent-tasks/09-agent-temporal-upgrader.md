# Agent W17-09: Agent Temporal Upgrader

## Role
Add temporal query support to existing Claude agents. Enable agents to perform time-aware searches, cross-module queries, and timeline generation.

## Priority: WAVE 17 (After W17-06 completes cognee temporal extension)

## Wait Condition
Check for `.agent-done-W17-06` marker file before starting.

## Context
- Existing agents at `server/src/services/claude/agents/`
- New cognee-tools methods: `temporalSearch()`, `crossModuleSearch()`, `searchTimeline()`, `indexCrossModuleInsight()` (from W17-06)
- All agents already have access to cogneeTools instance via constructor injection or import

## Files to MODIFY

### 1. `server/src/services/claude/agents/forecasting-agent.ts`
- [ ] Add new tool: `temporal_forecast_search`
  - Parameters: `{ query: string, timeStart: string, timeEnd?: string, granularity?: string }`
  - Handler: calls `cogneeTools.temporalSearch(query, COGNEE_DATASETS.forecastPatterns, { start: timeStart, end: timeEnd })` to find historical forecast patterns for specific time periods
  - Use case: "What were the forecast patterns for Q4 2024?" or "How did December spending compare to forecast?"

- [ ] Add new tool: `cross_module_forecast_context`
  - Parameters: `{ query: string, modules?: string[] }`
  - Handler: calls `cogneeTools.crossModuleSearch(query, modules || ['transactions', 'compliance', 'tax'])` to gather context from multiple modules that might affect forecast accuracy
  - Use case: enriching forecast explanations with tax deadline impacts, compliance timing, spending trend context

### 2. `server/src/services/claude/agents/compliance-monitoring-agent.ts`
- [ ] Add new tool: `temporal_compliance_search`
  - Parameters: `{ query: string, period: string, lookbackMonths?: number }`
  - Handler: calculates time range from period and lookback, calls `cogneeTools.temporalSearch(query, COGNEE_DATASETS.complianceRulings, timeRange)` to find time-relevant compliance context
  - Use case: "What compliance issues occurred in similar periods?" or "ATO ruling changes affecting this quarter's BAS"

- [ ] Add new tool: `compliance_timeline`
  - Parameters: `{ userId: string, startDate: string, endDate: string }`
  - Handler: calls `cogneeTools.searchTimeline(query, { start: startDate, end: endDate }, ['compliance', 'tax', 'bas'])` to generate compliance-focused timeline
  - Use case: building compliance history narrative for audit preparation

### 3. `server/src/services/claude/agents/tax-strategy.ts`
- [ ] Add new tool: `temporal_tax_search`
  - Parameters: `{ query: string, financialYear: string }`
  - Handler: converts financial year to date range, calls `cogneeTools.temporalSearch(query, COGNEE_DATASETS.taxStrategies, timeRange)` for year-specific tax context
  - Use case: "Tax strategies that worked in 2023-24" or "Deduction patterns for this financial year"

- [ ] Add new tool: `cross_module_tax_impact`
  - Parameters: `{ query: string }`
  - Handler: calls `cogneeTools.crossModuleSearch(query, ['tax', 'transactions', 'compliance', 'forecasting'])` to assess cross-module tax impact
  - Use case: understanding how spending patterns, compliance status, and forecasts affect tax strategy recommendations

### 4. `server/src/services/claude/agents/gst-calculator.ts`
- [ ] Add new tool: `temporal_gst_search`
  - Parameters: `{ query: string, basQuarter: string }`
  - Handler: converts BAS quarter to date range, calls `cogneeTools.temporalSearch(query, COGNEE_DATASETS.taxStrategies, timeRange)` for quarter-specific GST context
  - Use case: "GST classification changes affecting this BAS quarter" or "Similar transactions classified in previous quarters"

### 5. `server/src/services/claude/agents/transaction-categorizer.ts`
- [ ] Add new tool: `temporal_categorization_search`
  - Parameters: `{ query: string, dateRange?: { start: string; end: string } }`
  - Handler: calls `cogneeTools.temporalSearch(query, COGNEE_DATASETS.transactionPatterns, dateRange || defaultLast3Months)` for time-relevant categorization patterns
  - Use case: "How was this merchant categorized in recent months?" or "Category trends for this time period"

### 6. `server/src/services/claude/agents/merchant-intelligence.ts`
- [ ] Add new tool: `merchant_timeline`
  - Parameters: `{ merchantName: string, months: number }`
  - Handler: calculates date range, calls `cogneeTools.searchTimeline(merchantName, { start, end }, ['transactions', 'merchant'])` for merchant activity over time
  - Use case: building merchant profile with temporal context (payment frequency changes, amount trends)

### 7. `server/src/services/claude/agents/financial-planner.ts`
- [ ] Add new tool: `temporal_financial_search`
  - Parameters: `{ query: string, timeRange: { start: string; end: string } }`
  - Handler: calls `cogneeTools.temporalSearch(query, COGNEE_DATASETS.financialInsights, timeRange)` for time-relevant financial planning context
  - Use case: "Financial patterns from the same period last year" or "Seasonal spending insights for planning"

- [ ] Add new tool: `cross_module_planning_context`
  - Parameters: `{ query: string }`
  - Handler: calls `cogneeTools.crossModuleSearch(query, ['transactions', 'forecasting', 'tax', 'analytics'])` for comprehensive planning context
  - Use case: gathering all relevant context for financial plan recommendations

### 8. `server/src/services/claude/agents/cross-account-tracer.ts`
- [ ] Add new tool: `temporal_transfer_search`
  - Parameters: `{ query: string, dateRange: { start: string; end: string } }`
  - Handler: calls `cogneeTools.temporalSearch(query, COGNEE_DATASETS.transactionPatterns, dateRange)` for time-specific transfer patterns
  - Use case: "Inter-account transfers in this period" or "Fund flow patterns over the last quarter"

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All modified agents still instantiate without errors via orchestrator
- [ ] New temporal tools are registered in each agent's tool list
- [ ] `temporal_forecast_search` calls `cogneeTools.temporalSearch()` with correct dataset
- [ ] `cross_module_forecast_context` calls `cogneeTools.crossModuleSearch()` with correct modules
- [ ] `temporal_compliance_search` correctly calculates time range from period and lookback
- [ ] `temporal_tax_search` correctly converts financial year '2024-25' to date range
- [ ] `temporal_gst_search` correctly converts BAS quarter to date range
- [ ] No breaking changes to existing agent tools
- [ ] All agents compile and can be instantiated after modifications
- [ ] Create marker file: `.agent-done-W17-09`

## Dependencies
- **Requires**: W17-06 (`.agent-done-W17-06`) -- temporal cognee-tools extensions
- **IMPORTANT**: This agent modifies multiple agent files -- no other Wave 17 agent should touch these files
- **Reuses**: cognee-tools.ts (temporal methods), existing agent files
