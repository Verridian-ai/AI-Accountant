# Agent 6: Cognee Datasets Builder

## Role
Configure three new Cognee datasets for inventory and bank reconciliation knowledge domains, adding dataset constants, helper search methods, and indexing utilities to the existing Cognee tools layer.

## Priority: WAVE 11 (After Agent 1)

## Files to MODIFY

### 1. `server/src/services/claude/cognee-tools.ts` (lines 24-42, COGNEE_DATASETS constant)
**BEFORE**:
```typescript
/** Standard Cognee dataset names for GoldLedger domains */
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
**AFTER**:
```typescript
/** Standard Cognee dataset names for GoldLedger domains */
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
  // Inventory domain
  inventoryCatalog: 'inventory_catalog',
  stockMovements: 'stock_movements',
  // Reconciliation domain
  reconPatterns: 'recon_patterns',
} as const;
```

- [ ] Add 3 new dataset entries: `inventoryCatalog`, `stockMovements`, `reconPatterns`

### 2. `server/src/services/claude/cognee-tools.ts` (after line 116, before `private prefixDataset`)
**Purpose**: Add 5 new convenience methods for inventory and reconciliation domains

**ADD** the following methods to the `CogneeTools` class:

```typescript
  /**
   * Index inventory item catalog data for semantic search.
   * Each item is formatted as a human-readable string for embedding.
   */
  async indexInventoryItems(items: Array<{ sku: string; name: string; category: string; supplier?: string; costCents: number }>): Promise<void> {
    const texts = items.map(item =>
      `Product: ${item.name} (SKU: ${item.sku}). Category: ${item.category}. ` +
      `Unit cost: $${(item.costCents / 100).toFixed(2)}. ` +
      (item.supplier ? `Supplier: ${item.supplier}.` : '')
    );
    await this.index(texts, COGNEE_DATASETS.inventoryCatalog);
  }

  /**
   * Search inventory catalog using CHUNKS for fast vector similarity.
   */
  async searchInventoryCatalog(query: string): Promise<string[]> {
    return this.search(query, COGNEE_DATASETS.inventoryCatalog, 'CHUNKS');
  }

  /**
   * Index stock movement summaries for pattern recognition.
   * Helps identify seasonal demand, supplier lead times, etc.
   */
  async indexStockMovements(movements: Array<{ itemName: string; movementType: string; quantity: number; date: string; warehouse: string }>): Promise<void> {
    const texts = movements.map(m =>
      `${m.movementType}: ${Math.abs(m.quantity)} units of ${m.itemName} ` +
      `at ${m.warehouse} on ${m.date}.`
    );
    await this.index(texts, COGNEE_DATASETS.stockMovements);
  }

  /**
   * Search stock movement patterns using GRAPH_COMPLETION for reasoning.
   * Useful for questions like "what are the seasonal patterns for product X?"
   */
  async searchStockPatterns(query: string): Promise<string[]> {
    return this.search(query, COGNEE_DATASETS.stockMovements, 'GRAPH_COMPLETION');
  }

  /**
   * Index reconciliation patterns (successful matches, common discrepancies).
   * Helps the recon agent learn from historical matching decisions.
   */
  async indexReconPatterns(patterns: Array<{ bankDescription: string; ledgerReference: string; matchType: string; confidence: number }>): Promise<void> {
    const texts = patterns.map(p =>
      `Recon match (${p.matchType}, confidence: ${p.confidence.toFixed(2)}): ` +
      `Bank "${p.bankDescription}" matched to Ledger "${p.ledgerReference}".`
    );
    await this.index(texts, COGNEE_DATASETS.reconPatterns);
  }

  /**
   * Search reconciliation patterns using GRAPH_COMPLETION for reasoning.
   * Useful for finding similar past matches to inform new matching decisions.
   */
  async searchReconPatterns(query: string): Promise<string[]> {
    return this.search(query, COGNEE_DATASETS.reconPatterns, 'GRAPH_COMPLETION');
  }
```

### 3. `server/src/services/cognee_client.ts`
**Purpose**: No changes needed to the client itself, but verify the datasets are properly supported

- [ ] Verify that `cogneeClient.add()` and `cogneeClient.search()` work with the new dataset names — no changes needed since datasets are created on-demand by Cognee
- [ ] If `createDataset()` method exists, add a comment documenting the 3 new datasets

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `COGNEE_DATASETS.inventoryCatalog` resolves to `'inventory_catalog'`
- [ ] `COGNEE_DATASETS.stockMovements` resolves to `'stock_movements'`
- [ ] `COGNEE_DATASETS.reconPatterns` resolves to `'recon_patterns'`
- [ ] `cogneeTools.searchInventoryCatalog('test')` can be called without type errors
- [ ] `cogneeTools.indexInventoryItems([...])` can be called without type errors
- [ ] `cogneeTools.searchReconPatterns('test')` can be called without type errors
- [ ] `cogneeTools.indexReconPatterns([...])` can be called without type errors
- [ ] Create marker file: `.agent-done-W11-06`

## Dependencies
- **Agent 1** (schema must exist, but not strictly required for cognee-tools changes)
- **Reuses**: cognee-tools.ts, cognee_client.ts (single source of truth for Cognee HTTP)
