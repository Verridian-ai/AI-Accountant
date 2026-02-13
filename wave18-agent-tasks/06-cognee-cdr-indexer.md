# Agent 6: Cognee CDR Indexer

## Role
Index crawled CDR product data into Cognee knowledge graph datasets for semantic search, enabling the CDR agent and chat to reason about banking products, rate trends, and product features.

## Priority: WAVE 18 (After Agents 1, 2)

## Wait Condition
Check for `.agent-done-W18-01`, `.agent-done-W18-02` marker files before starting.

## Files to CREATE

### 1. `server/src/services/cdr-cognee-indexer.ts`
**Purpose**: Transform CDR data into Cognee-indexable documents and manage 3 datasets
**Pattern**: Follow `server/src/services/claude/cognee-tools.ts` for Cognee API interaction

- [ ] Create `CdrCogneeIndexer` class:
  ```typescript
  import { CogneeClient } from './cognee_client.js';

  class CdrCogneeIndexer {
    private cogneeClient: CogneeClient;
    private datasets = {
      products: 'cdr_products',
      rates: 'cdr_rates',
      knowledge: 'banking_product_knowledge'
    };

    constructor(cogneeClient?: CogneeClient) {
      this.cogneeClient = cogneeClient ?? new CogneeClient();
    }
  }
  ```

- [ ] **Dataset 1: `cdr_products`** -- Product profiles
  `async indexProducts(products: CdrProduct[]): Promise<IndexResult>`
  - Transform each product into a structured document:
    ```
    Product: {name}
    Provider: {dataHolderName}
    Category: {productCategory}
    Description: {description}

    Features:
    - {feature1}: {additionalValue}
    - {feature2}: {additionalValue}

    Eligibility:
    - {eligibility1}: {additionalValue}

    Application: {applicationUri}
    Last Updated: {lastUpdated}
    ```
  - Batch upload via `cogneeClient.add()` (FormData with text file per product)
  - Run `cogneeClient.cognify()` with custom prompt:
    ```
    Extract entities: bank name, product name, product category, key features (offset, redraw, extra repayments), eligibility criteria, target market. Create relationships between banks and their products, products and their features.
    ```

- [ ] **Dataset 2: `cdr_rates`** -- Rate data for comparison
  `async indexRates(products: CdrProduct[], rates: { lending: CdrLendingRate[]; deposit: CdrDepositRate[] }): Promise<IndexResult>`
  - Transform rates into structured documents:
    ```
    Rate Entry: {productName} by {dataHolderName}
    Category: {productCategory}
    Rate Type: {lendingRateType}
    Rate: {rate}%
    Comparison Rate: {comparisonRate}%
    Loan Purpose: {loanPurpose}
    Repayment Type: {repaymentType}
    Conditions: {additionalInfo}
    Tiers: {formatted tier info}
    ```
  - Group rates by product for context
  - Cognify with custom prompt:
    ```
    Extract entities: rate values, rate types (fixed/variable), loan purposes, repayment types, tier thresholds. Create relationships between products and their rates, compare rates across providers for the same product category.
    ```

- [ ] **Dataset 3: `banking_product_knowledge`** -- General banking knowledge
  `async indexBankingKnowledge(): Promise<IndexResult>`
  - Index static knowledge documents covering:
    - Australian lending rate types (variable, fixed 1-5yr, introductory, honeymoon)
    - APRA serviceability buffer rules (3% above product rate)
    - LVR tiers and LMI thresholds (80%, 85%, 90%, 95%)
    - Comparison rate ASIC requirements
    - Offset account mechanics and tax implications
    - Redraw facility vs offset pros/cons
    - Fixed rate break cost calculation methodology
    - CDR product categories and their characteristics
    - RBA cash rate impact on variable rates
    - Refinancing cost/benefit analysis framework
  - Create 10 knowledge documents, each 200-500 words
  - Cognify with domain-specific prompt for banking entity extraction

- [ ] **Full Index**: `async fullIndex(): Promise<FullIndexResult>`
  ```typescript
  interface FullIndexResult {
    productsIndexed: number;
    ratesIndexed: number;
    knowledgeDocsIndexed: number;
    errors: string[];
    durationMs: number;
  }
  ```
  - Fetch all products + rates from database
  - Run all 3 dataset indexing operations
  - Report results

- [ ] **Incremental Index**: `async incrementalIndex(since: string): Promise<FullIndexResult>`
  - Only index products/rates updated since given timestamp
  - Useful for post-crawl indexing

- [ ] **Search Helper**: `async searchProducts(query: string, searchType?: string): Promise<any>`
  - Convenience wrapper around `cogneeClient.search()` targeting CDR datasets
  - Default search type: `CHUNKS` for product similarity, `GRAPH_COMPLETION` for reasoning
  - Multi-dataset search across all 3 CDR datasets

## Files to MODIFY

### 2. `server/src/services/claude/cognee-tools.ts`
- [ ] Add CDR-specific search tool definitions:
  ```typescript
  {
    name: 'search_cdr_products',
    description: 'Search CDR banking product knowledge base',
    datasets: ['cdr_products', 'cdr_rates', 'banking_product_knowledge']
  }
  ```
- [ ] Add handler that routes to CdrCogneeIndexer.searchProducts()

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `indexProducts()` successfully uploads product documents to Cognee `cdr_products` dataset
- [ ] `indexRates()` creates rate comparison documents in `cdr_rates` dataset
- [ ] `indexBankingKnowledge()` creates 10 knowledge documents in `banking_product_knowledge` dataset
- [ ] `cogneeClient.cognify()` runs without error on all 3 datasets
- [ ] `searchProducts('best variable home loan rate')` returns relevant results
- [ ] Create marker file: `.agent-done-W18-06`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W18-01`), Agent 2 (`.agent-done-W18-02`) for crawled data
- **Reuses**: `server/src/services/cognee_client.ts` (CogneeClient class), cognee-tools.ts patterns
