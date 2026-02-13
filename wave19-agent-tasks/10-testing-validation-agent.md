# Agent 10: Testing & Validation Agent

## Role
Verify the entire Wave 19 Market Intelligence pipeline works end-to-end: RBA CSV parsing, ABS SDMX responses, market price fetching, sentiment analysis, Cognee indexing, scheduler operation, and UI rendering.

## Priority: WAVE 19 (After All Other Agents)

## Wait Condition
Check for ALL marker files: `.agent-done-W19-01` through `.agent-done-W19-09` before starting.

## Files to CREATE

### 1. `server/src/tests/wave19-rba-integration.test.ts`
**Purpose**: Validate RBA CSV feed parsing

- [ ] **Test 1: RBA CSV Download**
  - Call `rbaDataFeed.fetchTable('A2')`
  - Assert: returns non-empty CSV string
  - Assert: CSV contains "Cash Rate Target" column header
  - Assert: CSV has at least 100 data rows

- [ ] **Test 2: RBA CSV Parsing -- Interest Rates (A2)**
  - Call `rbaDataFeed.parseTable('A2', csvData)`
  - Assert: returns indicators with `indicator_code` = 'RBA_CASH_RATE'
  - Assert: cash rate value is between 0 and 15 (sanity check)
  - Assert: `observation_date` is in DD-MMM-YYYY format, parsed correctly
  - Assert: `change_pct` calculated from previous observation

- [ ] **Test 3: RBA CSV Parsing -- Lending Rates (F5)**
  - Fetch and parse F5 table
  - Assert: contains `RBA_HOME_LOAN_VARIABLE` indicator
  - Assert: home loan variable rate > cash rate (always true)
  - Assert: `RBA_TERM_DEPOSIT_1YR` < `RBA_HOME_LOAN_VARIABLE` (deposits always less)

- [ ] **Test 4: RBA CSV Parsing -- Inflation (G1)**
  - Fetch and parse G1 table
  - Assert: contains `RBA_CPI_ANNUAL` indicator
  - Assert: CPI annual value is between -5 and 20 (sanity check)
  - Assert: `RBA_TRIMMED_MEAN` indicator present

- [ ] **Test 5: RBA Multi-Line Header Handling**
  - Verify parser correctly skips RBA's 10-line metadata header
  - Assert: first data row date is a valid date, not header text
  - Assert: no NaN or null values in parsed indicators

- [ ] **Test 6: RBA Cash Rate Convenience**
  - Call `rbaDataFeed.getCashRate()`
  - Assert: returns object with `rate`, `effectiveDate`, `previousRate`
  - Assert: rate matches latest from A2 table

### 2. `server/src/tests/wave19-abs-integration.test.ts`
**Purpose**: Validate ABS SDMX API responses

- [ ] **Test 7: ABS CPI Fetch**
  - Call `absDataFeed.fetchDataflow('CPI', 'Q.10001.10.50.10.AQ')`
  - Assert: returns valid SDMX JSON with `dataSets` array
  - Assert: `structure.dimensions` present
  - Assert: observations contain numeric values

- [ ] **Test 8: ABS CPI Parsing**
  - Parse CPI dataflow response
  - Assert: returns indicator with code `ABS_CPI_ALL_GROUPS`
  - Assert: CPI index value > 100 (it was 100 in base period)
  - Assert: `reference_period` is in YYYY-QN format

- [ ] **Test 9: ABS Labour Force**
  - Fetch and parse Labour Force dataflow
  - Assert: unemployment rate is between 1 and 30 (sanity check)
  - Assert: participation rate is between 50 and 80 (typical AU range)
  - Assert: employed persons value is in thousands (> 10,000)

- [ ] **Test 10: ABS GDP**
  - Fetch and parse GDP dataflow
  - Assert: quarterly GDP change is between -15 and 15 (sanity check)
  - Assert: annual GDP change present

- [ ] **Test 11: ABS Error Handling**
  - Test with invalid dataflow ID
  - Assert: returns empty result, not crash
  - Assert: error logged but not thrown

### 3. `server/src/tests/wave19-prices-integration.test.ts`
**Purpose**: Validate market price feeds

- [ ] **Test 12: Alpha Vantage ASX Quote** (requires API key)
  - Call `marketPriceService.fetchASXQuote('CBA')`
  - Assert: returns MarketPrice with `symbol` = 'CBA.AX'
  - Assert: price > 0 and < 500 (CBA share price sanity)
  - Assert: `asset_type` = 'equity'
  - Assert: `currency` = 'AUD'

- [ ] **Test 13: CoinGecko Crypto Prices**
  - Call `marketPriceService.fetchCryptoPrices(['bitcoin', 'ethereum'])`
  - Assert: returns 2 MarketPrice records
  - Assert: Bitcoin AUD price > 0
  - Assert: `asset_type` = 'cryptocurrency'
  - Assert: `currency` = 'AUD'

- [ ] **Test 14: Rate Limiter -- Alpha Vantage**
  - Track API calls count
  - Verify counter increments after each call
  - Verify `checkAlphaVantageLimit()` returns false at limit

- [ ] **Test 15: Rate Limiter -- CoinGecko**
  - Make 3 rapid requests
  - Verify total time >= 4 seconds (2-second gap between requests)

- [ ] **Test 16: Price Upsert**
  - Refresh prices
  - Query `market_prices` table
  - Assert: records exist for default watchlist symbols
  - Assert: `observation_date` is today's date

### 4. `server/src/tests/wave19-sentiment-integration.test.ts`
**Purpose**: Validate sentiment analysis

- [ ] **Test 17: Topic Research**
  - Call `sentimentService.researchTopic('Australian property market')`
  - Assert: returns articles array with at least 1 entry
  - Assert: each article has title, url, source
  - Assert: summary is non-empty string

- [ ] **Test 18: Sentiment Scoring**
  - Provide sample articles to `analyzeSentiment()`
  - Assert: sentiment score between -1.0 and 1.0
  - Assert: sentiment label matches score range
  - Assert: confidence between 0 and 1
  - Assert: positive + negative + neutral counts sum to total

- [ ] **Test 19: Sentiment Snapshot Persistence**
  - Call `getSentimentSnapshot('RBA interest rates')`
  - Query `sentiment_snapshots` table
  - Assert: record stored with matching topic and date
  - Call again within TTL -- assert cached result returned (no new API call)

### 5. `server/src/tests/wave19-scheduler-integration.test.ts`
**Purpose**: Validate scheduler operation

- [ ] **Test 20: Scheduler Start**
  - Create scheduler instance
  - Call `start()`
  - Assert: `getStatus().isRunning` = true
  - Assert: 7 jobs registered

- [ ] **Test 21: Job Next Run Calculation**
  - Verify each job has a valid `nextRun` timestamp
  - Assert: RBA refresh next run is tomorrow 6am AEST
  - Assert: crypto refresh next run is within 30 minutes

- [ ] **Test 22: Manual Job Trigger**
  - Call `triggerJob('crypto_prices')`
  - Assert: job executes immediately
  - Assert: `lastStatus` = 'success' after completion

- [ ] **Test 23: ASX Trading Hours Check**
  - Test with various times:
    - Monday 11am AEST: should return true
    - Monday 5pm AEST: should return false
    - Saturday 12pm AEST: should return false
    - Wednesday 9am AEST: should return false

- [ ] **Test 24: Scheduler Disabled**
  - Create scheduler with `enabled: false`
  - Call `start()`
  - Assert: no jobs scheduled
  - Assert: `getStatus().isRunning` = false

### 6. `server/src/tests/wave19-api-endpoints.test.ts`
**Purpose**: Verify all 22 API endpoints

- [ ] Test each endpoint with valid parameters:
  - GET /api/market/indicators/snapshot -- 200, snapshot object
  - GET /api/market/indicators?category=interest_rates -- 200, filtered indicators
  - GET /api/market/indicators/RBA_CASH_RATE/history -- 200, history array
  - GET /api/market/indicators/cash-rate -- 200, cash rate object
  - GET /api/market/indicators/cpi -- 200, CPI object
  - GET /api/market/prices -- 200, prices object with asx and crypto
  - GET /api/market/prices/CBA -- 200, single price
  - GET /api/market/prices/CBA/history -- 200, price history array
  - GET /api/market/prices/search/bank -- 200, search results
  - POST /api/market/prices/refresh -- 200, refresh result
  - GET /api/market/sentiment/property -- 200, sentiment snapshot
  - POST /api/market/sentiment/batch -- 200, array of snapshots
  - POST /api/market/sentiment/impact -- 200, impact analysis
  - GET /api/market/calendar -- 200, events array
  - GET /api/market/scheduler/status -- 200, scheduler status
  - POST /api/market/alerts -- 201, created alert
  - GET /api/market/alerts -- 200, alerts array

- [ ] Test error cases:
  - GET /api/market/indicators/INVALID_CODE/history -- 200, empty array
  - GET /api/market/prices/INVALID -- 200, null or empty

### 7. `server/src/tests/wave19-validation-report.md`
**Purpose**: Manual validation checklist and results

- [ ] Document: RBA CSV connectivity (rba.gov.au/statistics/tables reachable)
- [ ] Document: ABS SDMX API connectivity (data.api.abs.gov.au reachable)
- [ ] Document: Alpha Vantage API key configured and working
- [ ] Document: CoinGecko API responding
- [ ] Document: RBA cash rate accuracy (compare against RBA website)
- [ ] Document: ABS unemployment rate accuracy (compare against ABS website)
- [ ] Document: ASX CBA price accuracy (compare against ASX website)
- [ ] Document: Sentiment analysis quality (spot-check 3 topics)
- [ ] Document: Scheduler job execution times
- [ ] Document: Cognee search quality for market queries
- [ ] Document: UI rendering verification (all 8 market components render)

## Files to MODIFY

None.

## Verification
- [ ] All RBA CSV parsing tests pass against live data
- [ ] All ABS SDMX response tests pass against live API
- [ ] Price feeds return valid data for ASX and crypto
- [ ] Sentiment analysis produces valid scores and summaries
- [ ] Scheduler starts, stops, and triggers jobs correctly
- [ ] All 22 API endpoints return correct responses
- [ ] Validation report documents accuracy spot-checks
- [ ] Create marker file: `.agent-done-W19-10`

## Dependencies
- **Requires**: ALL Wave 19 agents (`.agent-done-W19-01` through `.agent-done-W19-09`)
- **External**: RBA statistical tables at rba.gov.au (public, no auth)
- **External**: ABS SDMX API at data.api.abs.gov.au (public, no auth)
- **External**: Alpha Vantage API (requires `ALPHA_VANTAGE_API_KEY` env var)
- **External**: CoinGecko API (public, no auth)
