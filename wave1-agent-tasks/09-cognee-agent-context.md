# Agent 9: Cognee Agent Context Enhancer

## Role
Enhance Cognee search integration to use intent-aware dataset selection, so each agent type automatically queries the most relevant Cognee datasets with the optimal search strategy.

## Priority: SUB-WAVE 2 (After Agent 2)

## Files to MODIFY

### 1. `server/src/services/claude/cognee-tools.ts`

#### Change 1: Add agent-aware search method
**Add new method to CogneeTools class**:

```typescript
/**
 * Agent-aware Cognee search that selects datasets and search types
 * based on the agent that will process the results.
 *
 * This replaces ad-hoc dataset selection with a systematic mapping
 * of agent types to their preferred Cognee search strategies.
 */
async searchForAgent(
  query: string,
  agentType: AgentType,
  options?: {
    topK?: number;
    dateRange?: { start: string; end: string };
    accountIds?: string[];
  }
): Promise<Array<{ content: string; score: number; dataset: string; searchType: string }>> {
  const strategy = this.getAgentSearchStrategy(agentType);
  const results: Array<{ content: string; score: number; dataset: string; searchType: string }> = [];

  for (const search of strategy.searches) {
    try {
      const searchResults = await this.client.search(query, {
        search_type: search.searchType,
        datasets: search.datasets,
        top_k: options?.topK ?? search.defaultTopK ?? 5,
      });

      if (searchResults && Array.isArray(searchResults)) {
        results.push(
          ...searchResults.map((r: any) => ({
            content: typeof r === 'string' ? r : r.content ?? r.text ?? JSON.stringify(r),
            score: r.score ?? r.relevance ?? 0.5,
            dataset: search.datasets[0] ?? 'unknown',
            searchType: search.searchType,
          }))
        );
      }
    } catch (error) {
      console.warn(`[CogneeTools] Search failed for ${agentType} / ${search.searchType}:`, error);
      // Non-fatal — continue with remaining searches
    }
  }

  // Sort by score descending, deduplicate
  return results
    .sort((a, b) => b.score - a.score)
    .filter((item, index, self) =>
      index === self.findIndex(t => t.content === item.content)
    );
}
```

#### Change 2: Add agent search strategy mapping
```typescript
private getAgentSearchStrategy(agentType: AgentType): {
  searches: Array<{
    searchType: string;
    datasets: string[];
    defaultTopK: number;
  }>;
} {
  const strategies: Partial<Record<AgentType, ReturnType<typeof this.getAgentSearchStrategy>>> = {
    gst_calculator: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['transactions'], defaultTopK: 10 },
        { searchType: 'RAG_COMPLETION', datasets: ['tax_rulings'], defaultTopK: 3 },
      ],
    },
    transaction_categorizer: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['transactions', 'transaction_patterns'], defaultTopK: 10 },
        { searchType: 'CHUNKS_LEXICAL', datasets: ['merchant_memory'], defaultTopK: 5 },
      ],
    },
    merchant_intelligence: {
      searches: [
        { searchType: 'CHUNKS_LEXICAL', datasets: ['merchant_memory'], defaultTopK: 10 },
        { searchType: 'GRAPH_COMPLETION', datasets: ['merchant_memory'], defaultTopK: 3 },
      ],
    },
    budget_analyzer: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['transactions', 'financial_reports'], defaultTopK: 10 },
      ],
    },
    tax_strategy: {
      searches: [
        { searchType: 'GRAPH_COMPLETION', datasets: ['tax_strategies', 'tax_rulings'], defaultTopK: 5 },
        { searchType: 'CHUNKS', datasets: ['transactions'], defaultTopK: 5 },
      ],
    },
    personal_tax_claims: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['transactions'], defaultTopK: 10 },
        { searchType: 'RAG_COMPLETION', datasets: ['tax_rulings'], defaultTopK: 3 },
      ],
    },
    financial_planner: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['transactions', 'financial_reports'], defaultTopK: 8 },
      ],
    },
    financial_reporting: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['financial_reports', 'transactions'], defaultTopK: 10 },
      ],
    },
    payroll_agent: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['transactions'], defaultTopK: 10 },
      ],
    },
    account_reconciler: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['transactions', 'recon_patterns'], defaultTopK: 10 },
      ],
    },
    cross_account_tracer: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['transactions'], defaultTopK: 10 },
        { searchType: 'GRAPH_COMPLETION', datasets: ['transactions'], defaultTopK: 3 },
      ],
    },
    forecasting: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['transactions', 'temporal_patterns'], defaultTopK: 10 },
      ],
    },
    compliance_monitoring: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['tax_strategies'], defaultTopK: 5 },
        { searchType: 'RAG_COMPLETION', datasets: ['tax_rulings'], defaultTopK: 3 },
      ],
    },
    inventory_agent: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['inventory_catalog', 'stock_movements'], defaultTopK: 10 },
      ],
    },
    bank_reconciler_agent: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['recon_patterns', 'transactions'], defaultTopK: 10 },
      ],
    },
    ocr_processing: {
      searches: [
        { searchType: 'CHUNKS_LEXICAL', datasets: ['ocr_extractions'], defaultTopK: 5 },
      ],
    },
    payment_matching: {
      searches: [
        { searchType: 'GRAPH_COMPLETION', datasets: ['matching_patterns'], defaultTopK: 5 },
      ],
    },
    asset_management: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['asset_register', 'depreciation_schedules'], defaultTopK: 5 },
      ],
    },
    multi_entity: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['entity_hierarchy', 'consolidation_patterns'], defaultTopK: 5 },
      ],
    },
    budgeting: {
      searches: [
        { searchType: 'CHUNKS', datasets: ['budget_templates', 'financial_reports'], defaultTopK: 5 },
      ],
    },
  };

  return strategies[agentType] ?? {
    searches: [
      { searchType: 'CHUNKS', datasets: ['transactions'], defaultTopK: 5 },
    ],
  };
}
```

### 2. `server/src/services/cognee_client.ts`

#### Change: Add `searchWithStrategy()` helper
If not already present, add a convenience method to the CogneeClient class:

```typescript
/**
 * Search with explicit search type and dataset selection.
 * Used by CogneeTools.searchForAgent() for intent-aware searches.
 */
async searchWithStrategy(
  query: string,
  searchType: string,
  datasets: string[],
  topK: number = 5
): Promise<unknown[]> {
  return this.search(query, {
    search_type: searchType,
    datasets,
    top_k: topK,
  });
}
```

- [ ] Only add this method if the existing `search()` method doesn't already support these parameters
- [ ] Do NOT modify any existing methods on CogneeClient (BC-06)
- [ ] Do NOT create a parallel client class

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `searchForAgent("BAS Q2", "gst_calculator")` returns results from CHUNKS + RAG_COMPLETION
- [ ] `searchForAgent("fuel expenses", "budget_analyzer")` returns results from CHUNKS only
- [ ] `searchForAgent("merchant ABC", "merchant_intelligence")` returns results from CHUNKS_LEXICAL
- [ ] Unknown agent types fall back to generic CHUNKS search on transactions
- [ ] Failed searches don't throw — they log warnings and continue
- [ ] No existing CogneeTools or CogneeClient methods are modified
- [ ] Create marker file: `.agent-done-W01-09`

## Dependencies
- **Requires**: Agent 2 (IntentRouter — for understanding the AgentType→dataset mapping concept)
- **Reuses**: Existing `CogneeClient.search()` method, `CogneeTools` class patterns
