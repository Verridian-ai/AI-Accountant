# Agent 6: Cognee Datasets Builder

## Role
Configure Cognee datasets and search strategies for OCR extraction patterns and payment matching patterns.

## Priority: WAVE 14 (After Agent 1 completes)

## Wait Condition
Check for `.agent-done-W14-01` marker file before starting.

## Context
- Cognee client: `server/src/services/cognee_client.ts` -- HTTP wrapper for Cognee API at localhost:8000
- Cognee tools: `server/src/services/claude/cognee-tools.ts` -- Agent-facing wrapper with dataset prefix support
- Cognee search types: `GRAPH_COMPLETION`, `CHUNKS`, `INSIGHTS`, `CHUNKS_LEXICAL`, `RAG_COMPLETION`, `GRAPH_SUMMARY_COMPLETION`
- Current datasets (after Wave 13): 15 entries in COGNEE_DATASETS including financialReports, budgetTemplates, kpiHistory

## Files to MODIFY

### 1. `server/src/services/claude/cognee-tools.ts`
**Current state**: COGNEE_DATASETS object with 15 entries (after Wave 13)

Tasks:
- [ ] Add 2 new dataset constants to the COGNEE_DATASETS object:
```typescript
export const COGNEE_DATASETS = {
  // ... existing 15 entries ...
  // OCR & Payment matching domain (new - Wave 14)
  ocrExtractions: 'ocr_extractions',
  matchingPatterns: 'matching_patterns',
} as const;
```

- [ ] Add helper method to CogneeTools class for indexing OCR extraction results:
```typescript
/**
 * Index an OCR extraction result for learning vendor document patterns.
 * Future extractions can use past patterns to improve accuracy.
 * Uses CHUNKS_LEXICAL for exact vendor name matching.
 */
async indexOCRExtraction(extraction: {
  documentType: string;
  vendorName: string;
  vendorAbn?: string;
  totalAmount: number;
  lineItemCount: number;
  categories: string[];
  confidenceScore: number;
}): Promise<void> {
  const categories = extraction.categories.join(', ');
  const text = `OCR Extraction: ${extraction.documentType} from ${extraction.vendorName}` +
    (extraction.vendorAbn ? ` (ABN: ${extraction.vendorAbn})` : '') +
    `. Total: $${extraction.totalAmount.toFixed(2)}, ${extraction.lineItemCount} line items. ` +
    `Categories: ${categories}. Confidence: ${(extraction.confidenceScore * 100).toFixed(0)}%`;
  await this.index([text], COGNEE_DATASETS.ocrExtractions);
}
```

- [ ] Add helper method for indexing confirmed payment matching patterns:
```typescript
/**
 * Index a confirmed payment match pattern for improving future matching accuracy.
 * Stores the relationship between document characteristics and matched transaction.
 * Uses GRAPH_COMPLETION for relationship-aware retrieval.
 */
async indexMatchingPattern(pattern: {
  vendorName: string;
  documentType: string;
  typicalAmount: number;
  amountVariance: number;
  typicalDaysBetween: number;
  matchMethod: string;
  transactionDescriptionPattern: string;
}): Promise<void> {
  const text = `Match Pattern: ${pattern.vendorName} ${pattern.documentType}. ` +
    `Typical amount: $${pattern.typicalAmount.toFixed(2)} (+/- $${pattern.amountVariance.toFixed(2)}). ` +
    `Usually paid ${pattern.typicalDaysBetween} days after document date. ` +
    `Bank description pattern: "${pattern.transactionDescriptionPattern}". ` +
    `Match method: ${pattern.matchMethod}`;
  await this.index([text], COGNEE_DATASETS.matchingPatterns);
}
```

- [ ] Add search helpers for OCR and matching agents:
```typescript
/**
 * Search past OCR extractions to find similar vendor document patterns.
 * Helps improve extraction accuracy for known vendors.
 */
async searchOCRExtractions(query: string): Promise<string[]> {
  return this.search(query, COGNEE_DATASETS.ocrExtractions, 'CHUNKS_LEXICAL');
}

/**
 * Search confirmed matching patterns to find likely transaction matches.
 * Uses relationship-aware search to understand vendor-transaction connections.
 */
async searchMatchingPatterns(query: string): Promise<string[]> {
  return this.search(query, COGNEE_DATASETS.matchingPatterns, 'GRAPH_COMPLETION');
}
```

- [ ] Add batch indexing method for processing backlog of confirmed matches:
```typescript
/**
 * Batch index confirmed matches for pattern learning.
 * Call after bulk confirmation of matches.
 */
async batchIndexMatchingPatterns(patterns: Array<{
  vendorName: string;
  documentType: string;
  typicalAmount: number;
  amountVariance: number;
  typicalDaysBetween: number;
  matchMethod: string;
  transactionDescriptionPattern: string;
}>): Promise<void> {
  const texts = patterns.map(p =>
    `Match Pattern: ${p.vendorName} ${p.documentType}. ` +
    `Amount: $${p.typicalAmount.toFixed(2)} (+/- $${p.amountVariance.toFixed(2)}). ` +
    `Days to payment: ${p.typicalDaysBetween}. Bank desc: "${p.transactionDescriptionPattern}"`
  );
  await this.index(texts, COGNEE_DATASETS.matchingPatterns);
}
```

### 2. `server/src/services/cognee_client.ts`
Tasks:
- [ ] Verify the `add()` method supports the 2 new dataset names (datasets are string identifiers)
- [ ] Verify `search()` method supports `CHUNKS_LEXICAL` and `GRAPH_COMPLETION` search types
- [ ] Add JSDoc comments documenting search type rationale for new domains:
  - OCR extractions: `CHUNKS_LEXICAL` (exact vendor name/ABN matching for pattern lookup)
  - Matching patterns: `GRAPH_COMPLETION` (relationship-aware for understanding vendor-amount-description connections)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] COGNEE_DATASETS now has 17 entries (15 from Wave 13 + 2 new)
- [ ] 2 new indexing helpers compile without errors
- [ ] 2 new search helpers compile without errors
- [ ] Batch indexing method compiles and follows existing batch pattern
- [ ] Methods follow existing pattern (index -> text array, search -> query + dataset + type)
- [ ] Create marker file: `.agent-done-W14-06`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W14-01`) -- Docker/Cognee services should be configured
- **No file conflicts**: Only this agent modifies cognee-tools.ts and cognee_client.ts during Wave 14
- **Note**: If Wave 13 Agent 6 has not yet run, this agent must also add the Wave 13 datasets. Check for `.agent-done-W13-06` marker.
