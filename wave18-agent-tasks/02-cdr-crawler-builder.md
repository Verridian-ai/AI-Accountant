# Agent 2: CDR Crawler Builder

## Role
Build a 3-stage CDR Open Banking crawler that discovers data holders from the CDR Register API, catalogs their product listings, and fetches full product details including rates, fees, and features.

## Priority: WAVE 18 (After Agent 1)

## Wait Condition
Check for `.agent-done-W18-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/cdr-crawler.ts`
**Purpose**: 3-stage pipeline for crawling CDR public product APIs
**Pattern**: Service class with async methods, similar to `server/src/services/cognee_client.ts` HTTP patterns

- [ ] Create `CdrCrawler` class with constructor accepting optional config:
  ```typescript
  interface CdrCrawlerConfig {
    registerBaseUrl: string;        // default: 'https://api.cdr.gov.au'
    rateLimit: number;              // default: 2 (requests per second per data holder)
    maxConcurrentHolders: number;   // default: 3
    retryAttempts: number;          // default: 3
    retryDelayMs: number;           // default: 1000
    requestTimeoutMs: number;       // default: 15000
    userAgent: string;              // default: 'GoldLedger-CDR-Crawler/1.0'
  }
  ```

- [ ] Implement rate limiter utility:
  ```typescript
  private rateLimiters: Map<string, { lastRequest: number; queue: Promise<void> }>;
  private async rateLimitedFetch(dataHolderId: string, url: string, options?: RequestInit): Promise<Response>;
  ```
  - Track per-data-holder timestamps
  - Enforce 2 req/s maximum per data holder (500ms minimum gap)
  - Add `x-v` header (CDR versioning: `x-v: 4` for products)
  - Add `Accept: application/json` header
  - Retry with exponential backoff on 429/5xx

- [ ] **Stage 1 -- Discovery**: `async discoverDataHolders(): Promise<CdrDataHolder[]>`
  - GET `{registerBaseUrl}/cdr-register/v1/banking/data-holders/brands`
  - Parse response: `{ data: [{ dataHolderBrandId, brandName, abn, logoUri, status, endpointDetail: { publicBaseUri } }] }`
  - Filter status === 'ACTIVE'
  - Upsert into `cdr_data_holders` table
  - Log discovery count to `cdr_crawl_log`
  - Return list of active data holders

- [ ] **Stage 2 -- Catalog**: `async crawlCatalog(dataHolder: CdrDataHolder): Promise<CdrProduct[]>`
  - GET `{dataHolder.publicBaseUri}/cds-au/v1/banking/products` with pagination (`page`, `page-size: 25`)
  - Parse response: `{ data: { products: [...] }, links: { next }, meta: { totalRecords, totalPages } }`
  - Follow pagination until all products retrieved
  - Upsert into `cdr_products` table (match on data_holder_id + product_id)
  - Update `cdr_data_holders.product_count` and `last_crawled_at`
  - Return product list

- [ ] **Stage 3 -- Detail**: `async crawlProductDetail(dataHolder: CdrDataHolder, productId: string): Promise<void>`
  - GET `{dataHolder.publicBaseUri}/cds-au/v1/banking/products/{productId}`
  - Parse full product response including nested `lendingRates[]`, `depositRates[]`, `fees[]`, `features[]`, `eligibility[]`
  - Store `raw_json` in `cdr_products` table
  - Upsert child records into `cdr_lending_rates`, `cdr_deposit_rates`, `cdr_fees`, `cdr_features`, `cdr_eligibility`
  - Delete stale child records not in latest response

- [ ] **Full Crawl Orchestrator**: `async fullCrawl(): Promise<CrawlResult>`
  ```typescript
  interface CrawlResult {
    dataHoldersDiscovered: number;
    dataHoldersCrawled: number;
    productsDiscovered: number;
    productsDetailed: number;
    errors: Array<{ dataHolder: string; stage: string; error: string }>;
    durationMs: number;
  }
  ```
  - Run Stage 1 (discovery)
  - For each active data holder (up to `maxConcurrentHolders` in parallel):
    - Run Stage 2 (catalog)
    - For each product: Run Stage 3 (detail)
  - Log full crawl to `cdr_crawl_log` with status, counts, errors
  - Return summary

- [ ] **Incremental Crawl**: `async incrementalCrawl(dataHolderIds?: string[]): Promise<CrawlResult>`
  - Same as fullCrawl but skip discovery if `dataHolderIds` provided
  - Only re-crawl products updated since last crawl (check `last_updated` field)

- [ ] **Single Data Holder Crawl**: `async crawlDataHolder(dataHolderId: string): Promise<CrawlResult>`
  - Crawl catalog + details for one specific data holder

- [ ] Error handling:
  - Catch and log per-data-holder errors without stopping full crawl
  - Track error counts in crawl log
  - Emit SSE events: `cdr:crawl:progress`, `cdr:crawl:complete`, `cdr:crawl:error`

### 2. `server/src/services/cdr-crawler.test.ts`
**Purpose**: Unit tests with mocked HTTP responses

- [ ] Test discovery parsing from sample CDR Register response
- [ ] Test catalog pagination (mock 3 pages of 25 products)
- [ ] Test detail parsing with lending rates, deposit rates, fees
- [ ] Test rate limiter enforces 2 req/s per data holder
- [ ] Test error recovery on 429 responses
- [ ] Test full crawl orchestration with 2 mock data holders

## Files to MODIFY

None.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] CdrCrawler can be instantiated with default config
- [ ] `discoverDataHolders()` returns parsed data holder list against live CDR Register API (https://api.cdr.gov.au)
- [ ] Rate limiter correctly enforces 500ms minimum gap between requests to same data holder
- [ ] Crawl log records are created in `cdr_crawl_log` table
- [ ] Create marker file: `.agent-done-W18-02`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W18-01`) for CDR schema/tables
- **Reuses**: server/src/schema.ts (cdr tables), Drizzle ORM patterns from existing services
