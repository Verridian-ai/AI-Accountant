# Wave 19 — Market Intelligence & Sentiment Analysis — Orchestration Prompt

You are the **Team Lead** for Wave 19: Market Intelligence & Sentiment Analysis. You coordinate 10 specialized agents to integrate RBA/ABS economic data feeds, ASX market data, and the last30days social sentiment plugin into GoldLedger.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Market intelligence research**: `wave0-research/R04-last30days-skill.md`
- **External data research**: `wave0-research/R10-external-data-sources.md`
- **Existing economic data service**: `server/src/services/economic-data.ts`

## Current State (After Wave 18)
- 24 Claude agents (23 + cdr_product_agent)
- CDR product data crawler operational
- Economic data service exists but only caches RBA cash rate
- last30days plugin not integrated
- 20 migrations (0009–0030) applied

## Dependencies
- **Requires**: Wave 18 (CDR for product context)
- **Estimated Complexity**: HIGH (multiple external API integrations)

## External Data Sources (from R10 research)

### RBA Statistical Tables (Free, No API Key)
| Table | URL Pattern | Data |
|-------|------------|------|
| A2 | `https://www.rba.gov.au/statistics/tables/csv/a2.csv` | Cash rate target |
| F5 | `https://www.rba.gov.au/statistics/tables/csv/f5.csv` | Indicator lending rates |
| F11 | `https://www.rba.gov.au/statistics/tables/csv/f11.csv` | Term deposit rates |
| G1 | `https://www.rba.gov.au/statistics/tables/csv/g1.csv` | Consumer price inflation |
| H1 | `https://www.rba.gov.au/statistics/tables/csv/h1.csv` | Exchange rates |

### ABS Data API (SDMX 2.1, Free)
| Indicator | Dataflow ID | Notes |
|-----------|-------------|-------|
| CPI | `CPI` | Consumer Price Index by group |
| Unemployment | `LF` | Labour Force survey |
| GDP | `ANA_AGG` | National Accounts |
| Wages | `WPI` | Wage Price Index |

### Market Data
- **Alpha Vantage**: ASX stock prices (free tier: 25 req/day, API key required)
- **CoinGecko**: Crypto prices (free tier: 30 req/min, no key needed)

### last30days Plugin
- Social sentiment from Reddit + X (Twitter) for financial topics
- Requires: OpenAI API key, optional xAI key
- Output: JSON with sentiment scores, engagement metrics

## Database Schema Changes

### New Tables (6 tables)
| Table | Columns |
|-------|---------|
| `market_data_feeds` | id, feedName, feedType (rba/abs/asx/crypto/sentiment), sourceUrl, refreshFrequency (hourly/daily/weekly), lastRefreshed, status (active/paused/error), config (JSON) |
| `economic_indicators` | id, feedId, indicatorName, indicatorCode, value, previousValue, changePercent, unit, effectiveDate, source |
| `market_prices` | id, feedId, symbol, name, price, previousClose, changePercent, volume, marketCap, currency, asOf |
| `sentiment_snapshots` | id, topic, platform (reddit/x/both), sentimentScore (-1 to 1), engagementScore, postCount, topPosts (JSON), queriedAt |
| `market_alerts` | id, userId, alertType (indicator_change/price_target/sentiment_shift), condition (JSON), isActive, lastTriggered |
| `economic_calendar` | id, eventName, eventType (rba_decision/abs_release/budget/tax_deadline), eventDate, expectedImpact (high/medium/low), actualResult, notes |

**Migration**: `docker/migrations/0031_market_intelligence.sql`

## API Endpoints (22 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/market/feeds | List configured data feeds |
| POST | /api/market/feeds | Create data feed |
| PATCH | /api/market/feeds/:id | Update feed config |
| POST | /api/market/feeds/:id/refresh | Manual refresh |
| GET | /api/market/indicators | List economic indicators |
| GET | /api/market/indicators/:code | Get indicator history |
| GET | /api/market/indicators/latest | Latest values for all indicators |
| GET | /api/market/prices | List market prices |
| GET | /api/market/prices/:symbol | Get price history |
| POST | /api/market/prices/refresh | Refresh all prices |
| GET | /api/market/sentiment | Latest sentiment snapshots |
| POST | /api/market/sentiment/research | Research topic via last30days |
| GET | /api/market/sentiment/:topic | Get sentiment history for topic |
| GET | /api/market/calendar | Economic event calendar |
| POST | /api/market/calendar | Add custom event |
| GET | /api/market/alerts | List market alerts |
| POST | /api/market/alerts | Create alert |
| PATCH | /api/market/alerts/:id | Update alert |
| DELETE | /api/market/alerts/:id | Delete alert |
| GET | /api/market/dashboard | Aggregated market dashboard data |
| GET | /api/market/impact | Market conditions impact on user's finances |
| POST | /api/market/index-cognee | Index market data to Cognee |

## UI Components
### `client/src/features/market/` — New feature folder
- MarketDashboard.tsx — Aggregated market overview with indicator tiles
- EconomicIndicators.tsx — RBA/ABS indicator cards with trend sparklines
- MarketPrices.tsx — ASX/crypto price table with change indicators
- SentimentPanel.tsx — Reddit/X sentiment visualization
- EconomicCalendar.tsx — Calendar view with upcoming events
- MarketAlertManager.tsx — Create/manage market alerts
- MarketImpactAnalysis.tsx — How market conditions affect your finances
- RateHistory.tsx — Historical rate charts (RBA cash rate, lending rates)

**Navigation**: Add `market` to TabId type

## New Claude Agents (1)
1. **`market_intelligence_agent`** — Researches financial market conditions, correlates economic data with user's finances, generates briefings. Tools: `get_economic_indicators`, `get_market_prices`, `research_sentiment`, `analyze_market_impact`, `generate_market_briefing`, `search_market_knowledge`.

## Cognee Integration
- **New datasets**: `market_intelligence`, `market_sentiment`, `rba_statistics`, `abs_statistics`, `asx_market_data`
- Index indicators for "What's the current RBA cash rate?"
- Index sentiment for "What's the market saying about property?"
- Index calendar for "When is the next RBA decision?"
- Use `RAG_COMPLETION` for market analysis queries
- Refresh schedule: daily (RBA/ABS), hourly during ASX hours (prices), daily (sentiment)

## Testing Criteria
- [ ] RBA CSV tables download and parse correctly (A2, F5, F11, G1, H1)
- [ ] ABS SDMX API returns CPI, unemployment data
- [ ] Alpha Vantage returns ASX stock prices (within free tier limits)
- [ ] last30days returns sentiment for "Australian property market"
- [ ] Economic calendar shows correct RBA decision dates
- [ ] Market alerts trigger on indicator change
- [ ] Market impact analysis correlates rate change with user's loan costs
- [ ] Cognee indexes and searches market data accurately
- [ ] Chat answers "How will the rate rise affect my mortgage?"
- [ ] Chat answers "What's the market sentiment on tech stocks?"
- [ ] `cd server && npx tsc --noEmit` passes clean

## Team Structure — 10 Agents

### Agent 1: market-schema-builder [PRIORITY: WAVE 1]
**Task file**: `wave19-agent-tasks/01-market-schema-builder.md`

### Agent 2: rba-abs-feed-builder [PRIORITY: WAVE 1]
**Task file**: `wave19-agent-tasks/02-rba-abs-feed-builder.md`
**Creates**: server/src/services/rba-data-feed.ts, server/src/services/abs-data-feed.ts

### Agent 3: market-prices-builder [PRIORITY: WAVE 1]
**Task file**: `wave19-agent-tasks/03-market-prices-builder.md`
**Creates**: server/src/services/market-prices.ts

### Agent 4: sentiment-builder [DEPENDS ON: Agent 1]
**Task file**: `wave19-agent-tasks/04-sentiment-builder.md`
**Creates**: server/src/services/sentiment-analysis.ts

### Agent 5: market-agent-builder [DEPENDS ON: Agents 2, 3, 4]
**Task file**: `wave19-agent-tasks/05-market-agent-builder.md`
**Creates**: server/src/services/claude/agents/market-intelligence-agent.ts

### Agent 6: cognee-market-indexer [DEPENDS ON: Agents 2, 3, 4]
**Task file**: `wave19-agent-tasks/06-cognee-market-indexer.md`

### Agent 7: api-endpoints-builder [DEPENDS ON: Agents 2, 3, 4, 5]
**Task file**: `wave19-agent-tasks/07-api-endpoints-builder.md`

### Agent 8: ui-market-builder [DEPENDS ON: Agent 7]
**Task file**: `wave19-agent-tasks/08-ui-market-builder.md`
**Creates**: 8 new .tsx components

### Agent 9: scheduler-builder [DEPENDS ON: Agents 2, 3]
**Task file**: `wave19-agent-tasks/09-scheduler-builder.md`
**Creates**: server/src/services/data-refresh-scheduler.ts

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Task file**: `wave19-agent-tasks/10-testing-validation-agent.md`

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4
Sub-wave 3 (After 2):  Agent 5 + Agent 6 + Agent 9
Sub-wave 4 (After 3):  Agent 7
Sub-wave 5 (After 4):  Agent 8
Sub-wave 6 (After 5):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates. Read each agent's task file from `wave19-agent-tasks/`.
