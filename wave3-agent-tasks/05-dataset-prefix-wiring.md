# Agent 5: Dataset Prefix Wiring

## Role
Wire per-user dataset prefix isolation into cognee-tools.ts and rag.ts so that all agent Cognee operations are scoped to the authenticated user's datasets.

## Priority: SUB-WAVE 2 (After Agent 2 completes)

## Files to MODIFY

### 1. `server/src/services/claude/cognee-tools.ts`
**Purpose**: Enable per-user dataset prefixing using the existing `prefixDataset()` infrastructure
**CRITICAL**: Read the full file (671 lines). It already has:
- `COGNEE_DATASETS` constant with 27 dataset names
- `config.datasetPrefix` (currently empty string)
- `prefixDataset()` private method that adds prefix when non-empty

#### Step 1: Add userId to CogneeTools config
```typescript
// BEFORE (approximate — find the actual config interface):
interface CogneeToolsConfig {
  datasetPrefix?: string;
  // ...
}

// AFTER:
interface CogneeToolsConfig {
  datasetPrefix?: string;
  userId?: string;  // Wave 3: user context for per-user isolation
  // ...
}
```

#### Step 2: Wire userId through to CogneeClient calls
Everywhere `cogneeTools` calls `cogneeClient.search(...)`, `cogneeClient.add(...)`, `cogneeClient.cognify(...)`, etc., pass `this.config.userId` as the last argument:

```typescript
// BEFORE (example):
const results = await this.client.search(query, dataset, topK, searchType);

// AFTER:
const results = await this.client.search(query, dataset, topK, searchType, this.config.userId);
```

Do this for ALL CogneeClient method calls in the file:
- `this.client.search(...)` → add `this.config.userId`
- `this.client.searchRich(...)` → add `this.config.userId`
- `this.client.add(...)` → add `this.config.userId`
- `this.client.cognify(...)` → add `this.config.userId`
- `this.client.addAndCognify(...)` → add `this.config.userId`
- `this.client.listDatasets(...)` → add `this.config.userId`
- `this.client.createDataPoint(...)` → add `this.config.userId`
- `this.client.getDataPoints(...)` → add `this.config.userId`
- `this.client.submitFeedback(...)` → add `this.config.userId`
- `this.client.applyOntology(...)` → add `this.config.userId`
- `this.client.temporalSearch(...)` → add `this.config.userId`
- `this.client.crossDatasetSearch(...)` → add `this.config.userId`
- Any other CogneeClient method calls

#### Step 3: Add factory method for user-scoped tools WITH dataset pooling

> **REVISION NOTE (D03 B3 — Dataset Proliferation):** Do NOT create per-user copies of ALL 35 datasets. Use a DATASET POOLING strategy:
> - **Shared datasets** (read-only, global): `gst_rules`, `ato_rulings`, `award_rates`, `stp_compliance` — these are reference data shared by all users. NO per-user prefix.
> - **Private datasets** (per-user): `bank_transactions`, `financial_insights`, `transaction_patterns`, `employee_profiles`, `pay_structures`, etc. — these contain user-specific data. Per-user prefix applied.
> - **Row-level filtering** for shared mutable data: Where multiple users contribute to the same dataset (e.g., `merchant_data`), use `user_id` metadata on each indexed document instead of per-user dataset copies.
>
> This reduces the multiplier from 35× per user to ~15× per user (shared datasets pooled).

```typescript
// REVISION: Shared datasets that should NOT be per-user prefixed
const SHARED_DATASETS = new Set([
  'gst_rules',
  'ato_rulings',
  'award_rates',
  'stp_compliance',
  'tax_tables',
  'deduction_patterns',    // Reference data, not user-specific
]);

// REVISION: Datasets that use row-level user filtering instead of prefix isolation
const ROW_FILTERED_DATASETS = new Set([
  'merchant_data',         // Shared merchant intelligence, filtered by user_id metadata
  'matching_patterns',     // Shared matching patterns
]);

/**
 * Create a CogneeTools instance scoped to a specific user (Wave 3)
 * REVISION: Uses dataset pooling strategy (D03 B3):
 * - Shared reference datasets: no prefix, global access
 * - Private datasets: user_{userId} prefix
 * - Row-filtered datasets: no prefix, user_id metadata filtering
 */
static forUser(userId: string, client?: CogneeClient): CogneeTools {
  return new CogneeTools({
    datasetPrefix: `user_${userId}`,
    userId,
  });
}
```

#### Step 3b: Modify `prefixDataset()` to respect pooling strategy
```typescript
/**
 * REVISION: prefixDataset() must skip prefixing for shared and row-filtered datasets
 */
private prefixDataset(dataset: string): string {
  // Shared reference datasets — never prefix
  if (SHARED_DATASETS.has(dataset)) {
    return dataset;
  }
  // Row-filtered datasets — no prefix, but add user_id to search metadata
  if (ROW_FILTERED_DATASETS.has(dataset)) {
    return dataset;
  }
  // Private datasets — apply user prefix
  if (this.config.datasetPrefix) {
    return `${this.config.datasetPrefix}_${dataset}`;
  }
  return dataset;
}
```

#### Step 3c: Add user_id metadata to row-filtered dataset operations
```typescript
/**
 * REVISION: When adding data to row-filtered datasets, include user_id in metadata
 * so searches can be filtered by user without per-user dataset copies.
 */
private async addWithUserMetadata(data: any, dataset: string): Promise<void> {
  const userId = this.config.userId;
  if (ROW_FILTERED_DATASETS.has(dataset) && userId) {
    // Wrap data with user_id metadata for row-level filtering
    const wrappedData = typeof data === 'string'
      ? `[user:${userId}] ${data}`
      : { ...data, _user_id: userId };
    await this.client.add(wrappedData, dataset, userId);
  } else {
    await this.client.add(data, this.prefixDataset(dataset), userId);
  }
}
```

#### Step 4: Ensure prefixDataset() is applied consistently
Verify that ALL dataset name references go through `prefixDataset()`:
- Index methods (indexTaxData, indexInventoryItem, indexAsset, indexEntity, etc.)
- Search methods (searchTaxContext, searchInventoryContext, searchAssetContext, etc.)
- Any direct dataset name usage

### 2. `server/src/services/rag.ts`
**Purpose**: Pass userId through RAG wrapper to CogneeTools
**CRITICAL**: Read the file first. It has a USE_COGNEE gate.

#### Step 1: Add userId parameter to RAG methods
```typescript
// Find the main search/index methods and add userId parameter:

// BEFORE (example):
async searchContext(query: string, dataset?: string): Promise<string[]> {

// AFTER:
async searchContext(query: string, dataset?: string, userId?: string): Promise<string[]> {
```

#### Step 2: Pass userId to CogneeTools instantiation
When RAG creates or uses CogneeTools, pass userId:

```typescript
// BEFORE:
const tools = new CogneeTools({ /* ... */ });

// AFTER:
const tools = userId
  ? CogneeTools.forUser(userId)
  : new CogneeTools({ /* existing config */ });
```

#### Step 3: Preserve backward compatibility
- All RAG methods with new `userId?` parameter must work without it (admin fallback)
- The `USE_COGNEE` gate must still function — if disabled, userId is irrelevant

## Gradual Cognee Auth Migration Strategy

> **REVISION NOTE (D01 DC-09):** Enabling `ENABLE_BACKEND_ACCESS_CONTROL=true` in Cognee will break existing callers that don't pass userId. The migration MUST be gradual:
>
> **Phase 1 (Wave 3 — this wave):** Add optional `userId` parameter to ALL CogneeClient methods. Keep `REQUIRE_AUTHENTICATION=false` in Docker. All existing code continues to work via admin token fallback. New code CAN pass userId.
>
> **Phase 2 (Post-Wave 3 verification):** Enable `REQUIRE_AUTHENTICATION=true` in Docker. Add a backward-compat wrapper: if a method is called WITHOUT userId, log a deprecation warning and use admin token. Test all Wave 16/17 services still work.
>
> **Phase 3 (Wave 4+):** Require userId on all new code. Gradually update Waves 11-17 services to pass userId. Eventually remove admin-token fallback.
>
> **Backward-compat wrapper** (add to CogneeClient):
> ```typescript
> private async getAuthTokenWithDeprecationWarning(userId?: string): Promise<string> {
>   if (!userId) {
>     console.warn('[DEPRECATION] CogneeClient method called without userId. This will be required in a future wave. Using admin token as fallback.');
>   }
>   return this.getAuthToken(userId);
> }
> ```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `CogneeTools.forUser('abc123')` creates tools with prefix `user_abc123`
- [ ] All CogneeClient calls in cognee-tools.ts pass userId
- [ ] `prefixDataset('bank_transactions')` with prefix 'user_abc' → 'user_abc_bank_transactions'
- [ ] `prefixDataset('gst_rules')` → 'gst_rules' (SHARED — no prefix, REVISION D03)
- [ ] `prefixDataset('merchant_data')` → 'merchant_data' (ROW_FILTERED — no prefix, REVISION D03)
- [ ] RAG methods accept optional userId and pass through
- [ ] Calls without userId still work (backward compat) and log deprecation warning
- [ ] Create marker file: `.agent-done-W03-05`

## Dependencies
- **Agent 2** must complete CogneeClient multi-user changes first (adds userId parameter to methods)
