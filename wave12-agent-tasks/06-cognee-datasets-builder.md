# Agent 6: Cognee Datasets Builder

## Role
Configure 4 new Cognee datasets and search strategies for fixed assets, depreciation schedules, entity hierarchy, and consolidation patterns.

## Priority: WAVE 2 (After Agent 1 completes schema)

## Wait Condition
Check for `.agent-done-W12-01` marker file before starting.

## Context
- Cognee client: `server/src/services/cognee_client.ts` — HTTP wrapper for Cognee API at localhost:8000
- Cognee tools: `server/src/services/claude/cognee-tools.ts` — Agent-facing wrapper with dataset prefix support
- Cognee search types: `GRAPH_COMPLETION`, `CHUNKS`, `INSIGHTS`, `CHUNKS_LEXICAL`, `RAG_COMPLETION`
- Current datasets in `COGNEE_DATASETS` (cognee-tools.ts line 24-42): financialInsights, transactionPatterns, merchantData, taxStrategies, taxRulings, deductionPatterns, loanProducts, interestRates, economicIndicators, rbaData, budgetPatterns, spendingInsights

## Files to MODIFY

### 1. `server/src/services/claude/cognee-tools.ts`
**Current COGNEE_DATASETS constant** (line 24-42):
```typescript
export const COGNEE_DATASETS = {
  // Existing
  financialInsights: 'financial_insights',
  transactionPatterns: 'transaction_patterns',
  merchantData: 'merchant_data',
  // Tax domain
  taxStrategies: 'tax_strategies',
  taxRulings: 'tax_rulings',
  deductionPatterns: 'deduction_patterns',
  // Loan domain
  loanProducts: 'loan_products',
  interestRates: 'interest_rates',
  // Economic domain
  economicIndicators: 'economic_indicators',
  rbaData: 'rba_data',
  // Budget domain
  budgetPatterns: 'budget_patterns',
  spendingInsights: 'spending_insights',
} as const;
```

Tasks:
- [ ] Add 4 new dataset entries to `COGNEE_DATASETS` (after `spendingInsights` at line 41, before `} as const;`):
```typescript
  // Fixed Assets domain (Wave 12)
  assetRegister: 'asset_register',
  depreciationSchedules: 'depreciation_schedules',
  // Multi-Entity domain (Wave 12)
  entityHierarchy: 'entity_hierarchy',
  consolidationPatterns: 'consolidation_patterns',
```

- [ ] Add 4 new helper methods to `CogneeTools` class (after existing helper methods):

**Asset Register Indexing**:
```typescript
/**
 * Index fixed asset data for RAG-powered asset queries.
 * Indexes asset details, purchase info, depreciation method, and current WDV.
 */
async indexAssetRegister(assets: Array<{
  assetName: string;
  category: string;
  purchaseDate: string;
  purchasePrice: number;
  method: string;
  currentWDV: number;
  entityName?: string;
}>): Promise<void> {
  const texts = assets.map(a =>
    `Asset: ${a.assetName}. Category: ${a.category}. Purchased: ${a.purchaseDate} for $${(a.purchasePrice / 100).toFixed(2)}. Method: ${a.method}. Current WDV: $${(a.currentWDV / 100).toFixed(2)}.${a.entityName ? ` Entity: ${a.entityName}.` : ''}`
  );
  await this.index(texts, COGNEE_DATASETS.assetRegister);
}
```

**Depreciation Schedule Indexing**:
```typescript
/**
 * Index depreciation schedule results for historical lookups.
 * Enables questions like "What was depreciation on computer equipment last year?"
 */
async indexDepreciationSchedule(scheduleEntries: Array<{
  assetName: string;
  financialYear: string;
  openingValue: number;
  depreciation: number;
  closingValue: number;
  method: string;
}>): Promise<void> {
  const texts = scheduleEntries.map(e =>
    `Depreciation FY${e.financialYear}: ${e.assetName}. Opening: $${(e.openingValue / 100).toFixed(2)}. Depreciation: $${(e.depreciation / 100).toFixed(2)}. Closing: $${(e.closingValue / 100).toFixed(2)}. Method: ${e.method}.`
  );
  await this.index(texts, COGNEE_DATASETS.depreciationSchedules);
}
```

**Entity Hierarchy Indexing**:
```typescript
/**
 * Index entity structure and relationships for entity-aware queries.
 * Enables questions like "Which entity owns the Westpac business account?"
 */
async indexEntityHierarchy(entities: Array<{
  entityName: string;
  entityType: string;
  parentName?: string;
  accounts: string[];
  abn?: string;
}>): Promise<void> {
  const texts = entities.map(e =>
    `Entity: ${e.entityName} (${e.entityType}).${e.parentName ? ` Parent: ${e.parentName}.` : ''} Accounts: ${e.accounts.join(', ')}.${e.abn ? ` ABN: ${e.abn}.` : ''}`
  );
  await this.index(texts, COGNEE_DATASETS.entityHierarchy);
}
```

**Consolidation Pattern Indexing**:
```typescript
/**
 * Index consolidation patterns and elimination results for learning.
 * Enables AI to recognize recurring inter-entity patterns.
 */
async indexConsolidationPatterns(patterns: Array<{
  fromEntity: string;
  toEntity: string;
  transactionType: string;
  typicalAmount: number;
  frequency: string;
  eliminationApplied: boolean;
}>): Promise<void> {
  const texts = patterns.map(p =>
    `Inter-entity: ${p.fromEntity} → ${p.toEntity}. Type: ${p.transactionType}. Typical: $${(p.typicalAmount / 100).toFixed(2)}. Frequency: ${p.frequency}. Eliminated: ${p.eliminationApplied ? 'Yes' : 'No'}.`
  );
  await this.index(texts, COGNEE_DATASETS.consolidationPatterns);
}
```

- [ ] Add 4 new search helper methods:

```typescript
/** Search asset register for asset-related queries */
async searchAssetRegister(query: string): Promise<string[]> {
  return this.search(query, COGNEE_DATASETS.assetRegister, 'CHUNKS');
}

/** Search depreciation history — use CHUNKS_LEXICAL for exact FY matching */
async searchDepreciationSchedules(query: string): Promise<string[]> {
  return this.search(query, COGNEE_DATASETS.depreciationSchedules, 'CHUNKS_LEXICAL');
}

/** Search entity hierarchy — use GRAPH_COMPLETION for relationship queries */
async searchEntityHierarchy(query: string): Promise<string[]> {
  return this.search(query, COGNEE_DATASETS.entityHierarchy, 'GRAPH_COMPLETION');
}

/** Search consolidation patterns — use GRAPH_COMPLETION for inter-entity reasoning */
async searchConsolidationPatterns(query: string): Promise<string[]> {
  return this.search(query, COGNEE_DATASETS.consolidationPatterns, 'GRAPH_COMPLETION');
}
```

### 2. `server/src/services/cognee_client.ts`
Tasks:
- [ ] Verify the `add()` method supports the 4 new dataset names (it should — datasets are just string identifiers)
- [ ] Add JSDoc comments documenting which search type to use for each new domain:
  - Asset register: `CHUNKS` (fast vector similarity for asset lookups)
  - Depreciation schedules: `CHUNKS_LEXICAL` (exact keyword matching for FY and asset names)
  - Entity hierarchy: `GRAPH_COMPLETION` (relationship-aware for parent-child entity queries)
  - Consolidation patterns: `GRAPH_COMPLETION` (relationship-aware for inter-entity pattern reasoning)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] COGNEE_DATASETS constant now has 16 entries (12 existing + 4 new)
- [ ] All 4 indexing helper methods compile without errors
- [ ] All 4 search helper methods compile without errors
- [ ] New dataset names follow existing snake_case convention
- [ ] Create marker file: `.agent-done-W12-06`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W12-01`) — schema must exist so dataset shapes align with table columns
- **No file conflicts**: Only this agent modifies cognee-tools.ts and cognee_client.ts in Wave 12
