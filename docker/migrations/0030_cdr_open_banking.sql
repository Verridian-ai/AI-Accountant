-- Migration 0030: CDR Open Banking (Wave 18)
-- Adds Consumer Data Right product tables for bank product comparison and rate alerts

-- ============================================================================
-- CDR DATA HOLDERS (Banks/ADIs registered with ACCC)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cdr_data_holders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  data_holder_brand_id TEXT NOT NULL UNIQUE,
  brand_name TEXT NOT NULL,
  abn TEXT,
  acn TEXT,
  logo_uri TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  register_uri TEXT NOT NULL,
  public_base_uri TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT 'banking',
  last_crawled_at TEXT,
  product_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- CDR PRODUCTS (Banking products from data holders)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cdr_products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  data_holder_id TEXT NOT NULL REFERENCES cdr_data_holders(id),
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  brand_name TEXT,
  product_category TEXT NOT NULL,
  is_tailored BOOLEAN DEFAULT false,
  effective_from TEXT,
  effective_to TEXT,
  application_uri TEXT,
  additional_info_uri TEXT,
  raw_json JSONB,
  last_updated TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(data_holder_id, product_id)
);

-- ============================================================================
-- CDR LENDING RATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS cdr_lending_rates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT NOT NULL REFERENCES cdr_products(id) ON DELETE CASCADE,
  lending_rate_type TEXT NOT NULL,
  rate REAL NOT NULL,
  comparison_rate REAL,
  calculation_frequency TEXT,
  application_frequency TEXT,
  interest_payment_due TEXT,
  repayment_type TEXT,
  loan_purpose TEXT,
  tiers JSONB,
  additional_value TEXT,
  additional_info TEXT,
  additional_info_uri TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- CDR DEPOSIT RATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS cdr_deposit_rates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT NOT NULL REFERENCES cdr_products(id) ON DELETE CASCADE,
  deposit_rate_type TEXT NOT NULL,
  rate REAL NOT NULL,
  calculation_frequency TEXT,
  application_frequency TEXT,
  tiers JSONB,
  additional_value TEXT,
  additional_info TEXT,
  additional_info_uri TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- CDR FEES
-- ============================================================================

CREATE TABLE IF NOT EXISTS cdr_fees (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT NOT NULL REFERENCES cdr_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fee_type TEXT NOT NULL,
  amount TEXT,
  balance_rate TEXT,
  transaction_rate TEXT,
  accrued_rate TEXT,
  accrual_frequency TEXT,
  currency TEXT DEFAULT 'AUD',
  additional_value TEXT,
  additional_info TEXT,
  additional_info_uri TEXT,
  discounts JSONB,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- CDR FEATURES
-- ============================================================================

CREATE TABLE IF NOT EXISTS cdr_features (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT NOT NULL REFERENCES cdr_products(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL,
  additional_value TEXT,
  additional_info TEXT,
  additional_info_uri TEXT,
  is_activated BOOLEAN DEFAULT true,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- CDR ELIGIBILITY
-- ============================================================================

CREATE TABLE IF NOT EXISTS cdr_eligibility (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT NOT NULL REFERENCES cdr_products(id) ON DELETE CASCADE,
  eligibility_type TEXT NOT NULL,
  additional_value TEXT,
  additional_info TEXT,
  additional_info_uri TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- CDR CRAWL LOG (Tracks product data refresh jobs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cdr_crawl_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  data_holder_id TEXT REFERENCES cdr_data_holders(id),
  crawl_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  products_discovered INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  duration_ms INTEGER
);

-- ============================================================================
-- CDR RATE ALERTS (User-configured rate change notifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cdr_rate_alerts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL DEFAULT 'default',
  alert_type TEXT NOT NULL,
  product_category TEXT,
  rate_type TEXT,
  threshold_rate REAL,
  comparison_product_id TEXT REFERENCES cdr_products(id),
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TEXT,
  notification_method TEXT DEFAULT 'in_app',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_cdr_products_category ON cdr_products(product_category);
CREATE INDEX idx_cdr_products_data_holder ON cdr_products(data_holder_id);
CREATE INDEX idx_cdr_lending_rates_product ON cdr_lending_rates(product_id);
CREATE INDEX idx_cdr_lending_rates_type ON cdr_lending_rates(lending_rate_type);
CREATE INDEX idx_cdr_deposit_rates_product ON cdr_deposit_rates(product_id);
CREATE INDEX idx_cdr_fees_product ON cdr_fees(product_id);
CREATE INDEX idx_cdr_features_product ON cdr_features(product_id);
CREATE INDEX idx_cdr_crawl_log_holder ON cdr_crawl_log(data_holder_id);
CREATE INDEX idx_cdr_rate_alerts_user ON cdr_rate_alerts(user_id);
