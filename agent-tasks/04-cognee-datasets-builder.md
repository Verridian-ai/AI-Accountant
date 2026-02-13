# Agent 4: Cognee Datasets Builder

## Role
Configure Cognee datasets and search strategies for tax, loan, and economic data domains.

## Priority: WAVE 2 (After Agent 2 completes)

## Wait Condition
Check for `.agent-done-02` marker file before starting.

## Context
- Cognee client: `server/src/services/cognee_client.ts` — HTTP wrapper for Cognee API at localhost:8000
- Cognee tools: `server/src/services/claude/cognee-tools.ts` — Agent-facing wrapper with dataset prefix support
- Cognee search types: `GRAPH_COMPLETION`, `CHUNKS`, `INSIGHTS`, `CHUNKS_LEXICAL`, `RAG_COMPLETION`
- Current datasets used: `financial_insights`, `transaction_patterns`, `merchant_data`

## Files to MODIFY

### 1. `server/src/services/claude/cognee-tools.ts`
**Current state** (line 17-21):
```typescript
const DEFAULT_CONFIG: CogneeToolConfig = {
  searchTopK: 5,
  indexBatchSize: 50,
  datasetPrefix: '',
};
```

Tasks:
- [ ] Add new dataset constants after line 21:
```typescript
/** Standard Cognee dataset names for GoldLedger domains */
export const COGNEE_DATASETS = {
  // Existing
  financialInsights: 'financial_insights',
  transactionPatterns: 'transaction_patterns',
  merchantData: 'merchant_data',
  // Tax domain (new)
  taxStrategies: 'tax_strategies',
  taxRulings: 'tax_rulings',
  deductionPatterns: 'deduction_patterns',
  // Loan domain (new)
  loanProducts: 'loan_products',
  interestRates: 'interest_rates',
  // Economic domain (new)
  economicIndicators: 'economic_indicators',
  rbaData: 'rba_data',
  // Budget domain (new)
  budgetPatterns: 'budget_patterns',
  spendingInsights: 'spending_insights',
} as const;
```

- [ ] Add helper method to CogneeTools class for batch indexing tax strategies:
```typescript
async indexTaxStrategies(strategies: Array<{ name: string; description: string; saving: number }>): Promise<void> {
  const texts = strategies.map(s => `Strategy: ${s.name}. ${s.description}. Estimated saving: $${s.saving}`);
  await this.index(texts, COGNEE_DATASETS.taxStrategies);
}
```

- [ ] Add helper method for searching tax rulings:
```typescript
async searchTaxRulings(query: string): Promise<string[]> {
  return this.search(query, COGNEE_DATASETS.taxRulings, 'RAG_COMPLETION');
}
```

- [ ] Add helper method for economic data search:
```typescript
async searchEconomicData(query: string): Promise<string[]> {
  return this.search(query, COGNEE_DATASETS.economicIndicators, 'CHUNKS');
}
```

### 2. `server/src/services/cognee_client.ts`
Tasks:
- [ ] Verify the `add()` method supports the new dataset names (it should — datasets are just string identifiers)
- [ ] Verify `search()` method supports all 5 search types listed above
- [ ] Add JSDoc comments documenting which search type to use for each domain:
  - Tax strategies: `GRAPH_COMPLETION` (relationship-aware)
  - Tax rulings: `RAG_COMPLETION` (document retrieval)
  - Deduction patterns: `CHUNKS` (pattern matching)
  - Loan products: `CHUNKS_LEXICAL` (exact term matching)
  - Economic data: `CHUNKS` (time-series friendly)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] COGNEE_DATASETS constant is exported and accessible
- [ ] New helper methods compile without errors
- [ ] Create marker file: `.agent-done-04`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-02`) — Docker services must be ready
- **No file conflicts**: Only this agent modifies cognee-tools.ts and cognee_client.ts
