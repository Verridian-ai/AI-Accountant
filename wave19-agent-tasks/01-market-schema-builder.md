# Agent 1: Market Schema Builder

## Role
Create 6 market intelligence tables and migration 0031 for storing economic data feeds, market prices, sentiment analysis snapshots, alerts, and an economic calendar.

## Priority: WAVE 19 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0031_market_intelligence.sql`
**Purpose**: 6 tables for market data, economic indicators, sentiment, and alerts
**Pattern**: Follow `docker/migrations/0030_cdr_open_banking.sql` structure

- [ ] Create `market_data_feeds` table:
  ```sql
  CREATE TABLE IF NOT EXISTS market_data_feeds (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    feed_name TEXT NOT NULL UNIQUE,
    feed_type TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_name TEXT NOT NULL,
    description TEXT,
    refresh_frequency TEXT NOT NULL,
    last_fetched_at TEXT,
    last_successful_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```
  - `feed_type` values: 'rba_csv', 'abs_sdmx', 'alpha_vantage', 'coingecko', 'sentiment'
  - `refresh_frequency` values: 'daily', 'hourly', 'weekly', 'monthly'

- [ ] Create `economic_indicators` table:
  ```sql
  CREATE TABLE IF NOT EXISTS economic_indicators (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    feed_id TEXT NOT NULL REFERENCES market_data_feeds(id),
    indicator_code TEXT NOT NULL,
    indicator_name TEXT NOT NULL,
    category TEXT NOT NULL,
    value REAL NOT NULL,
    previous_value REAL,
    change_pct REAL,
    unit TEXT NOT NULL,
    frequency TEXT NOT NULL,
    reference_period TEXT NOT NULL,
    source TEXT NOT NULL,
    notes TEXT,
    observation_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(indicator_code, reference_period)
  );
  ```
  - `category` values: 'interest_rates', 'inflation', 'employment', 'gdp', 'wages', 'housing', 'exchange_rates', 'money_supply'
  - `unit` values: 'percent', 'index', 'aud_millions', 'aud_billions', 'ratio', 'count', 'thousands'
  - `frequency` values: 'daily', 'monthly', 'quarterly', 'annual'

- [ ] Create `market_prices` table:
  ```sql
  CREATE TABLE IF NOT EXISTS market_prices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    feed_id TEXT NOT NULL REFERENCES market_data_feeds(id),
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    price REAL NOT NULL,
    previous_close REAL,
    change_amount REAL,
    change_pct REAL,
    day_high REAL,
    day_low REAL,
    volume BIGINT,
    market_cap REAL,
    currency TEXT NOT NULL DEFAULT 'AUD',
    exchange TEXT,
    observation_date TEXT NOT NULL,
    observation_time TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(symbol, observation_date)
  );
  ```
  - `asset_type` values: 'equity', 'etf', 'index', 'cryptocurrency', 'commodity', 'forex'

- [ ] Create `sentiment_snapshots` table:
  ```sql
  CREATE TABLE IF NOT EXISTS sentiment_snapshots (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    topic TEXT NOT NULL,
    query TEXT NOT NULL,
    sentiment_score REAL,
    sentiment_label TEXT,
    confidence REAL,
    positive_count INTEGER DEFAULT 0,
    negative_count INTEGER DEFAULT 0,
    neutral_count INTEGER DEFAULT 0,
    total_posts INTEGER DEFAULT 0,
    top_positive JSONB DEFAULT '[]'::jsonb,
    top_negative JSONB DEFAULT '[]'::jsonb,
    summary TEXT,
    sources JSONB DEFAULT '[]'::jsonb,
    analysis_model TEXT,
    observation_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(topic, observation_date)
  );
  ```
  - `sentiment_label` values: 'very_positive', 'positive', 'neutral', 'negative', 'very_negative'

- [ ] Create `market_alerts` table:
  ```sql
  CREATE TABLE IF NOT EXISTS market_alerts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL DEFAULT 'default',
    alert_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_symbol TEXT,
    target_indicator TEXT,
    condition TEXT NOT NULL,
    threshold_value REAL NOT NULL,
    current_value REAL,
    is_active BOOLEAN DEFAULT true,
    is_triggered BOOLEAN DEFAULT false,
    last_triggered_at TEXT,
    notification_method TEXT DEFAULT 'in_app',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```
  - `alert_type` values: 'price_above', 'price_below', 'indicator_change', 'sentiment_shift'
  - `target_type` values: 'equity', 'crypto', 'indicator', 'sentiment'
  - `condition` values: 'above', 'below', 'crosses_above', 'crosses_below', 'change_pct_exceeds'

- [ ] Create `economic_calendar` table:
  ```sql
  CREATE TABLE IF NOT EXISTS economic_calendar (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    event_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL,
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT,
    country TEXT NOT NULL DEFAULT 'AU',
    importance TEXT NOT NULL DEFAULT 'medium',
    previous_value TEXT,
    forecast_value TEXT,
    actual_value TEXT,
    impact_description TEXT,
    is_completed BOOLEAN DEFAULT false,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```
  - `event_type` values: 'rba_decision', 'cpi_release', 'employment_data', 'gdp_release', 'wages_data', 'housing_data', 'trade_balance', 'business_confidence'
  - `importance` values: 'high', 'medium', 'low'

- [ ] Create indexes:
  ```sql
  CREATE INDEX idx_economic_indicators_code ON economic_indicators(indicator_code);
  CREATE INDEX idx_economic_indicators_category ON economic_indicators(category);
  CREATE INDEX idx_economic_indicators_date ON economic_indicators(observation_date);
  CREATE INDEX idx_market_prices_symbol ON market_prices(symbol);
  CREATE INDEX idx_market_prices_type ON market_prices(asset_type);
  CREATE INDEX idx_market_prices_date ON market_prices(observation_date);
  CREATE INDEX idx_sentiment_topic ON sentiment_snapshots(topic);
  CREATE INDEX idx_sentiment_date ON sentiment_snapshots(observation_date);
  CREATE INDEX idx_market_alerts_user ON market_alerts(user_id);
  CREATE INDEX idx_economic_calendar_date ON economic_calendar(scheduled_date);
  CREATE INDEX idx_economic_calendar_type ON economic_calendar(event_type);
  ```

### 2. `server/src/db/market-schema.ts`
**Purpose**: Drizzle schema definitions for all 6 market tables
**Pattern**: Follow `server/src/schema.ts` using `sqliteTable()` for all tables

- [ ] Export 6 table definitions matching the SQL migration exactly
- [ ] Export TypeScript types: `MarketDataFeed`, `EconomicIndicator`, `MarketPrice`, `SentimentSnapshot`, `MarketAlert`, `EconomicCalendarEvent`

## Files to MODIFY

### 3. `server/src/schema.ts`
- [ ] Add `export * from './db/market-schema.js';` at the end of the file to re-export market tables

## Verification
- [ ] Migration runs clean against PostgreSQL: `docker exec goldledger-postgres psql -U goldledger -d ai_accountant -f /migrations/0031_market_intelligence.sql`
- [ ] All 6 tables created with correct columns and constraints
- [ ] Indexes created successfully
- [ ] Drizzle schema types compile: `cd server && npx tsc --noEmit` (no new errors)
- [ ] Unique constraints work correctly (duplicate insert fails as expected)
- [ ] Create marker file: `.agent-done-W19-01`

## Dependencies
- **None** -- can start immediately
- **Reuses**: server/src/schema.ts pattern, docker/migrations/ directory
