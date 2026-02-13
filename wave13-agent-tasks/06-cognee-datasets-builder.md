# Agent 6: Cognee Datasets Builder

## Role
Configure Cognee datasets and search strategies for financial reports, budget templates, and KPI history domains.

## Priority: WAVE 13 (After Agent 1 completes)

## Wait Condition
Check for `.agent-done-W13-01` marker file before starting.

## Context
- Cognee client: `server/src/services/cognee_client.ts` -- HTTP wrapper for Cognee API at localhost:8000
- Cognee tools: `server/src/services/claude/cognee-tools.ts` -- Agent-facing wrapper with dataset prefix support
- Cognee search types: `GRAPH_COMPLETION`, `CHUNKS`, `INSIGHTS`, `CHUNKS_LEXICAL`, `RAG_COMPLETION`, `GRAPH_SUMMARY_COMPLETION`
- Current datasets (from COGNEE_DATASETS at cognee-tools.ts line 24-42): financialInsights, transactionPatterns, merchantData, taxStrategies, taxRulings, deductionPatterns, loanProducts, interestRates, economicIndicators, rbaData, budgetPatterns, spendingInsights

## Files to MODIFY

### 1. `server/src/services/claude/cognee-tools.ts`
**Current state** (line 24-42): COGNEE_DATASETS object with 12 existing entries

Tasks:
- [ ] Add 3 new dataset constants to the COGNEE_DATASETS object:
```typescript
export const COGNEE_DATASETS = {
  // ... existing 12 entries ...
  // Financial reporting domain (new - Wave 13)
  financialReports: 'financial_reports',
  budgetTemplates: 'budget_templates',
  kpiHistory: 'kpi_history',
} as const;
```

- [ ] Add helper method to CogneeTools class for indexing financial report snapshots:
```typescript
/**
 * Index a financial report snapshot for future retrieval and comparison.
 * Uses CHUNKS search for fast vector similarity.
 */
async indexReportSnapshot(snapshot: {
  reportType: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  keyMetrics: Record<string, number>;
}): Promise<void> {
  const text = `Financial Report: ${snapshot.reportType} (${snapshot.periodStart} to ${snapshot.periodEnd}). ` +
    `Summary: ${snapshot.summary}. ` +
    `Key Metrics: ${Object.entries(snapshot.keyMetrics).map(([k, v]) => `${k}: $${v.toFixed(2)}`).join(', ')}`;
  await this.index([text], COGNEE_DATASETS.financialReports);
}
```

- [ ] Add helper method for indexing budget templates as learning patterns:
```typescript
/**
 * Index a budget template so the AI can learn from successful budget patterns.
 * Uses GRAPH_COMPLETION for relationship-aware retrieval.
 */
async indexBudgetTemplate(template: {
  name: string;
  budgetType: string;
  categoryAllocations: Array<{ category: string; percentOfTotal: number }>;
  health: string;
}): Promise<void> {
  const allocations = template.categoryAllocations
    .map(a => `${a.category}: ${(a.percentOfTotal * 100).toFixed(1)}%`)
    .join(', ');
  const text = `Budget Template: ${template.name} (${template.budgetType}). ` +
    `Health: ${template.health}. Allocations: ${allocations}`;
  await this.index([text], COGNEE_DATASETS.budgetTemplates);
}
```

- [ ] Add helper method for indexing KPI snapshots for trend analysis:
```typescript
/**
 * Index KPI metrics for historical trend analysis.
 * Uses CHUNKS for time-series friendly retrieval.
 */
async indexKPISnapshot(metrics: Array<{
  metricName: string;
  value: number;
  period: string;
  trend: string;
}>): Promise<void> {
  const texts = metrics.map(m =>
    `KPI: ${m.metricName} = ${m.value.toFixed(2)} for period ${m.period} (trend: ${m.trend})`
  );
  await this.index(texts, COGNEE_DATASETS.kpiHistory);
}
```

- [ ] Add search helpers for reporting agents:
```typescript
/**
 * Search historical financial reports for comparison and trend analysis.
 */
async searchFinancialReports(query: string): Promise<string[]> {
  return this.search(query, COGNEE_DATASETS.financialReports, 'CHUNKS');
}

/**
 * Search budget templates for pattern matching when creating new budgets.
 */
async searchBudgetTemplates(query: string): Promise<string[]> {
  return this.search(query, COGNEE_DATASETS.budgetTemplates, 'GRAPH_COMPLETION');
}

/**
 * Search KPI history for trend analysis across periods.
 */
async searchKPIHistory(query: string): Promise<string[]> {
  return this.search(query, COGNEE_DATASETS.kpiHistory, 'CHUNKS');
}
```

### 2. `server/src/services/cognee_client.ts`
Tasks:
- [ ] Verify the `add()` method supports the 3 new dataset names (it should -- datasets are just string identifiers)
- [ ] Verify `search()` method supports `CHUNKS`, `GRAPH_COMPLETION`, and `RAG_COMPLETION` search types
- [ ] Add JSDoc comments documenting which search type to use for each new domain:
  - Financial reports: `CHUNKS` (fast vector similarity for period comparisons)
  - Budget templates: `GRAPH_COMPLETION` (relationship-aware for category allocation patterns)
  - KPI history: `CHUNKS` (time-series friendly for trend detection)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] COGNEE_DATASETS now has 15 entries (12 existing + 3 new)
- [ ] All 3 new indexing helpers compile without errors
- [ ] All 3 new search helpers compile without errors
- [ ] Methods follow existing pattern (index -> text array, search -> query + dataset + type)
- [ ] Create marker file: `.agent-done-W13-06`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W13-01`) -- Docker/Cognee services should be configured
- **No file conflicts**: Only this agent modifies cognee-tools.ts and cognee_client.ts during Wave 13
