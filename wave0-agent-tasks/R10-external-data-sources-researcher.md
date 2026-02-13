# Agent R10: External Data & Market Intelligence Researcher

## Role

Research ALL external data sources needed for GoldLedger's expanded feature set — trading platforms, market data APIs, economic indicators, and universal knowledge sources. Design the data ingestion architecture.

## Phase: A (Research — Start Immediately, Parallel with R01-R09)

## Research Tasks

### 1. Australian Economic Data Sources

- [ ] RBA Statistical Tables: <https://www.rba.gov.au/statistics/tables/> — cash rate, exchange rates, lending rates
- [ ] ABS (Australian Bureau of Statistics): CPI, employment, GDP data
- [ ] APRA: Banking statistics, superannuation data
- [ ] Document: Which are free/public? API format? Update frequency?
- [ ] Note: `server/src/services/economic-data.ts` already exists (397 lines) — what does it cover?

### 2. Trading & Investment Data Sources

- [ ] ASX market data: How to access? (ASX API, third-party providers)
- [ ] Cryptocurrency data: CoinGecko API (free tier), CoinMarketCap
- [ ] Forex data: Exchange rate APIs (exchangerate-api.com, fixer.io)
- [ ] Commodities: Gold, oil, agricultural (Quandl/Nasdaq Data Link)
- [ ] For each: Free tier limits, authentication, data format, update frequency

### 3. Trading Platform Integration

- [ ] Research common trading platforms in Australia:
  - CommSec (CBA's trading platform)
  - SelfWealth
  - Interactive Brokers
  - Stake
  - eToro
- [ ] Assess: Do any offer APIs for portfolio data? (Most don't for retail)
- [ ] Alternative: CSV/statement import for trading history
- [ ] Design: How to track investment positions without live API access

### 4. Universal Knowledge Graph Design

- [ ] Define "universal knowledge" — data that's NOT personal to any user:
  - Current interest rates (RBA cash rate, bank rates)
  - Tax brackets and thresholds (ATO)
  - Superannuation guarantee rate
  - Award wage rates
  - Market indices (ASX 200, S&P 500)
  - Economic indicators (CPI, unemployment)
  - CDR product data (from R03's research)
- [ ] Design Cognee storage: Shared datasets with no user prefix
- [ ] Design refresh strategy: Different frequencies for different data types
- [ ] Design access pattern: How agents query universal vs personal knowledge

### 5. Data Ingestion Architecture

- [ ] Propose a unified `DataIngestionService` that:
  - Schedules periodic fetches from multiple sources
  - Normalizes data into common formats
  - Stores in database (cache tables) AND Cognee (knowledge graph)
  - Handles rate limiting, retries, error reporting
- [ ] Propose database tables: `economic_data_cache` (exists), `market_data_cache`, `universal_knowledge_cache`
- [ ] Propose Cognee datasets: `universal_rates`, `universal_market`, `universal_tax_rules`

### 6. API Key Management

- [ ] List all external APIs that need API keys
- [ ] Propose: Environment variable naming convention (e.g., `ALPHA_VANTAGE_API_KEY`)
- [ ] Propose: Which APIs are essential (free tier sufficient) vs nice-to-have (paid)
- [ ] Document: Docker-local constraint — all data fetching happens from server container

## Output Format

Write findings to `wave0-research/R10-external-data-sources.md` with these sections:

1. **Australian Economic Data** — RBA, ABS, APRA sources and access methods
2. **Trading & Investment APIs** — Available data sources with free tier details
3. **Trading Platform Integration** — Feasibility assessment, CSV import alternative
4. **Universal Knowledge Design** — Shared data types, Cognee storage, refresh strategy
5. **Data Ingestion Architecture** — Unified service design, scheduling, error handling
6. **API Key Management** — Required keys, naming conventions, cost assessment
7. **Priority Ranking** — Which data sources to integrate first (by value vs effort)

## Completion

- [ ] All sections populated with specific API endpoints and pricing
- [ ] Create marker file: `.agent-done-R10`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **API Research** | Discover, evaluate, and document external REST/JSON APIs | Expert |
| **Data Source Evaluation** | Compare APIs by coverage, cost, reliability, rate limits, auth | Expert |
| **Universal Knowledge Design** | Design shared Cognee datasets for non-personal data (rates, indices) | Advanced |
| **Data Ingestion Architecture** | Design scheduled fetchers with normalization, caching, error handling | Advanced |
| **Australian Economic Data** | Understand RBA, ABS, APRA data sources and access patterns | Advanced |
| **Trading Platform Assessment** | Evaluate broker APIs, CSV import alternatives, portfolio tracking | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel API research | Advanced |

## Sub-Agent Delegation Plan

```
R10 (External Data Sources Researcher):
├── Sub-agent A: Australian Economic Data (RBA, ABS, APRA)
│   ├── Research RBA Statistical Tables API/scraping
│   ├── Research ABS data API (CPI, employment, GDP)
│   ├── Research APRA banking statistics
│   ├── Document: free/public, format, update frequency
│   └── Output: wave0-research/.scratch-R10-economic.md
│
├── Sub-agent B: Trading & Investment APIs
│   ├── Research ASX market data access methods
│   ├── Research crypto APIs (CoinGecko, CoinMarketCap)
│   ├── Research forex/commodity APIs
│   ├── Assess Australian trading platforms (CommSec, SelfWealth, etc.)
│   └── Output: wave0-research/.scratch-R10-trading.md
│
├── Sub-agent C: Universal Knowledge Graph Design
│   ├── Define all "universal" data types (rates, brackets, indices)
│   ├── Design Cognee shared dataset structure
│   ├── Design refresh strategy (different frequencies per data type)
│   ├── Design DataIngestionService architecture
│   └── Output: wave0-research/.scratch-R10-universal.md
│
└── R10 Parent: Merge and produce priority-ranked data source plan
    ├── Read all .scratch-R10-*.md files
    ├── Rank data sources by value vs effort
    ├── Produce API key management plan
    ├── Write final wave0-research/R10-external-data-sources.md
    └── Delete scratch files
```

### Delegation Rules for R10

- Sub-agents write ONLY to `wave0-research/.scratch-R10-*.md` files
- Sub-agent A should include actual API URLs and example responses
- Sub-agent B should include free tier limits and pricing for each API
- Sub-agent C should specify exact Cognee dataset names and refresh intervals

## Dependencies

- **None** — can start immediately
- **Read-only** — does not modify any files
