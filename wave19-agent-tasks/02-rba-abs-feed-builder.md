# Agent 2: RBA & ABS Feed Builder

## Role
Build data feed services for the Reserve Bank of Australia (RBA) statistical tables and Australian Bureau of Statistics (ABS) SDMX 2.1 API, providing real-time economic indicators for the platform.

## Priority: WAVE 19 (After Agent 1)

## Wait Condition
Check for `.agent-done-W19-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/rba-data-feed.ts`
**Purpose**: Download and parse RBA statistical CSV tables
**Pattern**: Service class with HTTP fetching, similar to `server/src/services/cognee_client.ts`

- [ ] Create `RbaDataFeed` class:
  ```typescript
  interface RbaConfig {
    baseUrl: string;                  // default: 'https://www.rba.gov.au/statistics/tables'
    cacheDir: string;                 // default: '/tmp/rba-cache'
    cacheTtlMs: number;              // default: 86400000 (24 hours)
  }
  ```

- [ ] **Table Definitions** (5 key RBA tables):
  ```typescript
  const RBA_TABLES = {
    A2: {
      url: '/csv/a2-reserve-bank-interest-rates.csv',
      name: 'Reserve Bank Interest Rates',
      indicators: [
        { column: 'Cash Rate Target', code: 'RBA_CASH_RATE', category: 'interest_rates', unit: 'percent' },
        { column: 'Interbank Overnight Cash Rate', code: 'RBA_OVERNIGHT_RATE', category: 'interest_rates', unit: 'percent' }
      ]
    },
    F5: {
      url: '/csv/f5-indicator-lending-rates.csv',
      name: 'Indicator Lending Rates',
      indicators: [
        { column: 'Housing loans; Variable; Standard', code: 'RBA_HOME_LOAN_VARIABLE', category: 'interest_rates', unit: 'percent' },
        { column: 'Housing loans; Variable; Discounted', code: 'RBA_HOME_LOAN_DISCOUNTED', category: 'interest_rates', unit: 'percent' },
        { column: 'Personal loans; Variable', code: 'RBA_PERSONAL_LOAN', category: 'interest_rates', unit: 'percent' },
        { column: 'Term deposits; 1 year', code: 'RBA_TERM_DEPOSIT_1YR', category: 'interest_rates', unit: 'percent' }
      ]
    },
    F11: {
      url: '/csv/f11-housing-lending-rates.csv',
      name: 'Housing Lending Rates',
      indicators: [
        { column: 'Owner-occupier; Variable rate', code: 'RBA_OO_VARIABLE', category: 'interest_rates', unit: 'percent' },
        { column: 'Investor; Variable rate', code: 'RBA_INV_VARIABLE', category: 'interest_rates', unit: 'percent' },
        { column: 'Owner-occupier; Fixed rate; 3 year', code: 'RBA_OO_FIXED_3YR', category: 'interest_rates', unit: 'percent' }
      ]
    },
    G1: {
      url: '/csv/g1-consumer-price-inflation.csv',
      name: 'Consumer Price Inflation',
      indicators: [
        { column: 'All groups CPI; Percentage change; Quarterly', code: 'RBA_CPI_QUARTERLY', category: 'inflation', unit: 'percent' },
        { column: 'All groups CPI; Percentage change; Annual', code: 'RBA_CPI_ANNUAL', category: 'inflation', unit: 'percent' },
        { column: 'Trimmed mean; Percentage change; Annual', code: 'RBA_TRIMMED_MEAN', category: 'inflation', unit: 'percent' }
      ]
    },
    H1: {
      url: '/csv/h1-housing-price-indices.csv',
      name: 'Housing Price Indices',
      indicators: [
        { column: 'Sydney; Percentage change; Quarterly', code: 'RBA_HOUSE_PRICE_SYD_Q', category: 'housing', unit: 'percent' },
        { column: 'Australia; Percentage change; Quarterly', code: 'RBA_HOUSE_PRICE_AU_Q', category: 'housing', unit: 'percent' }
      ]
    }
  };
  ```

- [ ] `async fetchTable(tableKey: string): Promise<string>`
  - Download CSV from RBA URL
  - Cache to local filesystem with TTL check
  - Handle RBA's CSV format: multi-line headers, date column, data rows
  - Return raw CSV string

- [ ] `async parseTable(tableKey: string, csv: string): Promise<EconomicIndicator[]>`
  - Parse RBA CSV format (first column is date, subsequent columns are series)
  - RBA CSV quirks: header rows 1-10 are metadata, row 11 is column headers, data starts row 12
  - Date format: `DD-MMM-YYYY` (e.g., `02-Jan-2026`)
  - Extract most recent observation for each configured indicator
  - Calculate `change_pct` from previous observation
  - Return array of `EconomicIndicator` objects ready for DB insert

- [ ] `async fetchAllTables(): Promise<RbaFetchResult>`
  ```typescript
  interface RbaFetchResult {
    indicators: EconomicIndicator[];
    tablesProcessed: number;
    errors: Array<{ table: string; error: string }>;
  }
  ```
  - Fetch and parse all 5 tables
  - Upsert indicators into `economic_indicators` table
  - Update `market_data_feeds` entry for each table
  - Return summary

- [ ] `async getCashRate(): Promise<{ rate: number; effectiveDate: string; previousRate: number }>`
  - Convenience method returning current RBA cash rate from DB or fresh fetch

- [ ] `async getRateHistory(indicatorCode: string, months?: number): Promise<Array<{ date: string; value: number }>>`
  - Return historical values for an indicator (default last 24 months)

### 2. `server/src/services/abs-data-feed.ts`
**Purpose**: Query ABS SDMX 2.1 REST API for economic statistics
**Pattern**: Service class with HTTP fetching

- [ ] Create `AbsDataFeed` class:
  ```typescript
  interface AbsConfig {
    baseUrl: string;                  // default: 'https://data.api.abs.gov.au'
    cacheTtlMs: number;              // default: 86400000 (24 hours)
  }
  ```

- [ ] **ABS Dataflow Definitions** (5 key series):
  ```typescript
  const ABS_DATAFLOWS = {
    CPI: {
      dataflowId: 'CPI',
      key: 'Q.10001.10.50.10.AQ',
      name: 'Consumer Price Index',
      indicators: [
        { seriesId: '10001', code: 'ABS_CPI_ALL_GROUPS', category: 'inflation', name: 'CPI All Groups', unit: 'index' },
        { seriesId: '10001', code: 'ABS_CPI_ALL_GROUPS_PCT', category: 'inflation', name: 'CPI All Groups % Change', unit: 'percent' }
      ]
    },
    LABOUR_FORCE: {
      dataflowId: 'LF',
      key: 'M.1.20.10.M6',
      name: 'Labour Force',
      indicators: [
        { code: 'ABS_UNEMPLOYMENT_RATE', category: 'employment', name: 'Unemployment Rate', unit: 'percent' },
        { code: 'ABS_PARTICIPATION_RATE', category: 'employment', name: 'Participation Rate', unit: 'percent' },
        { code: 'ABS_EMPLOYED_PERSONS', category: 'employment', name: 'Employed Persons', unit: 'thousands' }
      ]
    },
    GDP: {
      dataflowId: 'ANA_AGG',
      key: 'Q.1.GDP.10.10.A10',
      name: 'National Accounts',
      indicators: [
        { code: 'ABS_GDP_QUARTERLY', category: 'gdp', name: 'GDP Quarterly Change', unit: 'percent' },
        { code: 'ABS_GDP_ANNUAL', category: 'gdp', name: 'GDP Annual Change', unit: 'percent' }
      ]
    },
    WAGES: {
      dataflowId: 'WPI',
      key: 'Q.3.10.THRPEB.7',
      name: 'Wage Price Index',
      indicators: [
        { code: 'ABS_WPI_ALL', category: 'wages', name: 'Wage Price Index All Sectors', unit: 'percent' },
        { code: 'ABS_WPI_PRIVATE', category: 'wages', name: 'Wage Price Index Private', unit: 'percent' }
      ]
    },
    DWELLING_APPROVALS: {
      dataflowId: 'BA',
      key: 'M.8.1.1001',
      name: 'Building Approvals',
      indicators: [
        { code: 'ABS_DWELLING_APPROVALS', category: 'housing', name: 'Dwelling Approvals Total', unit: 'count' }
      ]
    }
  };
  ```

- [ ] `async fetchDataflow(dataflowId: string, key: string, startPeriod?: string): Promise<any>`
  - GET `{baseUrl}/data/{dataflowId}/{key}?startPeriod={startPeriod}&format=jsondata`
  - Parse SDMX JSON response format:
    ```
    { dataSets: [{ series: { "0:0:0": { observations: { "0": [value], "1": [value] } } } }],
      structure: { dimensions: { observation: [{ values: [{ id: "2025-Q4" }] }] } } }
    ```
  - Handle ABS rate limiting (max 100 requests per minute)
  - Return parsed data with observation dates and values

- [ ] `async parseDataflow(dataflowId: string, rawData: any): Promise<EconomicIndicator[]>`
  - Map SDMX structure to `EconomicIndicator` records
  - Extract most recent observations
  - Calculate period-over-period change

- [ ] `async fetchAllIndicators(): Promise<AbsFetchResult>`
  ```typescript
  interface AbsFetchResult {
    indicators: EconomicIndicator[];
    dataflowsProcessed: number;
    errors: Array<{ dataflow: string; error: string }>;
  }
  ```
  - Fetch and parse all 5 dataflows
  - Upsert into `economic_indicators` table
  - Update `market_data_feeds` entries

- [ ] `async getLatestIndicator(code: string): Promise<EconomicIndicator | null>`
  - Convenience method returning most recent value for an indicator code

- [ ] `async getIndicatorHistory(code: string, periods?: number): Promise<EconomicIndicator[]>`
  - Return historical observations (default last 20 periods)

### 3. `server/src/services/economic-data-types.ts`
**Purpose**: Shared TypeScript types for economic data services

- [ ] Export interfaces:
  - `EconomicIndicatorRecord` (matches DB schema)
  - `IndicatorSummary` (aggregated view for dashboard)
  - `RateDecision` (RBA cash rate decision history)
  - `EconomicSnapshot` (combined view of key indicators)

## Files to MODIFY

### 4. `server/src/services/economic-data.ts`
**Current state**: May have basic economic data service
**Goal**: Wire RBA and ABS feeds as data sources

- [ ] Import and instantiate `RbaDataFeed` and `AbsDataFeed`
- [ ] Add method `async getEconomicSnapshot(): Promise<EconomicSnapshot>` that combines:
  - RBA cash rate + lending rates from RbaDataFeed
  - CPI + unemployment + GDP from AbsDataFeed
  - Returns unified view of key economic indicators
- [ ] Add method `async refreshAllFeeds(): Promise<void>` that triggers both RBA and ABS fetches

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] RBA CSV download works for all 5 tables (test against live RBA URLs)
- [ ] RBA CSV parsing correctly handles multi-line headers and date format
- [ ] ABS SDMX fetch returns valid JSON for CPI dataflow
- [ ] ABS SDMX parsing extracts correct observation values
- [ ] `getCashRate()` returns current RBA cash rate
- [ ] `getLatestIndicator('ABS_UNEMPLOYMENT_RATE')` returns unemployment rate
- [ ] Economic indicators correctly upserted into database
- [ ] Create marker file: `.agent-done-W19-02`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W19-01`) for market schema/tables
- **External**: RBA statistical tables at rba.gov.au (public, no auth)
- **External**: ABS SDMX API at data.api.abs.gov.au (public, no auth, 100 req/min)
