-- Migration 0031: Market Intelligence (Wave 19)
-- Adds market data feeds, economic indicators, prices, sentiment, alerts, and calendar

-- ============================================================================
-- MARKET DATA FEEDS (configured data sources)
-- ============================================================================

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

-- ============================================================================
-- ECONOMIC INDICATORS (RBA cash rate, CPI, unemployment, GDP, etc.)
-- ============================================================================

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

-- ============================================================================
-- MARKET PRICES (ASX stocks, commodities, forex, crypto)
-- ============================================================================

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

-- ============================================================================
-- SENTIMENT SNAPSHOTS (AI-analyzed market/news sentiment)
-- ============================================================================

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

-- ============================================================================
-- MARKET ALERTS (user-configured price/indicator thresholds)
-- ============================================================================

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

-- ============================================================================
-- ECONOMIC CALENDAR (upcoming RBA meetings, data releases, etc.)
-- ============================================================================

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

-- ============================================================================
-- INDEXES
-- ============================================================================

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
