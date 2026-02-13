# Agent 10: Testing & Validation Agent

## Role
Verify the entire Wave 18 CDR Open Banking pipeline works end-to-end: crawl real CDR data from CBA's public API, parse rates correctly, store in database, index to Cognee, search via agent, and render in UI.

## Priority: WAVE 18 (After All Other Agents)

## Wait Condition
Check for ALL marker files: `.agent-done-W18-01` through `.agent-done-W18-09` before starting.

## Files to CREATE

### 1. `server/src/tests/wave18-cdr-integration.test.ts`
**Purpose**: Integration tests for CDR crawl pipeline

- [ ] **Test 1: CDR Register Discovery**
  - Call `cdrCrawler.discoverDataHolders()`
  - Assert: returns array with at least 10 active data holders
  - Assert: CBA (Commonwealth Bank) is in the list
  - Assert: each data holder has `dataHolderBrandId`, `brandName`, `publicBaseUri`
  - Assert: records upserted into `cdr_data_holders` table

- [ ] **Test 2: CBA Product Catalog Crawl**
  - Find CBA in data holders list
  - Call `cdrCrawler.crawlCatalog(cbaDataHolder)`
  - Assert: returns at least 20 products
  - Assert: product categories include `RESIDENTIAL_MORTGAGES`, `TRANS_AND_SAVINGS_ACCOUNTS`
  - Assert: each product has `productId`, `name`, `productCategory`
  - Assert: records upserted into `cdr_products` table

- [ ] **Test 3: Product Detail Crawl**
  - Pick first home loan product from CBA catalog
  - Call `cdrCrawler.crawlProductDetail(cbaDataHolder, productId)`
  - Assert: `cdr_lending_rates` populated for this product
  - Assert: rates have `rate` > 0 and < 20 (sanity check)
  - Assert: `cdr_fees` populated (at least annual fee entry)
  - Assert: `cdr_features` populated
  - Assert: `raw_json` stored in `cdr_products` table

- [ ] **Test 4: Rate Parsing Accuracy**
  - Query all CBA home loan lending rates from database
  - Assert: variable rates exist with `lending_rate_type` = 'VARIABLE'
  - Assert: fixed rates exist with `lending_rate_type` containing 'FIXED'
  - Assert: comparison rates populated where available
  - Assert: no rate is negative or > 25%
  - Assert: `loan_purpose` field populated (OWNER_OCCUPIED or INVESTMENT)

- [ ] **Test 5: Product Search**
  - Call `cdrProductService.searchProducts({ productCategory: 'RESIDENTIAL_MORTGAGES', rateType: 'VARIABLE' })`
  - Assert: returns results with `total` > 0
  - Assert: all results have `productCategory` = 'RESIDENTIAL_MORTGAGES'
  - Assert: results include rate information

- [ ] **Test 6: Product Comparison**
  - Pick 3 home loan products from different data holders
  - Call `cdrProductService.compareProducts([id1, id2, id3])`
  - Assert: comparison matrix has rate, fee, and feature rows
  - Assert: `totalAnnualFees` calculated for each product
  - Assert: recommendation string is not empty

- [ ] **Test 7: Best Rates**
  - Call `cdrProductService.getBestRates('RESIDENTIAL_MORTGAGES', 'lending', 10)`
  - Assert: returns 10 results
  - Assert: results sorted by rate ascending
  - Assert: first result has lowest variable rate in database

- [ ] **Test 8: Savings Calculator**
  - Call with current rate 6.5%, balance $500,000, 25 years remaining
  - Assert: returns alternatives with lower rates
  - Assert: `monthlySaving` > 0 for each alternative
  - Assert: `breakEvenMonths` is positive integer
  - Assert: `lifetimeSaving` > `annualSaving`

- [ ] **Test 9: Crawl Log**
  - After running crawl tests, query `cdr_crawl_log` table
  - Assert: at least one entry with status 'completed'
  - Assert: `products_discovered` > 0
  - Assert: `duration_ms` > 0

- [ ] **Test 10: Rate Limiter**
  - Make 5 rapid requests to same data holder
  - Assert: total time >= 2000ms (5 requests at 2/second)
  - Assert: no 429 errors received

### 2. `server/src/tests/wave18-cognee-cdr.test.ts`
**Purpose**: Verify CDR data indexed to Cognee correctly

- [ ] **Test 11: Product Indexing**
  - Call `cdrCogneeIndexer.indexProducts(sampleProducts)`
  - Assert: no errors returned
  - Search Cognee for "CBA home loan" in `cdr_products` dataset
  - Assert: returns relevant product results

- [ ] **Test 12: Rate Indexing**
  - Call `cdrCogneeIndexer.indexRates(sampleProducts, sampleRates)`
  - Search Cognee for "lowest variable rate" in `cdr_rates` dataset
  - Assert: returns rate-related results

- [ ] **Test 13: Knowledge Base**
  - Call `cdrCogneeIndexer.indexBankingKnowledge()`
  - Search Cognee for "APRA serviceability buffer" in `banking_product_knowledge` dataset
  - Assert: returns knowledge about 3% buffer requirement

### 3. `server/src/tests/wave18-api-endpoints.test.ts`
**Purpose**: Verify all 20 API endpoints respond correctly

- [ ] Test each endpoint with valid parameters:
  - GET /api/cdr/data-holders -- 200, array response
  - GET /api/cdr/products?category=RESIDENTIAL_MORTGAGES -- 200, paginated response
  - GET /api/cdr/products/categories -- 200, array of categories
  - GET /api/cdr/rates/best?category=RESIDENTIAL_MORTGAGES&type=lending -- 200, sorted rates
  - POST /api/cdr/products/compare -- 200, comparison matrix
  - POST /api/cdr/savings/calculate -- 200, savings result
  - GET /api/cdr/rates/market -- 200, market rates object
  - POST /api/cdr/loans/refinance -- 200, refinance result
  - POST /api/cdr/loans/borrowing-capacity -- 200, capacity result
  - POST /api/cdr/alerts -- 201, created alert
  - GET /api/cdr/alerts -- 200, alerts array
  - DELETE /api/cdr/alerts/:id -- 200, success

- [ ] Test error cases:
  - GET /api/cdr/products?category=INVALID -- 200, empty results (not 500)
  - POST /api/cdr/products/compare with empty array -- 400
  - POST /api/cdr/products/compare with > 5 products -- 400

### 4. `server/src/tests/wave18-validation-report.md`
**Purpose**: Manual validation checklist and results

- [ ] Document: CDR Register API connectivity (api.cdr.gov.au reachable)
- [ ] Document: Number of data holders discovered
- [ ] Document: Number of products cataloged per major bank (CBA, ANZ, NAB, Westpac)
- [ ] Document: Rate accuracy spot-check (compare 3 CDR rates against bank website)
- [ ] Document: Crawl performance (time for full crawl, products/second)
- [ ] Document: Cognee search quality (relevant results for 5 test queries)
- [ ] Document: UI rendering verification (all 8 components render without errors)

## Files to MODIFY

None.

## Verification
- [ ] All integration tests pass against live CDR API
- [ ] CBA products crawled with accurate rates
- [ ] Rate limiter enforces 2 req/s per data holder
- [ ] Cognee search returns relevant CDR product results
- [ ] All 20 API endpoints return correct responses
- [ ] Validation report documents spot-check accuracy
- [ ] Create marker file: `.agent-done-W18-10`

## Dependencies
- **Requires**: ALL Wave 18 agents (`.agent-done-W18-01` through `.agent-done-W18-09`)
- **External**: CDR Register API at api.cdr.gov.au must be reachable
- **External**: CBA public product API must be reachable
