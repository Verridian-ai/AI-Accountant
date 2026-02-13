# Agent 8: UI Market Builder

## Role
Build 8 React components for the Market Intelligence feature, providing a comprehensive market data dashboard with economic indicators, price tracking, sentiment analysis, and an economic calendar.

## Priority: WAVE 19 (After Agent 7)

## Wait Condition
Check for `.agent-done-W19-07` marker file before starting.

## Files to CREATE

### 1. `client/src/features/market/index.ts`
**Purpose**: Feature barrel export
```typescript
export { MarketDashboard } from './components/MarketDashboard';
export { EconomicIndicators } from './components/EconomicIndicators';
export { PriceTracker } from './components/PriceTracker';
export { SentimentDashboard } from './components/SentimentDashboard';
export { EconomicCalendar } from './components/EconomicCalendar';
export { MarketBriefing } from './components/MarketBriefing';
export { RateDecisionTracker } from './components/RateDecisionTracker';
export { MarketAlerts } from './components/MarketAlerts';
```

### 2. `client/src/features/market/components/MarketDashboard.tsx`
**Purpose**: Main market intelligence overview page
**Pattern**: Follow `client/src/features/analytics/components/AnalyticsDashboard.tsx` layout

- [ ] Full-width neumorphic container with gold (#FFCC00) accent
- [ ] **Header**: "Market Intelligence" title with last refresh timestamp and refresh button
- [ ] **Key Metrics Row** (5 summary cards, `neu-raised`):
  - RBA Cash Rate: {rate}% with trend arrow and last change date
  - CPI Annual: {rate}% with trend arrow
  - Unemployment: {rate}% with trend arrow
  - ASX 200: {value} with daily change %
  - AUD/USD: {value} with daily change %
  - Each card shows value in large gold text, trend indicator (green up/red down arrow), last updated
- [ ] **Sub-navigation tabs**: Indicators | Prices | Sentiment | Calendar | Briefing | Alerts
- [ ] Render selected sub-component based on active tab
- [ ] Auto-refresh key metrics every 5 minutes
- [ ] API: `GET /api/market/indicators/snapshot`

### 3. `client/src/features/market/components/EconomicIndicators.tsx`
**Purpose**: Detailed economic indicator explorer with charts

- [ ] **Category filter** tabs: All | Interest Rates | Inflation | Employment | GDP | Wages | Housing
- [ ] **Source filter** toggle: RBA | ABS | All
- [ ] **Indicator table** (`neu-inset` container):
  - Columns: Indicator Name, Current Value, Previous Value, Change %, Period, Source
  - Change % colored: green positive, red negative
  - Click row to expand with chart
- [ ] **Expanded indicator detail**:
  - Line chart: value over last 24 months (recharts)
  - Key dates annotated on chart (e.g., RBA decision dates)
  - Statistics: min, max, average over period
  - Source attribution and notes
- [ ] **Interest Rate Dashboard** (special section for interest rates):
  - RBA Cash Rate with decision history timeline
  - Lending rates comparison (home loan variable vs fixed)
  - Deposit rates
  - Spread calculation (lending - cash rate)
- [ ] API: `GET /api/market/indicators?category=...`, `GET /api/market/indicators/:code/history`

### 4. `client/src/features/market/components/PriceTracker.tsx`
**Purpose**: ASX and cryptocurrency price tracking dashboard

- [ ] **Asset type tabs**: ASX Equities | Cryptocurrency | All
- [ ] **ASX Section**:
  - Market status indicator: Open (green) / Closed (red) with next open time
  - ASX 200 index card with intraday mini-chart
  - Watchlist grid (default 14 ASX stocks):
    - Each card: symbol, name, price, daily change %, mini sparkline
    - Color: green card border for gains, red for losses
  - Sector breakdown pie chart
  - API call counter: "X of 25 daily API calls used"
- [ ] **Crypto Section**:
  - Portfolio-style grid (8 default coins):
    - Each card: symbol, name, AUD price, 24hr change %, market cap
    - Mini sparkline from 7-day history
  - Market cap comparison bar chart
- [ ] **Price Detail Modal** (click any asset):
  - Full price chart (7d, 30d, 90d, 1y toggles)
  - Key stats: day high/low, volume, market cap, 52-week range
  - Set price alert button
- [ ] **Add to Watchlist** button: search and add custom symbols
- [ ] API: `GET /api/market/prices`, `GET /api/market/prices/:symbol/history`

### 5. `client/src/features/market/components/SentimentDashboard.tsx`
**Purpose**: Market sentiment analysis and topic research

- [ ] **Default Topics Grid** (8 pre-configured topics):
  - Each topic card (`neu-raised`):
    - Topic name
    - Sentiment gauge: circular progress indicator (-1 to +1) colored red-yellow-green
    - Sentiment label badge (Very Negative ... Very Positive)
    - Confidence bar
    - Last analyzed timestamp
    - "Refresh" button per topic
- [ ] **Custom Topic Research**:
  - Search input: "Research sentiment for..."
  - Loading state with "Researching..." animation
  - Results panel with summary, key findings, sources
- [ ] **Sentiment History** (expandable per topic):
  - Line chart: sentiment score over last 30 days
  - Identify trend direction (improving, declining, volatile)
- [ ] **Market Impact Analysis**:
  - Input: describe an event (e.g., "RBA raises rates by 25bps")
  - Results: affected sectors with positive/negative/neutral badges
  - Short-term and long-term outlook
- [ ] **Trending Topics**: auto-fetched list of current financial trends
- [ ] API: `GET /api/market/sentiment/:topic`, `POST /api/market/sentiment/batch`, `POST /api/market/sentiment/impact`

### 6. `client/src/features/market/components/EconomicCalendar.tsx`
**Purpose**: Calendar of upcoming economic events and releases

- [ ] **Month view** calendar grid:
  - Each day cell shows event count badges
  - High importance events in gold, medium in white, low in grey
  - Click day to see event details
- [ ] **List view** (toggle from calendar):
  - Upcoming events sorted by date
  - Each row: date, event name, type badge, importance badge, previous/forecast/actual values
  - Importance filter: High only | High+Medium | All
- [ ] **Event Detail Modal**:
  - Event name, type, source
  - Previous value, forecast, actual (if released)
  - Impact description
  - Link to source
- [ ] **Key Events** highlighted section:
  - Next RBA decision date (always prominent)
  - Next CPI release
  - Next employment data release
- [ ] API: `GET /api/market/calendar?from=...&to=...&importance=...`

### 7. `client/src/features/market/components/MarketBriefing.tsx`
**Purpose**: AI-generated market briefing combining all data sources

- [ ] **Briefing Generator**:
  - Focus selector: General | Interest Rates | Equities | Property | Business | Personal Finance
  - Timeframe: Daily | Weekly | Monthly
  - "Generate Briefing" button
- [ ] **Briefing Display**:
  - Structured report with sections:
    - Executive Summary (2-3 sentences)
    - Key Indicators table
    - Market Sentiment summary
    - Recommendations (if applicable)
    - Warnings
  - Disclaimer footer
- [ ] **Key Indicators Inline Cards**: show relevant indicator cards within briefing
- [ ] **Save/Share**: bookmark briefings for later reference
- [ ] **Chat Integration**: "Ask about this" button that opens chat with market context
- [ ] API: calls market agent via existing chat endpoint with market context

### 8. `client/src/features/market/components/RateDecisionTracker.tsx`
**Purpose**: Track RBA cash rate decisions and their market impact

- [ ] **Current Rate Card**: large display of current cash rate with effective date
- [ ] **Decision Timeline**: vertical timeline of last 12 RBA decisions
  - Each node: date, decision (hold/raise/cut), amount, cash rate after
  - Color: red for raise, green for cut, grey for hold
- [ ] **Rate Forecast**: community/market expectations for next decision
  - Bar chart: probability of hold vs raise vs cut
  - (Static data initially, could be enhanced later with futures data)
- [ ] **Impact Analysis**: what each 25bps change means for:
  - $500k mortgage monthly repayment change
  - $1M mortgage monthly repayment change
  - Savings account interest change
- [ ] API: `GET /api/market/indicators/cash-rate`, `GET /api/market/indicators/RBA_CASH_RATE/history`

### 9. `client/src/features/market/components/MarketAlerts.tsx`
**Purpose**: Create and manage market price and indicator alerts

- [ ] **Create Alert Form**:
  - Alert type dropdown: Price Above/Below, Indicator Change, Sentiment Shift
  - Target: search for symbol or indicator
  - Condition and threshold value
  - Active toggle
- [ ] **Active Alerts List**:
  - Each alert: type badge, target, condition, threshold, current value, status
  - Toggle active/inactive
  - Delete button
- [ ] **Alert History**: when alerts were triggered
- [ ] API: `POST /api/market/alerts`, `GET /api/market/alerts`

## Files to MODIFY

### 10. `client/src/App.tsx`
- [ ] Import `market` feature components
- [ ] Add "Market" tab/route to main navigation
- [ ] Render `MarketDashboard` as main view

### 11. `client/src/components/layout/BottomNavigation.tsx`
- [ ] Add "Market" navigation item with chart icon

### 12. `client/src/api.ts`
- [ ] Add market API functions:
  ```typescript
  export const fetchEconomicSnapshot = () => fetchJson('/api/market/indicators/snapshot');
  export const fetchIndicators = (params: any) => fetchJson(`/api/market/indicators?${new URLSearchParams(params)}`);
  export const fetchIndicatorHistory = (code: string, months?: number) => fetchJson(`/api/market/indicators/${code}/history?months=${months ?? 24}`);
  export const fetchCashRate = () => fetchJson('/api/market/indicators/cash-rate');
  export const fetchMarketPrices = (type?: string) => fetchJson(`/api/market/prices${type ? `?type=${type}` : ''}`);
  export const fetchPriceHistory = (symbol: string, days?: number) => fetchJson(`/api/market/prices/${symbol}/history?days=${days ?? 30}`);
  export const fetchSentiment = (topic: string) => fetchJson(`/api/market/sentiment/${encodeURIComponent(topic)}`);
  export const fetchBatchSentiment = (topics: string[]) => fetchJson('/api/market/sentiment/batch', { method: 'POST', body: JSON.stringify({ topics }) });
  export const analyzeImpact = (event: string, context: string) => fetchJson('/api/market/sentiment/impact', { method: 'POST', body: JSON.stringify({ event, context }) });
  export const fetchEconomicCalendar = (from: string, to: string) => fetchJson(`/api/market/calendar?from=${from}&to=${to}`);
  export const refreshAllFeeds = () => fetchJson('/api/market/feeds/refresh', { method: 'POST' });
  export const fetchMarketAlerts = () => fetchJson('/api/market/alerts');
  export const createMarketAlert = (alert: any) => fetchJson('/api/market/alerts', { method: 'POST', body: JSON.stringify(alert) });
  ```

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] MarketDashboard renders with 5 key metric summary cards
- [ ] EconomicIndicators displays filtered table with expandable charts
- [ ] PriceTracker shows ASX and crypto watchlists with sparklines
- [ ] SentimentDashboard displays topic sentiment gauges
- [ ] EconomicCalendar renders month view with event badges
- [ ] MarketBriefing generates structured AI report
- [ ] RateDecisionTracker shows cash rate timeline
- [ ] MarketAlerts allows creating and managing alerts
- [ ] All components use neumorphic dark theme with gold accents
- [ ] Create marker file: `.agent-done-W19-08`

## Dependencies
- **Requires**: Agent 7 (`.agent-done-W19-07`) for API endpoints
- **Reuses**: Tailwind neumorphic classes, api.ts fetch patterns, App.tsx routing pattern, recharts for charts
