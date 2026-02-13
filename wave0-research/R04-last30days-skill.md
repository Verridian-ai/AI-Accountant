# R04: Last 30 Days Skill & Market Intelligence Integration

**Agent**: R04 — Last 30 Days Skill Researcher
**Date**: 2026-02-12
**Status**: Complete

---

## 1. Plugin Overview

### What Is last30days-skill?

The [last30days-skill](https://github.com/mvanhorn/last30days-skill) (2.4k stars, 275 forks) is a Claude Code skill plugin that researches any topic across **Reddit** and **X (Twitter)** from the past 30 days, synthesizes findings, and generates copy-paste-ready prompts or expert briefings.

### Core Architecture

| Component | Detail |
|-----------|--------|
| **Orchestrator** | `scripts/last30days.py` (Python) |
| **Modules** | `scripts/lib/` — env, dates, cache, http, models, scoring, dedup, render, schema |
| **APIs Used** | OpenAI Responses API (Reddit search), xAI Responses API (X search), Reddit JSON API |
| **Output Formats** | `--emit=compact\|json\|md\|context\|path` |
| **Cache** | 24-hour TTL by topic+date, stored at `~/.local/share/last30days/out/` |
| **Dependencies** | Python 3, OpenAI API key (required), optional xAI key or Bird CLI for X |
| **Operating Modes** | Reddit-only, X-only, or both (full cross-validation) |
| **Allowed Tools** | Bash, Read, Write, AskUserQuestion, WebSearch |

### Data Flow

```
Topic Input -> Discovery (Reddit/X APIs with 30-day constraint)
           -> Enrichment (thread JSON for engagement metrics)
           -> Normalization (canonical schema)
           -> Scoring (relevance + recency + engagement)
           -> Deduplication (text similarity)
           -> Rendering (markdown + JSON + context snippet)
```

### Output Schema

Each result contains:
- Source URL + platform (Reddit/X)
- Author/handle
- Timestamp (within 30-day window)
- Engagement metrics (upvotes, likes, reposts)
- Relevance/popularity composite score
- Full text excerpt

### Integration API

```bash
# Programmatic JSON output
python3 ~/.claude/skills/last30days/scripts/last30days.py "topic" --emit=json > research.json

# Context snippet for injection into agents
python3 ~/.claude/skills/last30days/scripts/last30days.py "topic" --emit=context

# Dynamic path retrieval
CONTEXT_PATH=$(python3 scripts/last30days.py "topic" --emit=path)
```

---

## 2. Data Coverage Assessment

### What It Covers

| Dimension | Coverage | Notes |
|-----------|----------|-------|
| **Time Range** | Last 30 days (configurable via `--days=N`) | Strict recency enforcement |
| **Platforms** | Reddit + X (Twitter) | Two-phase search: discover handles/subreddits, then drill deeper |
| **Data Type** | Social sentiment, trends, discussions | NOT structured financial data (no prices, rates, indices) |
| **Granularity** | Post-level (individual threads/tweets) | Engagement-weighted scoring |
| **Financial Markets** | No direct coverage | Would return Reddit/X discussions *about* markets |
| **Australian-Specific** | No explicit ASX, AUD, RBA support | Could search for "ASX trends" but returns social posts, not market data |
| **Real-Time Prices** | None | This is a sentiment/discussion tool, not a market data feed |

### Key Insight: Complementary, Not Primary

**last30days is a sentiment/discussion research tool, NOT a market data API.** It provides:
- What Reddit/X users are saying about financial topics
- Community sentiment on stocks, sectors, economic policy
- Trending financial discussions and hot takes

It does **NOT** provide:
- Stock prices, indices, or exchange rates
- Interest rates or economic indicators
- Historical financial data or time series
- Structured quantitative market data

**Verdict**: Valuable as a **complementary sentiment layer** alongside structured market data APIs. Not suitable as a primary market data source.

---

## 3. Integration Design

### Recommendation: Option B — New `market_intelligence` Agent

After analyzing the existing agent architecture (11 agent types in `types.ts`, all extending `ClaudeAgent<TInput, TOutput>` base class), the recommended approach is a **new `market_intelligence` agent** that combines multiple data sources:

```
market_intelligence agent
+-- Tool: fetch_economic_snapshot    (existing EconomicDataService)
+-- Tool: fetch_market_sentiment     (last30days via subprocess)
+-- Tool: fetch_stock_data           (yfinance via subprocess)
+-- Tool: fetch_rba_tables           (RBA CSV download)
+-- Tool: search_market_knowledge    (Cognee: market_intelligence dataset)
+-- Tool: store_market_insight       (Cognee: index new findings)
```

### Why Option B Over A or C

| Option | Pros | Cons |
|--------|------|------|
| **A: Tool in financial_planner** | Simple, no new agent | Overloads planner (already 5 tools), mixing concerns |
| **B: New market_intelligence agent** | Clean separation, focused tools, reusable by other agents | New agent type to register |
| **C: Separate microservice** | Language-agnostic, scalable | Over-engineered for this use case, Docker complexity |

**Option B wins** because:
1. Follows existing pattern (`ClaudeAgent<MarketIntelligenceInput, MarketIntelligenceOutput>`)
2. Other agents (financial_planner, tax_strategy) can call its tools via Cognee shared datasets
3. Clean boundary: market data gathering vs financial planning logic

### Proposed Types

```typescript
// Add to types.ts AgentType union
| 'market_intelligence'

// Input
export interface MarketIntelligenceInput {
  query: string;                    // What to research
  queryType: 'sentiment' | 'rates' | 'stocks' | 'economic' | 'comprehensive';
  symbols?: string[];               // ASX tickers like 'BHP.AX', 'CBA.AX'
  dateRange?: { start: string; end: string };
  userId?: string;                  // For user-scoped Cognee datasets
}

// Output
export interface MarketIntelligenceOutput {
  economicSnapshot: {
    cashRate?: { rate: number; effectiveDate: string; source: string };
    cpi?: { annual: number; quarterly: number; period: string };
    unemployment?: { rate: number; participation: number; period: string };
    lendingRates?: { variable: number; fixed: number; investor: number };
  } | null;

  marketSentiment: {
    overall: 'bullish' | 'bearish' | 'neutral' | 'mixed';
    topDiscussions: Array<{
      title: string;
      source: string;         // 'reddit' | 'x'
      url: string;
      engagement: number;     // Composite score
      sentiment: 'positive' | 'negative' | 'neutral';
      summary: string;
    }>;
    trendingTopics: string[];
    sourceCount: { reddit: number; x: number; web: number };
  } | null;

  stockData: Array<{
    symbol: string;
    name: string;
    price: number;            // AUD
    change24h: number;        // percentage
    volume: number;
    high52w: number;
    low52w: number;
    pe?: number;
    dividendYield?: number;
    source: string;
  }> | null;

  rbaTableData: Array<{
    tableId: string;          // e.g. 'F5', 'F7', 'D2'
    tableName: string;
    latestValue: number;
    latestDate: string;
    previousValue: number;
    trend: 'up' | 'down' | 'stable';
  }> | null;

  insights: string[];           // AI-generated synthesis
  summary: string;
  fetchedAt: string;
}
```

### Agent Tools Design

#### Tool 1: `fetch_economic_snapshot`
- **Delegates to**: Existing `EconomicDataService.getEconomicSnapshot()`
- **Data**: RBA cash rate, lending rates, ABS CPI, unemployment
- **Cache**: 24h (RBA), 7d (ABS) — already implemented
- **No new dependencies**

#### Tool 2: `fetch_market_sentiment`
- **Delegates to**: last30days Python script via safe subprocess invocation
- **Input**: Topic string, `--emit=json`, `--days=N`
- **Output**: Parsed JSON with scored results
- **Cache**: 24h (matching last30days built-in cache)
- **Dependencies**: Python 3, OpenAI API key
- **Timeout**: 120s (skill takes 2-8 minutes for deep research)
- **Safety**: Use `execFile` (NOT `exec`) to prevent shell injection — use existing `execFileNoThrow` utility

```typescript
// Integration pattern using safe subprocess invocation
import { execFileNoThrow } from '../utils/execFileNoThrow.js';

async function fetchMarketSentiment(topic: string, days: number = 30): Promise<SentimentResult> {
  const scriptPath = path.join(process.env.LAST30DAYS_PATH || '', 'scripts/last30days.py');
  const result = await execFileNoThrow('python3', [
    scriptPath, topic, '--emit=json', `--days=${days}`
  ]);
  if (result.status !== 0) throw new Error(`last30days failed: ${result.stderr}`);
  return JSON.parse(result.stdout);
}
```

#### Tool 3: `fetch_stock_data`
- **Delegates to**: Python subprocess calling yfinance (via `execFileNoThrow`)
- **Input**: Array of ticker symbols (e.g., `['BHP.AX', 'CBA.AX', 'WOW.AX']`)
- **Output**: Current price, 24h change, volume, 52-week range
- **Cache**: 1h during market hours, 24h off-hours
- **Dependencies**: Python 3, yfinance (`pip install yfinance`)
- **ASX Support**: yfinance supports ASX stocks via `.AX` suffix

```python
# Helper script: scripts/fetch_stock.py
import yfinance as yf
import json, sys

symbols = sys.argv[1:]
data = []
for sym in symbols:
    ticker = yf.Ticker(sym)
    info = ticker.info
    data.append({
        'symbol': sym,
        'name': info.get('shortName', sym),
        'price': info.get('currentPrice', 0),
        'change24h': info.get('regularMarketChangePercent', 0),
        'volume': info.get('volume', 0),
        'high52w': info.get('fiftyTwoWeekHigh', 0),
        'low52w': info.get('fiftyTwoWeekLow', 0),
        'pe': info.get('trailingPE'),
        'dividendYield': info.get('dividendYield'),
    })
print(json.dumps(data))
```

#### Tool 4: `fetch_rba_tables`
- **Delegates to**: HTTP fetch + CSV parsing (extend `EconomicDataService`)
- **Tables**: F5 (lending rates), F7 (business lending), D2 (credit aggregates), F11.1 (exchange rates), G1 (CPI)
- **Format**: RBA provides CSVs directly at predictable URLs
- **Cache**: 24h
- **No new dependencies** (already have fetch + CSV parsing in economic-data.ts)

```typescript
const RBA_TABLE_URLS: Record<string, string> = {
  'F5': 'https://www.rba.gov.au/statistics/tables/csv/f5-data.csv',    // Indicator lending rates
  'F7': 'https://www.rba.gov.au/statistics/tables/csv/f7-data.csv',    // Business lending rates
  'D2': 'https://www.rba.gov.au/statistics/tables/csv/d2-data.csv',    // Lending & credit aggregates
  'F11.1': 'https://www.rba.gov.au/statistics/tables/csv/f11.1-data.csv', // Exchange rates
  'G1': 'https://www.rba.gov.au/statistics/tables/csv/g1-data.csv',    // Consumer price inflation
};
```

#### Tool 5: `search_market_knowledge`
- **Delegates to**: `cogneeTools.search(query, 'market_intelligence', 'GRAPH_COMPLETION')`
- **Dataset**: `market_intelligence` (shared/universal — see Section 4)

#### Tool 6: `store_market_insight`
- **Delegates to**: `cogneeTools.index(data, 'market_intelligence')`
- **Triggers**: `cogneeTools.cognify('market_intelligence')` after batch updates

### Registration

Add to `config.ts`:
```typescript
// AGENT_MODELS
market_intelligence: 'claude-sonnet-4-5-20250929',  // Sonnet for data synthesis

// AGENT_TOKEN_BUDGETS
market_intelligence: { maxInputTokens: 60000, maxOutputTokens: 8000, maxToolCalls: 12, warningThresholdPercent: 80 },
```

Add to `types.ts` AgentType union:
```typescript
| 'market_intelligence'
```

---

## 4. Universal Knowledge Graph Design

### Key Principle: Market Data Is Shared

Unlike transaction data (per-user), market intelligence is **universal**. All users benefit from the same RBA cash rate, the same ASX stock prices, and the same Reddit sentiment about Australian markets.

### Cognee Dataset Strategy

```typescript
// Add to cognee-tools.ts COGNEE_DATASETS
export const COGNEE_DATASETS = {
  // ... existing datasets ...

  // Universal market intelligence (no user prefix)
  marketIntelligence: 'market_intelligence',        // Synthesized insights
  marketSentiment: 'market_sentiment',              // Reddit/X discussions
  asxData: 'asx_market_data',                       // Stock prices & fundamentals
  rbaStatistics: 'rba_statistics',                  // Interest rates, lending, credit
  absStatistics: 'abs_statistics',                  // CPI, unemployment, GDP
} as const;
```

### Data Flow: Universal -> Cognee -> Agents

```
Daily Cron Job (or Docker healthcheck trigger)
    |
    +-- fetch_economic_snapshot()
    |   +-- Index into 'rba_statistics' + 'abs_statistics'
    |
    +-- fetch_market_sentiment("Australian economy interest rates ASX")
    |   +-- Index into 'market_sentiment'
    |
    +-- fetch_stock_data(['ASX200.AX', 'CBA.AX', 'BHP.AX', ...])
    |   +-- Index into 'asx_market_data'
    |
    +-- cognify(['market_intelligence', 'market_sentiment', 'asx_market_data', 'rba_statistics'])
```

### Refresh Schedule

| Data Type | Refresh Frequency | Rationale |
|-----------|-------------------|-----------|
| RBA Cash Rate | Daily | Changes ~8x/year, 24h cache sufficient |
| RBA Lending Tables | Daily | Monthly publication, daily check is safe |
| ABS CPI | Weekly | Quarterly publication |
| ABS Labour Force | Weekly | Monthly publication |
| ASX Stock Prices | Hourly during market hours (10am-4pm AEST) | Market volatility |
| Reddit/X Sentiment | Daily | 30-day window means daily updates capture trends |
| Cognee Re-cognify | Daily (overnight) | Graph rebuild after all data refreshed |

### Implementation: Cron Service

```typescript
// server/src/services/market-refresh.ts
import { CronJob } from 'cron';

// Daily at 6 AM AEST (8 PM UTC previous day)
const dailyRefresh = new CronJob('0 20 * * *', async () => {
  const agent = new MarketIntelligenceAgent();
  await agent.refreshUniversalData();
});

// Hourly during ASX market hours (Mon-Fri, 10am-4pm AEST = 0am-6am UTC)
const marketHoursRefresh = new CronJob('0 0-6 * * 1-5', async () => {
  await agent.refreshStockData(['ASX200.AX', /* watchlist */]);
});
```

### Cross-Agent Access Pattern

Other agents access market intelligence through Cognee without coupling:

```typescript
// financial_planner agent can search market data:
const cashRate = await cogneeTools.search(
  'current RBA cash rate February 2026',
  COGNEE_DATASETS.rbaStatistics,
  'CHUNKS'
);

// tax_strategy agent can get economic context:
const outlook = await cogneeTools.search(
  'Australian economic outlook inflation impact on small business',
  COGNEE_DATASETS.marketIntelligence,
  'GRAPH_COMPLETION'
);

// chat endpoint can provide market-aware answers:
const sentiment = await cogneeTools.search(
  query,
  COGNEE_DATASETS.marketSentiment,
  'GRAPH_SUMMARY_COMPLETION'
);
```

---

## 5. Complementary Data Sources

### Source Comparison Matrix

| Source | Type | Australian Coverage | Free Tier | Rate Limit | Real-Time | Reliability |
|--------|------|-------------------|-----------|-----------|-----------|-|
| **last30days** | Social sentiment | Indirect (search-based) | Requires OpenAI key (~$0.01/search) | N/A | 30-day window | High (2.4k stars) |
| **yfinance** | Stock prices | ASX via `.AX` suffix | Unlimited | ~2000 req/hr | 15-min delay | Medium (unofficial Yahoo API) |
| **Alpha Vantage** | Stock prices + fundamentals | ASX support inconsistent | 25 req/day | 5 req/min | Near real-time | Medium |
| **RBA Statistics** | Interest rates, credit, FX | Authoritative Australian | Free, no key | No limit | Daily CSV updates | Very High |
| **ABS Statistics** | CPI, unemployment, GDP | Authoritative Australian | Free, no key | No limit | Monthly/quarterly | Very High |
| **pyasx** | ASX-specific data | Native ASX focus | Free | Unknown | Varies | Low (community) |
| **EODHD** | Global market data | 70+ exchanges inc. ASX | Limited free | 20 req/day | EOD + some intraday | High |
| **Financial Modeling Prep** | US-focused fundamentals | Limited international | 250 req/day | 5 req/sec | Real-time (US) | High (US only) |

### Recommended Source Combination

**Tier 1 — Always On (Free, Reliable)**
1. **RBA Statistical Tables** — Authoritative AU interest rates, lending data, FX rates
   - URL pattern: `https://www.rba.gov.au/statistics/tables/csv/{table}-data.csv`
   - Tables: F5, F7, D2, D14, F11.1, G1
   - Already partially implemented in `economic-data.ts`
2. **ABS Statistics** — CPI, unemployment, labour force
   - Already partially implemented in `economic-data.ts`
3. **Existing EconomicDataService** — Already built, just needs extension

**Tier 2 — Market Data (Free with Limitations)**
4. **yfinance** (Python) — ASX stock prices, fundamentals, dividends
   - Suffix: `.AX` for ASX (e.g., `BHP.AX`, `CBA.AX`, `WOW.AX`)
   - Free, no API key, 15-minute delayed quotes
   - Risk: Unofficial API, may break
5. **Alpha Vantage** — Backup for yfinance, plus FX rates
   - Free tier: 25 requests/day (sufficient for daily refresh)
   - Better FX data than yfinance
   - ASX support: Inconsistent (`ASX:NAB` format, may not always work)

**Tier 3 — Sentiment Layer (Requires API Keys)**
6. **last30days-skill** — Reddit/X financial sentiment
   - Requires: OpenAI API key (already available in GoldLedger for Claude fallback)
   - Optional: xAI key or Bird CLI for X coverage
   - Best for: "What are people saying about X?", market sentiment, trending topics

### Unified Market Data Interface

```typescript
// server/src/services/market-data.ts

export interface UnifiedMarketData {
  // Tier 1: Always-on Australian data
  rba: {
    cashRate: number;
    businessLendingRate: number;
    homeLoanVariableRate: number;
    homeLoanFixedRate: number;
    audUsdRate: number;
    creditGrowth: number;
    lastUpdated: string;
  };
  abs: {
    cpiAnnual: number;
    cpiQuarterly: number;
    unemploymentRate: number;
    participationRate: number;
    wageGrowth: number;
    lastUpdated: string;
  };

  // Tier 2: Market data (when available)
  stocks?: Array<{
    symbol: string;
    name: string;
    price: number;
    change: number;
    volume: number;
    source: 'yfinance' | 'alpha_vantage' | 'eodhd';
  }>;

  // Tier 3: Sentiment (when configured)
  sentiment?: {
    overall: string;
    topDiscussions: Array<{ title: string; source: string; score: number }>;
    trendingTopics: string[];
    source: 'last30days';
    fetchedAt: string;
  };
}

// Fallback cascade for stock data
async function fetchStockData(symbols: string[]): Promise<StockData[]> {
  try {
    return await yfinanceFetch(symbols);       // Primary: yfinance
  } catch {
    try {
      return await alphaVantageFetch(symbols);  // Fallback: Alpha Vantage
    } catch {
      return [];                                // Graceful degradation
    }
  }
}
```

---

## 6. Implementation Estimate

### Phase 1: Core Agent (2-3 days)

| Task | Effort | Files |
|------|--------|-------|
| Add `market_intelligence` to AgentType union | 15 min | `types.ts` |
| Define MarketIntelligenceInput/Output interfaces | 30 min | `types.ts` |
| Register in AGENT_MODELS + AGENT_TOKEN_BUDGETS | 15 min | `config.ts` |
| Add Cognee datasets (market_intelligence, etc.) | 15 min | `cognee-tools.ts` |
| Extend EconomicDataService with RBA table fetching | 2h | `economic-data.ts` |
| Create MarketIntelligenceAgent class | 4h | `agents/market-intelligence.ts` (new) |
| Wire into orchestrator | 1h | `orchestrator.ts` |

### Phase 2: Data Sources (2-3 days)

| Task | Effort | Files |
|------|--------|-------|
| Create Python helper: `scripts/fetch_stock.py` (yfinance) | 2h | New file |
| Integrate last30days via safe subprocess (execFileNoThrow) | 2h | Agent tool handler |
| Alpha Vantage fallback adapter | 2h | `services/alpha-vantage.ts` (new) |
| RBA CSV parser for F5, F7, D2, F11.1, G1 tables | 3h | `economic-data.ts` |
| Cache layer for stock + sentiment data | 1h | `economic-data.ts` |

### Phase 3: Universal Knowledge (1-2 days)

| Task | Effort | Files |
|------|--------|-------|
| Daily refresh cron service | 2h | `services/market-refresh.ts` (new) |
| Cognee indexing for market data | 1h | Via existing cognee-tools |
| Docker integration (cron in server container) | 1h | `docker-compose.yml`, Dockerfile |

### Phase 4: Integration (1 day)

| Task | Effort | Files |
|------|--------|-------|
| Wire financial_planner to use market data via Cognee | 1h | `agents/financial-planner.ts` |
| Wire chat endpoint to include market context | 1h | `services/ai.ts` |
| Add `/api/market` REST endpoint | 1h | `index.ts` |

### Total Estimate: 6-9 days

### Dependencies

| Dependency | Purpose | Install |
|------------|---------|---------|
| `yfinance` | ASX stock data | `pip install yfinance` |
| `last30days` | Sentiment research | Clone to `~/.claude/skills/last30days` |
| `cron` (npm) | Scheduled refresh | `npm install cron` |
| OpenAI API key | last30days + existing fallback | Already available |
| Alpha Vantage API key | Backup stock data | Free: https://www.alphavantage.co/support/ |

### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| yfinance API breaking | Stock data unavailable | Alpha Vantage fallback |
| last30days slow (2-8 min) | Timeout on sentiment queries | Async refresh, serve from Cognee cache |
| RBA CSV format changes | Lending rate parsing fails | Regex-based parsing with fallback to cached data |
| OpenAI costs from last30days | Budget overrun | Daily cap, cache aggressively |
| ASX data gaps in Alpha Vantage | Missing AU stocks | yfinance primary, AV secondary, manual watchlist |

---

## Appendix: Key Source URLs

- [last30days-skill GitHub](https://github.com/mvanhorn/last30days-skill)
- [last30days SKILL.md](https://github.com/mvanhorn/last30days-skill/blob/main/SKILL.md)
- [last30days SPEC.md](https://github.com/mvanhorn/last30days-skill/blob/main/SPEC.md)
- [RBA Statistical Tables](https://www.rba.gov.au/statistics/tables/)
- [RBA Historical Data](https://www.rba.gov.au/statistics/historical-data.html)
- [Alpha Vantage API](https://www.alphavantage.co/documentation/)
- [yfinance GitHub](https://github.com/ranaroussi/yfinance)
- [pyasx GitHub](https://github.com/jericmac/pyasx)
- [EODHD Financial APIs](https://eodhd.com/financial-summary/ASX.AU)
- [Yahoo Finance API Alternatives 2026](https://stockanalysis.com/article/yahoo-finance-alternatives/)
