# R10: External Data Sources & Market Intelligence Research

**Agent**: R10 — External Data & Market Intelligence Researcher
**Date**: 2026-02-12
**Status**: Complete

---

## 1. Australian Economic Data Sources

### 1.1 What Already Exists

`server/src/services/economic-data.ts` already implements an `EconomicDataService` with:
- **RBA Cash Rate**: HTML-scrapes `rba.gov.au/statistics/cash-rate/` (regex: `(\d+\.\d+)\s*per\s*cent`)
- **RBA Lending Rates**: Downloads CSV from `rba.gov.au/statistics/tables/csv/f5-data.csv` (F5 — Indicator Lending Rates)
- **ABS CPI**: HTML-scrapes the ABS CPI release page
- **ABS Unemployment**: HTML-scrapes the ABS Labour Force release page
- **Caching**: Dual-layer — Drizzle DB (`economic_data_cache` table) + in-memory `Map<string, CacheEntry>` fallback
- **TTLs**: RBA = 24h, ABS = 7 days
- **Snapshot API**: `getEconomicSnapshot()` returns all 4 indicators via `Promise.allSettled`

**Limitations of current approach:**
- HTML scraping is fragile — any redesign breaks the regex patterns
- No structured API use (ABS has an official SDMX API)
- No exchange rate data
- No GDP or wage growth data
- No APRA data

### 1.2 RBA Data Sources (Recommended Upgrades)

| Table ID | Description | URL Pattern | Format | Update Freq |
|----------|-------------|-------------|--------|-------------|
| A2 | Cash Rate Target | `rba.gov.au/statistics/tables/csv/a2-data.csv` | CSV | After each RBA meeting (~8x/yr) |
| F5 | Indicator Lending Rates | `rba.gov.au/statistics/tables/csv/f5-data.csv` | CSV | Monthly |
| F11 | Exchange Rates (Daily) | `rba.gov.au/statistics/tables/csv/f11-data.csv` | CSV | Daily |
| F11.1 | Exchange Rates (Monthly) | `rba.gov.au/statistics/tables/csv/f11.1-data.csv` | CSV | Monthly |
| F1 | Interest Rates & Yields | `rba.gov.au/statistics/tables/csv/f1-data.csv` | CSV | Daily |
| D1 | Growth in Selected Financial Aggregates | `rba.gov.au/statistics/tables/csv/d1-data.csv` | CSV | Monthly |
| G1 | Consumer Price Inflation | `rba.gov.au/statistics/tables/csv/g1-data.csv` | CSV | Quarterly |
| H1 | GDP & Components | `rba.gov.au/statistics/tables/csv/h1-data.csv` | CSV | Quarterly |

**Key insight**: ALL RBA statistical tables are available as direct CSV downloads at `rba.gov.au/statistics/tables/csv/{table-id}-data.csv`. No API key required. No rate limits. The existing scraping approach should be **replaced entirely** with CSV parsing.

**Recommendation**: Replace the HTML scraping in `economic-data.ts` with direct CSV downloads from the RBA. Add exchange rates (F11) and GDP (H1) as new data points.

### 1.3 ABS Data API (Official — SDMX 2.1 Compliant)

The ABS provides a proper REST API — **far more reliable than HTML scraping**.

- **Base URL**: `https://data.api.abs.gov.au/rest/data/ABS,{DATASET_ID}/{FILTER}`
- **Formats**: JSON (`format=jsondata`), CSV (`format=csv`), XML (default)
- **Auth**: None required (public API)
- **Rate Limits**: Not documented but generous for public access

| Dataset ID | Description | Key Series | Update Freq |
|------------|-------------|------------|-------------|
| `CPI` | Consumer Price Index | All Groups CPI, Trimmed Mean | Quarterly |
| `CPI_M` | Monthly CPI Indicator | Monthly CPI indicator | Monthly |
| `LF` | Labour Force | Unemployment rate, participation rate | Monthly |
| `ANA_AGG` | National Accounts (Aggregates) | GDP, GDP growth | Quarterly |
| `WPI` | Wage Price Index | Total hourly rates of pay | Quarterly |

**Example API calls**:
```
# CPI - All groups, weighted average
https://data.api.abs.gov.au/rest/data/ABS,CPI/1.10001.10.50.Q?startPeriod=2024-Q1&format=jsondata

# Unemployment rate, seasonally adjusted
https://data.api.abs.gov.au/rest/data/ABS,LF/0.6.3.1609.20.M?startPeriod=2025-01&format=jsondata
```

**Indicator API** (simpler alternative):
- **Base URL**: `https://api.data.abs.gov.au/indicator`
- Returns headline economic indicators in JSON
- Smaller datasets, only most in-demand data

**Recommendation**: Migrate from HTML scraping to ABS Data API for CPI and Labour Force. Add GDP and Wage Price Index as new indicators.

### 1.4 APRA Data

APRA does **not** offer a public API. Data is published as downloadable Excel/CSV files on their website.

| Publication | Description | URL | Format | Update Freq |
|-------------|-------------|-----|--------|-------------|
| MADIS | Monthly ADI Statistics | `apra.gov.au/monthly-authorised-deposit-taking-institution-statistics` | XLSX | Monthly |
| QSS | Quarterly Superannuation Stats | `apra.gov.au/quarterly-superannuation-statistics` | XLSX | Quarterly |
| MySuper Stats | Product-level super stats | `apra.gov.au/annual-mysuper-statistics` | XLSX | Annual |

**Recommendation**: Low priority for automated ingestion. APRA data is better served as Cognee universal knowledge (manually curated, infrequently updated). Contact `dataanalytics@apra.gov.au` for bulk data access.

### 1.5 ATO Data

The ATO does not provide a structured REST API for tax rates. However:
- Tax rate tables are published at `ato.gov.au/tax-rates-and-codes`
- PAYG withholding tables have stable API-like URLs: `ato.gov.au/api/public/content/{guid}`
- Tax tables for 2025-26 FY are available

**Recommendation**: Tax rates change at most annually (budget night). Hard-code in `tax-return.ts` (already done — see `marginalRateAtCents()` in tax-optimizer.ts) with annual review. No API integration needed.

---

## 2. Trading & Investment APIs

### 2.1 ASX Market Data

ASX does **not** offer free public APIs. Official data access is via MarketSource (commercial).

**Free alternatives for ASX data**:

| Provider | Free Tier | ASX Support | Data | Auth |
|----------|-----------|-------------|------|------|
| **Alpha Vantage** | 25 calls/day | Yes (ASX:XXX symbols) | Daily/weekly/monthly OHLCV, 50+ technical indicators | API key (free) |
| **Finnhub** | 60 calls/min | Limited | Real-time quotes, company fundamentals | API key (free) |
| **Twelve Data** | 800 calls/day | Yes (XASX exchange) | Real-time, historical, technical indicators | API key (free) |
| **Marketstack** | 100 calls/month | Yes | EOD, intraday, splits, dividends | API key (free) |
| **iTick** | Contact | Yes | Real-time, historical | API key |
| **QuoteAPI** | Contact | Yes (ASX + NZX) | Full AU/NZ coverage | API key |

**Recommendation**: **Alpha Vantage** (primary) + **Twelve Data** (fallback). Alpha Vantage covers ASX with `symbol=XXX.AX` format. 25 calls/day is sufficient for daily portfolio updates — cache aggressively.

### 2.2 Cryptocurrency Data

| Provider | Free Tier | Rate Limit | Data | Auth |
|----------|-----------|------------|------|------|
| **CoinGecko** (Demo) | 10,000 calls/mo | 30/min | Prices, market cap, volume, historical (1yr) | API key (free) |
| **CoinGecko** (Public) | Unlimited | 5-15/min | Same data, lower priority | None |
| **CoinMarketCap** | 10,000 calls/mo | 30/min | Similar to CoinGecko | API key (free) |
| **CoinAPI** | 100 calls/day | N/A | OHLCV, trades, order books | API key (free) |

**Recommendation**: **CoinGecko Demo API** (primary). Free, generous limits, excellent AU currency support (`vs_currencies=aud`). Endpoints:
- `/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=aud` — current prices
- `/api/v3/coins/{id}/market_chart?vs_currency=aud&days=365` — historical chart
- `/api/v3/coins/markets?vs_currency=aud&order=market_cap_desc&per_page=100` — top 100

### 2.3 Foreign Exchange (Forex)

| Provider | Free Tier | Rate Limit | Data | Auth |
|----------|-----------|------------|------|------|
| **ExchangeRate-API** (Open) | Unlimited | 1/hour | 161 currencies, daily rates | None |
| **ExchangeRate-API** (Free) | 1,500 calls/mo | N/A | Same, faster updates | API key (free) |
| **Fixer.io** | 100 calls/mo | N/A | 170 currencies, hourly | API key (free) |
| **exchangerate.host** | 1,000 calls/mo | N/A | 170+ currencies, historical | API key (free) |
| **fawazahmed0/exchange-api** | Unlimited | None | 200+ currencies, daily | None (GitHub hosted) |

**But note**: RBA Table F11 already provides AUD exchange rates for 20+ major currencies, updated daily, with no API key needed. This is the most authoritative source for AUD rates.

**Recommendation**: **RBA F11 CSV** (primary — already authoritative, free, no key). **ExchangeRate-API Open** (fallback for exotic currencies). No API key needed for either.

### 2.4 Commodities

| Provider | Free Tier | Data | Auth |
|----------|-----------|------|------|
| **Nasdaq Data Link** (Quandl) | Limited free datasets | Gold, silver, oil, ~100 commodities (daily spot prices) | API key (free) |
| **Alpha Vantage** | 25 calls/day (shared quota) | Commodities: WTI, Brent, gold, silver, copper, aluminum, wheat, corn, cotton, sugar, coffee | API key (free) |

**Recommendation**: **Alpha Vantage** (primary, shares quota with stock calls). Commodities endpoint: `function=COMMODITY&commodity=GOLD&interval=monthly`. **Nasdaq Data Link** (supplementary for niche commodities).

---

## 3. Trading Platform Integration

### 3.1 Direct API Access

| Platform | API Available? | Type | Trading? | Portfolio Read? |
|----------|---------------|------|----------|-----------------|
| **CommSec** | No public API | N/A | No | No |
| **SelfWealth** | No public API | N/A | No | No |
| **Interactive Brokers** | Yes (Client Portal API, TWS API) | REST/WebSocket | Yes | Yes |
| **Stake** | No public API | N/A | No | No |
| **eToro** | Partners only | REST | Limited | Limited |

**Key finding**: Only Interactive Brokers offers a real developer API among mainstream Australian brokers. CommSec, SelfWealth, and Stake have no public APIs.

### 3.2 Aggregation via SnapTrade

**SnapTrade** is the most promising path for multi-broker integration in Australia.

| Feature | Detail |
|---------|--------|
| **Australian brokers** | CommSec (read-only), Stake AU (read + trade), Interactive Brokers (read-only) |
| **Data available** | Holdings, positions, balances, account info, transaction history |
| **Auth model** | OAuth2 — user links their brokerage account via SnapTrade widget |
| **Pricing** | Contact for pricing (B2B SaaS model) |
| **API docs** | `docs.snaptrade.com` |

**Recommendation**: Phase 1 = CSV/statement import (already have parsers). Phase 2 = SnapTrade integration for real-time portfolio sync (requires commercial agreement). Phase 3 = IBKR direct API for power users.

### 3.3 CSV Import Strategy (Immediate)

All Australian brokers export transaction history as CSV. GoldLedger already has CSV parsing infrastructure (`parsers/formats/csv-parser.ts`).

| Platform | Export Format | Fields Available |
|----------|-------------|------------------|
| CommSec | CSV | Date, security, quantity, price, brokerage, total |
| SelfWealth | CSV | Date, type, security, quantity, price, brokerage |
| Interactive Brokers | CSV/Flex Query | Comprehensive (trades, dividends, fees, FX) |
| Stake | CSV | Date, type, symbol, quantity, price, fees |
| Sharesight | CSV (export) | Comprehensive portfolio + CGT reports |

**Recommendation**: Build a `TradeCSVParser` with broker-specific column mappings (similar to how bank-specific parsers work). This is the lowest-cost, highest-value integration path.

### 3.4 Consumer Data Right (CDR) — Open Banking

Australia's CDR (Open Banking) provides machine-readable product data from all major banks.

| Feature | Detail |
|---------|--------|
| **What it covers** | Bank product data (rates, fees, eligibility), consumer transaction data (with consent) |
| **2026 expansion** | Non-bank lenders join from July 2026 |
| **Auth model** | OAuth2 + PKCE, FAPI-compliant, requires ACCC accreditation as Data Recipient |
| **Product data** | Public, no auth needed — each bank publishes product APIs |
| **Consumer data** | Requires accreditation, consent flow, mTLS |
| **Standards** | `consumerdatastandardsaustralia.github.io/standards/` |

**Product Reference Data** (no auth needed — public APIs):
```
# CBA products
https://api.commbank.com.au/public/cds-au/v1/banking/products

# Westpac products
https://digital-api.westpac.com.au/cds-au/v1/banking/products
```

**Recommendation**: Phase 1 = Ingest public CDR product data (loan rates, savings rates, fee schedules) into Cognee universal knowledge. Phase 2 = Pursue ACCC accreditation for consumer data access (long-term).

---

## 4. Universal Knowledge Graph Design

### 4.1 Definition of "Universal Knowledge"

Universal knowledge is **non-personal, factual data** that benefits all GoldLedger users equally. It is the opposite of user-specific data (transactions, account details, personal preferences).

**Categories of universal knowledge**:

| Category | Examples | Update Frequency |
|----------|----------|-----------------|
| **Interest Rates** | RBA cash rate, bank lending rates, savings rates | Daily/monthly |
| **Tax Rules** | Tax brackets, super guarantee rate, CGT discount, FBT rates | Annual (budget) |
| **Economic Indicators** | CPI, unemployment, GDP, wage growth | Monthly/quarterly |
| **Market Data** | ASX indices, crypto prices, forex rates, commodity prices | Daily |
| **Award Wages** | Minimum wage, award rates by industry | Annual (FWC decision) |
| **Regulatory Data** | GST thresholds, reporting deadlines, ABN registry | Infrequent |
| **Product Data** | CDR bank products (loan rates, fee schedules) | Weekly |
| **Industry Benchmarks** | ATO small business benchmarks by industry | Annual |

### 4.2 Cognee Dataset Design — Universal vs Personal

**Naming convention**: Universal datasets use NO user prefix. Personal datasets use `user_{userId}_` prefix.

```typescript
// Universal datasets (shared, no user prefix)
export const UNIVERSAL_DATASETS = {
  // Economic
  rates_rba: 'universal_rates_rba',           // Cash rate, lending rates, exchange rates
  rates_market: 'universal_rates_market',       // Stock indices, crypto, commodities
  indicators_economic: 'universal_indicators_economic', // CPI, GDP, unemployment, wages

  // Tax & Regulatory
  rules_tax: 'universal_rules_tax',             // Tax brackets, rates, thresholds
  rules_gst: 'universal_rules_gst',             // GST rulings, BAS rules
  rules_super: 'universal_rules_super',         // Super guarantee, contribution caps

  // Products & Benchmarks
  products_banking: 'universal_products_banking', // CDR bank product data
  products_loans: 'universal_products_loans',     // Loan comparison data
  benchmarks_industry: 'universal_benchmarks_industry', // ATO industry benchmarks

  // Reference
  ref_merchants: 'universal_ref_merchants',     // Known merchant → canonical name mappings
  ref_abn: 'universal_ref_abn',                 // ABN registry data
} as const;

// Personal datasets (per-user, prefixed)
export const personalDataset = (userId: string, domain: string) =>
  `user_${userId}_${domain}`;
// e.g., user_abc123_transactions, user_abc123_merchant_corrections
```

### 4.3 Refresh Strategy

```typescript
const REFRESH_SCHEDULE = {
  // High frequency (daily)
  daily: [
    'universal_rates_rba',      // RBA CSV download
    'universal_rates_market',   // Alpha Vantage + CoinGecko
  ],

  // Medium frequency (weekly)
  weekly: [
    'universal_products_banking', // CDR product APIs
    'universal_ref_merchants',    // Re-cognify merchant graph
  ],

  // Low frequency (monthly)
  monthly: [
    'universal_indicators_economic', // ABS API data
    'universal_products_loans',      // Loan product refresh
  ],

  // Very low frequency (quarterly/annual)
  quarterly: [
    'universal_rules_tax',        // Only changes at budget
    'universal_rules_gst',        // ATO ruling updates
    'universal_rules_super',      // Annual super guarantee change
    'universal_benchmarks_industry', // ATO annual benchmarks
  ],
};
```

### 4.4 Agent Access Patterns

Agents query universal knowledge **before** personal data for context:

```
1. Agent receives task (e.g., "categorize this transaction")
2. Query universal_ref_merchants → known merchant mappings
3. Query universal_rules_gst → GST treatment rules
4. Query user_{id}_merchant_corrections → user-specific overrides
5. Make decision with universal + personal context
```

**Search type selection per dataset**:

| Dataset | Primary Search Type | Rationale |
|---------|-------------------|-----------|
| `universal_rates_*` | CHUNKS | Fast vector similarity for numeric/time-series data |
| `universal_indicators_*` | CHUNKS | Same — numeric lookups |
| `universal_rules_tax` | RAG_COMPLETION | Need LLM reasoning over complex tax rules |
| `universal_rules_gst` | RAG_COMPLETION | Same — regulatory interpretation |
| `universal_products_*` | CHUNKS_LEXICAL | Exact keyword matching for product names/terms |
| `universal_benchmarks_*` | GRAPH_COMPLETION | Relationship-aware reasoning over industry structures |
| `universal_ref_merchants` | CHUNKS_LEXICAL | Fast keyword lookup for merchant names |

---

## 5. Data Ingestion Architecture

### 5.1 Unified DataIngestionService

```typescript
// Proposed: server/src/services/data-ingestion.ts

interface DataSource {
  id: string;
  name: string;
  fetchFn: () => Promise<unknown>;
  transformFn: (raw: unknown) => string[];  // → Cognee-ready text chunks
  dataset: string;                           // Cognee dataset name
  cacheTable: string;                        // DB cache table
  ttlMs: number;
  schedule: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

class DataIngestionService {
  private sources: DataSource[] = [];

  register(source: DataSource): void;

  // Run all sources matching the given schedule
  async runSchedule(schedule: string): Promise<IngestionReport>;

  // Run a single source by ID
  async runSource(sourceId: string): Promise<IngestionResult>;

  // Fetch → transform → cache in DB → index in Cognee
  private async ingest(source: DataSource): Promise<IngestionResult>;
}
```

### 5.2 Database Tables

The existing `economic_data_cache` table is a good foundation. Extend with:

```sql
-- Already exists
CREATE TABLE economic_data_cache (
  id TEXT PRIMARY KEY,
  data_source TEXT NOT NULL,    -- 'rba' | 'abs' | 'ato' | 'coingecko' | ...
  data_key TEXT NOT NULL,
  data_value TEXT,              -- JSON payload
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT
);

-- New: Market data cache (stocks, crypto, forex, commodities)
CREATE TABLE market_data_cache (
  id TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL,     -- 'stock' | 'crypto' | 'forex' | 'commodity'
  symbol TEXT NOT NULL,         -- 'BHP.AX' | 'BTC' | 'AUD/USD' | 'GOLD'
  data_key TEXT NOT NULL,       -- 'price' | 'ohlcv' | 'history_30d'
  data_value TEXT,              -- JSON payload
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  source TEXT NOT NULL           -- 'alpha_vantage' | 'coingecko' | 'rba_f11'
);
CREATE INDEX idx_market_symbol ON market_data_cache(asset_type, symbol);

-- New: Universal knowledge cache (for Cognee sync tracking)
CREATE TABLE universal_knowledge_sync (
  id TEXT PRIMARY KEY,
  dataset_name TEXT NOT NULL,    -- Cognee dataset name
  last_synced_at TEXT,
  records_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending' | 'syncing' | 'synced' | 'error'
  error_message TEXT,
  next_sync_at TEXT
);
```

### 5.3 Cognee Integration Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│ External API │────▶│ Transform to │────▶│ Cache in DB  │────▶│ Index in │
│ (RBA, ABS,   │     │ text chunks  │     │ (market_data │     │ Cognee   │
│  CoinGecko)  │     │              │     │  _cache)     │     │ dataset  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────┘
                                                                     │
                                                                     ▼
                                                              ┌──────────┐
                                                              │ Cognify  │
                                                              │ (build   │
                                                              │  graph)  │
                                                              └──────────┘
```

**Transform examples**:

```typescript
// RBA cash rate → Cognee text chunk
"RBA Cash Rate: 4.35% effective 2024-11-05. Previous: 4.35% since 2023-11-07. The cash rate has been held steady for 12 months."

// ABS CPI → Cognee text chunk
"Australian CPI: Annual change 3.4% for December 2025 quarter. Quarterly change 0.8%. The trimmed mean (core) inflation was 3.2%."

// Alpha Vantage stock → Cognee text chunk
"BHP Group (BHP.AX): Close $45.20, Change +1.2%, Volume 12.5M shares on 2026-02-12. 52-week range: $38.50 - $52.10."

// CoinGecko crypto → Cognee text chunk
"Bitcoin (BTC): AUD $158,432. 24h change -2.1%. Market cap AUD $3.1T. 24h volume AUD $52B. All-time high AUD $172,000."
```

### 5.4 Scheduling

Use a simple interval-based scheduler (no external cron dependency):

```typescript
// Run on server startup and then at intervals
setInterval(() => ingestionService.runSchedule('daily'), 24 * 60 * 60 * 1000);
setInterval(() => ingestionService.runSchedule('weekly'), 7 * 24 * 60 * 60 * 1000);
// Monthly/quarterly can be checked daily and only run if due
```

Or better — use the existing queue system (`server/src/services/queue.ts`) to schedule ingestion jobs.

---

## 6. API Key Management

### 6.1 Complete API Key Inventory

| Env Variable | Service | Required? | Free? | Current Status |
|-------------|---------|-----------|-------|---------------|
| **Already configured** | | | | |
| `ANTHROPIC_API_KEY` | Claude AI agents | Yes | No ($) | In docker-compose |
| `OPENROUTER_API_KEY` / `VITE_OPENROUTER_API_KEY` | OpenRouter (Gemini, embeddings) | Yes | No ($) | In docker-compose |
| `GOOGLE_API_KEY` | Google Places enrichment | Optional | No ($) | In docker-compose |
| `VITE_OPENAI_API_KEY` | OpenAI fallback | Optional | No ($) | In docker-compose |
| `VERTEX_AI_API_KEY` | Vertex AI (GCP) | Optional | No ($) | In code |
| `RESEND_API_KEY` | Email sending (Resend) | Optional | Free tier | In code |
| `COGNEE_USERNAME` / `COGNEE_PASSWORD` | Cognee auth | Yes | Self-hosted | In code (default) |
| **New — Essential (Free)** | | | | |
| `ALPHA_VANTAGE_API_KEY` | Stocks, commodities | Recommended | Yes (free key, 25/day) | **Needed** |
| `COINGECKO_API_KEY` | Cryptocurrency data | Recommended | Yes (Demo plan, 10k/mo) | **Needed** |
| **New — Optional (Free)** | | | | |
| `NASDAQ_DATA_LINK_API_KEY` | Quandl commodities | Optional | Yes (free datasets) | Not needed immediately |
| `TWELVE_DATA_API_KEY` | Stock data fallback | Optional | Yes (800/day) | Not needed immediately |
| `ABR_GUID` | ABN Lookup (ABR API) | Optional | Yes (free, requires registration) | **Needed** (enrichment) |
| **New — Future (Paid/Complex)** | | | | |
| `SNAPTRADE_CLIENT_ID` + `SNAPTRADE_SECRET` | Broker aggregation | Future | No ($) | Phase 2+ |
| `CDR_CLIENT_ID` + `CDR_CLIENT_SECRET` | Open Banking consumer data | Future | ACCC accreditation required | Phase 3+ |

### 6.2 Naming Convention

```
# Pattern: {PROVIDER}_{PURPOSE}_KEY or {PROVIDER}_API_KEY

# AI Services
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
OPENAI_API_KEY=sk-...

# Market Data
ALPHA_VANTAGE_API_KEY=...
COINGECKO_API_KEY=CG-...
NASDAQ_DATA_LINK_API_KEY=...
TWELVE_DATA_API_KEY=...

# Enrichment
GOOGLE_API_KEY=AIza...
ABR_GUID=...

# Trading Platform
SNAPTRADE_CLIENT_ID=...
SNAPTRADE_CLIENT_SECRET=...

# Email
RESEND_API_KEY=re_...
```

### 6.3 Docker Compose Addition

```yaml
# Add to docker-compose.yml server environment
environment:
  # Market Data (free keys)
  - ALPHA_VANTAGE_API_KEY=${ALPHA_VANTAGE_API_KEY}
  - COINGECKO_API_KEY=${COINGECKO_API_KEY}
  # Enrichment
  - ABR_GUID=${ABR_GUID}
```

---

## 7. Priority Ranking

### Tier 1 — Immediate (Wave 1-2, No/Free API Keys)

| Priority | Source | Action | Cost | Impact |
|----------|--------|--------|------|--------|
| **P0** | RBA CSV tables | Replace HTML scraping with CSV parsing for ALL RBA data (A2, F5, F11, G1, H1) | Free | High — eliminates fragile scraping, adds exchange rates + GDP |
| **P0** | ABS Data API | Replace HTML scraping with SDMX REST API for CPI, unemployment, wages | Free | High — structured JSON, reliable |
| **P1** | ATO tax tables | Ensure `tax-optimizer.ts` brackets match 2025-26 FY; add annual review process | Free | Medium — correctness critical |
| **P1** | Universal Knowledge bootstrap | Seed Cognee with tax rules, GST rulings, super rates, industry benchmarks | Free | High — enables smart agent reasoning |

### Tier 2 — Short-term (Wave 3-5, Free API Keys)

| Priority | Source | Action | Cost | Impact |
|----------|--------|--------|------|--------|
| **P1** | Alpha Vantage | Add ASX stock price lookups + commodity data | Free key | Medium — investment tracking |
| **P1** | CoinGecko | Add crypto portfolio valuation | Free key | Medium — crypto tracking |
| **P2** | CDR Product APIs | Ingest public bank product data (no auth) | Free | Medium — loan comparison |
| **P2** | Trade CSV parsers | Build broker-specific CSV import (CommSec, SelfWealth, IBKR, Stake) | Free | High — unlocks investment tracking |

### Tier 3 — Medium-term (Wave 6-10, Some Cost)

| Priority | Source | Action | Cost | Impact |
|----------|--------|--------|------|--------|
| **P2** | ABR API | Automated ABN lookup for merchant enrichment | Free (registration) | Medium — GST verification |
| **P2** | Nasdaq Data Link | Expanded commodity data | Free key | Low — niche |
| **P3** | SnapTrade | Real-time broker sync (CommSec, Stake, IBKR) | Paid (B2B) | High — but complex |
| **P3** | IBKR API | Direct IBKR integration for power users | Free (IBKR account) | Medium — niche |

### Tier 4 — Long-term (Wave 11+, Significant Investment)

| Priority | Source | Action | Cost | Impact |
|----------|--------|--------|------|--------|
| **P3** | CDR Consumer Data | ACCC accreditation for Open Banking transaction access | Expensive (compliance) | Transformative — multi-bank |
| **P4** | APRA data | Automated XLSX download + parse for super/banking stats | Free | Low — manual is fine |
| **P4** | Real-time market data | WebSocket feeds for live portfolio values | Paid | Low — daily is fine for accounting |

---

## Summary of Key Findings

1. **The existing `economic-data.ts` is fragile** — HTML scraping should be replaced with RBA CSV downloads and ABS REST API calls. This is the single highest-value improvement.

2. **Only 2 new API keys are needed short-term**: Alpha Vantage (stocks/commodities) and CoinGecko (crypto). Both are free.

3. **No Australian broker offers a public API** except Interactive Brokers. CSV import is the pragmatic path. SnapTrade is the aggregation play for later.

4. **CDR Open Banking product data is free and public** — a goldmine for loan/savings comparison that requires zero auth.

5. **Universal knowledge in Cognee** should be separated from personal data via naming convention. Refresh schedules should match data volatility (daily for rates, quarterly for tax rules).

6. **The `DataIngestionService` pattern** (fetch → transform → cache → Cognee index) unifies all external data into a single pipeline, reusing the existing queue and caching infrastructure.
