# Agent 6: Cognee AR Datasets Builder

## Role
Configure Cognee datasets for AR aging patterns and extend CogneeTools with AR-specific search and indexing methods.

## Priority: WAVE 9 (After Agent 1)

## Files to MODIFY

### 1. `server/src/services/claude/cognee-tools.ts`
**Purpose**: Add AR aging dataset constants and methods to CogneeTools class
**Pattern**: Follow existing `indexReconPatterns()` / `searchReconPatterns()` method pattern

**Add to COGNEE_DATASETS constant**:
```typescript
ar_aging_patterns: 'ar_aging_patterns',
```

**Add methods to CogneeTools class**:

- [ ] `indexARAgingData(agingReport: ARAgingReport): Promise<void>`
  - Format aging data as structured text for Cognee indexing
  - Include: customer names, amounts, days outstanding, bucket distribution
  - Index into `ar_aging_patterns` dataset
  - Use `indexAndCognify()` with financial custom_prompt

- [ ] `searchARAgingPatterns(query: string, topK?: number): Promise<string[]>`
  - Search `ar_aging_patterns` dataset using GRAPH_COMPLETION
  - Useful for: "Which customers always pay late?", "What's the trend in overdue accounts?"
  - Cross-reference with `payment_patterns` dataset (Wave 8)

- [ ] `indexCustomerPaymentBehavior(customerId: string, paymentHistory: PaymentHistoryData): Promise<void>`
  - Index individual customer payment behavior for trend analysis
  - Include: average days to pay, payment frequency, late payment count
  - Index into `ar_aging_patterns` dataset

- [ ] `searchCustomerRisk(query: string, topK?: number): Promise<string[]>`
  - Search for customer risk assessment using GRAPH_COMPLETION
  - Combines AR aging with payment patterns for risk scoring
  - Useful for: "Who is a high-risk debtor?", "Credit risk assessment for customer X"

**Search type selection**:
- `ar_aging_patterns` → GRAPH_COMPLETION (needs reasoning about trends and risk)
- Cross-reference with `payment_patterns` → GRAPH_COMPLETION (multi-dataset reasoning)

### 2. `server/src/services/cognee_client.ts`
**Purpose**: No changes needed — existing `search()`, `add()`, `cognify()` methods are sufficient
**Note**: If Wave 3 has added per-user dataset prefixing, ensure AR dataset names use the prefix

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `COGNEE_DATASETS.ar_aging_patterns` resolves to 'ar_aging_patterns'
- [ ] `indexARAgingData()` successfully indexes aging report data
- [ ] `searchARAgingPatterns("customers who pay late")` returns relevant results
- [ ] Create marker file: `.agent-done-W09-06`

## Dependencies
- **Agent 1** must complete schema (for type imports)
- **Existing dependency**: CogneeTools class must exist (it does — from base codebase)
- **Runtime**: Cognee service must be healthy for indexing/search
