# Agent 7: API Endpoints Builder

## Role
Wire 22 new API routes in server/src/index.ts for market data feeds, economic indicators, prices, sentiment analysis, economic calendar, and market alerts.

## Priority: WAVE 19 (After Agents 1-6)

## Wait Condition
Check for `.agent-done-W19-01`, `.agent-done-W19-02`, `.agent-done-W19-03`, `.agent-done-W19-04`, `.agent-done-W19-06` marker files before starting.

## Files to MODIFY

### 1. `server/src/index.ts`
**Current state**: ~4,300+ lines with existing routes + Wave 18 CDR routes
**Insert location**: After the CDR routes block (added by Wave 18 Agent 7), before claude-agents mount

- [ ] Add imports after existing service imports:
  ```typescript
  import { RbaDataFeed } from './services/rba-data-feed.js';
  import { AbsDataFeed } from './services/abs-data-feed.js';
  import { MarketPriceService } from './services/market-prices.js';
  import { SentimentAnalysisService } from './services/sentiment-analysis.js';
  import { MarketCogneeIndexer } from './services/market-cognee-indexer.js';
  ```

- [ ] Instantiate services:
  ```typescript
  const rbaDataFeed = new RbaDataFeed();
  const absDataFeed = new AbsDataFeed();
  const marketPriceService = new MarketPriceService();
  const sentimentService = new SentimentAnalysisService();
  const marketCogneeIndexer = new MarketCogneeIndexer();
  ```

- [ ] **Data Feed Management Routes (4 endpoints)**:

  ```typescript
  // List all configured data feeds with status
  app.get('/api/market/feeds', async (c) => {
    try {
      // Query market_data_feeds table
      return c.json(feeds);
    } catch (err) {
      console.error('Failed to list feeds:', err);
      return c.json({ error: 'Failed to list feeds' }, 500);
    }
  });

  // Trigger refresh of all feeds
  app.post('/api/market/feeds/refresh', async (c) => {
    try {
      const rbaResult = await rbaDataFeed.fetchAllTables();
      const absResult = await absDataFeed.fetchAllIndicators();
      const priceResult = await marketPriceService.refreshPrices();
      return c.json({ rba: rbaResult, abs: absResult, prices: priceResult });
    } catch (err) {
      console.error('Feed refresh failed:', err);
      return c.json({ error: 'Feed refresh failed' }, 500);
    }
  });

  // Refresh specific feed
  app.post('/api/market/feeds/:feedId/refresh', async (c) => {
    // Refresh single feed by type (rba, abs, alpha_vantage, coingecko)
  });

  // Get feed status/health
  app.get('/api/market/feeds/:feedId/status', async (c) => {
    // Return feed status, last fetch time, error count
  });
  ```

- [ ] **Economic Indicator Routes (5 endpoints)**:
  ```typescript
  // Get economic snapshot (combined RBA + ABS key indicators)
  app.get('/api/market/indicators/snapshot', async (c) => {
    const snapshot = await economicDataService.getEconomicSnapshot();
    return c.json(snapshot);
  });

  // Get indicators by category
  app.get('/api/market/indicators', async (c) => {
    const category = c.req.query('category');    // interest_rates, inflation, employment, gdp, wages, housing
    const source = c.req.query('source');         // rba, abs, all
    const limit = parseInt(c.req.query('limit') ?? '50');
    // Query economic_indicators table with filters
    return c.json(indicators);
  });

  // Get specific indicator history
  app.get('/api/market/indicators/:code/history', async (c) => {
    const code = c.req.param('code');
    const months = parseInt(c.req.query('months') ?? '24');
    // Return historical values for indicator
    return c.json(history);
  });

  // Get RBA cash rate (convenience endpoint)
  app.get('/api/market/indicators/cash-rate', async (c) => {
    const rate = await rbaDataFeed.getCashRate();
    return c.json(rate);
  });

  // Get CPI data (convenience endpoint)
  app.get('/api/market/indicators/cpi', async (c) => {
    const cpi = await absDataFeed.getLatestIndicator('ABS_CPI_ALL_GROUPS_PCT');
    return c.json(cpi);
  });
  ```

- [ ] **Market Price Routes (5 endpoints)**:
  ```typescript
  // Get all tracked prices (ASX + crypto)
  app.get('/api/market/prices', async (c) => {
    const type = c.req.query('type');             // equity, cryptocurrency, all
    const prices = await marketPriceService.getAllPrices();
    if (type === 'equity') return c.json({ prices: prices.asx });
    if (type === 'cryptocurrency') return c.json({ prices: prices.crypto });
    return c.json(prices);
  });

  // Get specific symbol price
  app.get('/api/market/prices/:symbol', async (c) => {
    const symbol = c.req.param('symbol');
    // Query market_prices for latest price
    return c.json(price);
  });

  // Get price history for symbol
  app.get('/api/market/prices/:symbol/history', async (c) => {
    const symbol = c.req.param('symbol');
    const days = parseInt(c.req.query('days') ?? '30');
    const history = await marketPriceService.getPriceHistory(symbol, days);
    return c.json(history);
  });

  // Search for symbol
  app.get('/api/market/prices/search/:query', async (c) => {
    const query = c.req.param('query');
    const results = await marketPriceService.searchSymbol(query);
    return c.json(results);
  });

  // Refresh prices
  app.post('/api/market/prices/refresh', async (c) => {
    const result = await marketPriceService.refreshPrices();
    return c.json(result);
  });
  ```

- [ ] **Sentiment Routes (4 endpoints)**:
  ```typescript
  // Get sentiment for a topic
  app.get('/api/market/sentiment/:topic', async (c) => {
    const topic = decodeURIComponent(c.req.param('topic'));
    const snapshot = await sentimentService.getSentimentSnapshot(topic);
    return c.json(snapshot);
  });

  // Get sentiment for multiple topics
  app.post('/api/market/sentiment/batch', async (c) => {
    const { topics } = await c.req.json();
    const snapshots = await sentimentService.getMultiTopicSentiment(topics);
    return c.json(snapshots);
  });

  // Get sentiment history
  app.get('/api/market/sentiment/:topic/history', async (c) => {
    const topic = decodeURIComponent(c.req.param('topic'));
    const days = parseInt(c.req.query('days') ?? '30');
    const history = await sentimentService.getSentimentHistory(topic, days);
    return c.json(history);
  });

  // Analyze market impact
  app.post('/api/market/sentiment/impact', async (c) => {
    const { event, context } = await c.req.json();
    const impact = await sentimentService.analyzeMarketImpact(event, context);
    return c.json(impact);
  });
  ```

- [ ] **Economic Calendar Routes (2 endpoints)**:
  ```typescript
  // Get upcoming economic events
  app.get('/api/market/calendar', async (c) => {
    const from = c.req.query('from');
    const to = c.req.query('to');
    const importance = c.req.query('importance');  // high, medium, low
    // Query economic_calendar table with date range and importance filter
    return c.json(events);
  });

  // Add economic event
  app.post('/api/market/calendar', async (c) => {
    const event = await c.req.json();
    // Insert into economic_calendar table
    return c.json(created, 201);
  });
  ```

- [ ] **Market Alert Routes (2 endpoints)**:
  ```typescript
  // Create market alert
  app.post('/api/market/alerts', async (c) => {
    const alert = await c.req.json();
    // Insert into market_alerts table
    return c.json(created, 201);
  });

  // List user's market alerts
  app.get('/api/market/alerts', async (c) => {
    const userId = c.req.query('userId') ?? 'default';
    // Query market_alerts where user_id = userId
    return c.json(alerts);
  });
  ```

### Route Summary (22 total):
| Method | Path | Handler |
|--------|------|---------|
| GET | /api/market/feeds | list data feeds |
| POST | /api/market/feeds/refresh | refresh all feeds |
| POST | /api/market/feeds/:feedId/refresh | refresh specific feed |
| GET | /api/market/feeds/:feedId/status | feed status |
| GET | /api/market/indicators/snapshot | economic snapshot |
| GET | /api/market/indicators | filtered indicators |
| GET | /api/market/indicators/:code/history | indicator history |
| GET | /api/market/indicators/cash-rate | RBA cash rate |
| GET | /api/market/indicators/cpi | CPI data |
| GET | /api/market/prices | all prices |
| GET | /api/market/prices/:symbol | symbol price |
| GET | /api/market/prices/:symbol/history | price history |
| GET | /api/market/prices/search/:query | symbol search |
| POST | /api/market/prices/refresh | refresh prices |
| GET | /api/market/sentiment/:topic | topic sentiment |
| POST | /api/market/sentiment/batch | batch sentiment |
| GET | /api/market/sentiment/:topic/history | sentiment history |
| POST | /api/market/sentiment/impact | impact analysis |
| GET | /api/market/calendar | economic calendar |
| POST | /api/market/calendar | add calendar event |
| POST | /api/market/alerts | create alert |
| GET | /api/market/alerts | list alerts |

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 22 routes accessible via curl (test after Docker rebuild)
- [ ] No route path conflicts with existing or Wave 18 routes (all under `/api/market/`)
- [ ] GET /api/market/indicators/cash-rate returns current RBA cash rate
- [ ] GET /api/market/prices returns ASX and crypto prices
- [ ] GET /api/market/sentiment/Australian%20property returns sentiment data
- [ ] POST /api/market/feeds/refresh triggers all data feeds
- [ ] Create marker file: `.agent-done-W19-07`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W19-01`), Agent 2 (`.agent-done-W19-02`), Agent 3 (`.agent-done-W19-03`), Agent 4 (`.agent-done-W19-04`), Agent 6 (`.agent-done-W19-06`)
- **IMPORTANT**: Only this agent modifies server/src/index.ts for Wave 19 market routes
