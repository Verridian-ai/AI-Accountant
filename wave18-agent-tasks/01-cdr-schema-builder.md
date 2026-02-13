# Agent 1: CDR Schema Builder

## Role
Create 9 CDR Open Banking tables and migration 0030 for storing data holder info, product catalogs, lending/deposit rates, fees, features, eligibility criteria, crawl logs, and rate alerts.

## Priority: WAVE 18 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0030_cdr_open_banking.sql`
**Purpose**: 9 tables for Consumer Data Right product data
**Pattern**: Follow `docker/migrations/0012_tax_return_platform.sql` structure

- [ ] Create `cdr_data_holders` table:
  ```sql
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
  ```

- [ ] Create `cdr_products` table:
  ```sql
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
  ```

- [ ] Create `cdr_lending_rates` table:
  ```sql
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
  ```

- [ ] Create `cdr_deposit_rates` table:
  ```sql
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
  ```

- [ ] Create `cdr_fees` table:
  ```sql
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
  ```

- [ ] Create `cdr_features` table:
  ```sql
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
  ```

- [ ] Create `cdr_eligibility` table:
  ```sql
  CREATE TABLE IF NOT EXISTS cdr_eligibility (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    product_id TEXT NOT NULL REFERENCES cdr_products(id) ON DELETE CASCADE,
    eligibility_type TEXT NOT NULL,
    additional_value TEXT,
    additional_info TEXT,
    additional_info_uri TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```

- [ ] Create `cdr_crawl_log` table:
  ```sql
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
  ```

- [ ] Create `cdr_rate_alerts` table:
  ```sql
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
  ```

- [ ] Create indexes:
  ```sql
  CREATE INDEX idx_cdr_products_category ON cdr_products(product_category);
  CREATE INDEX idx_cdr_products_data_holder ON cdr_products(data_holder_id);
  CREATE INDEX idx_cdr_lending_rates_product ON cdr_lending_rates(product_id);
  CREATE INDEX idx_cdr_lending_rates_type ON cdr_lending_rates(lending_rate_type);
  CREATE INDEX idx_cdr_deposit_rates_product ON cdr_deposit_rates(product_id);
  CREATE INDEX idx_cdr_fees_product ON cdr_fees(product_id);
  CREATE INDEX idx_cdr_features_product ON cdr_features(product_id);
  CREATE INDEX idx_cdr_crawl_log_holder ON cdr_crawl_log(data_holder_id);
  CREATE INDEX idx_cdr_rate_alerts_user ON cdr_rate_alerts(user_id);
  ```

### 2. `server/src/db/cdr-schema.ts`
**Purpose**: Drizzle schema definitions for all 9 CDR tables
**Pattern**: Follow `server/src/schema.ts` using `sqliteTable()` for all tables

- [ ] Export 9 table definitions matching the SQL migration exactly
- [ ] Export TypeScript types: `CdrDataHolder`, `CdrProduct`, `CdrLendingRate`, `CdrDepositRate`, `CdrFee`, `CdrFeature`, `CdrEligibility`, `CdrCrawlLog`, `CdrRateAlert`

## Files to MODIFY

### 3. `server/src/schema.ts`
- [ ] Add `export * from './db/cdr-schema.js';` at the end of the file to re-export CDR tables

## Verification
- [ ] Migration runs clean against PostgreSQL: `docker exec goldledger-postgres psql -U goldledger -d ai_accountant -f /migrations/0030_cdr_open_banking.sql`
- [ ] All 9 tables created with correct columns and constraints
- [ ] Indexes created successfully
- [ ] Drizzle schema types compile: `cd server && npx tsc --noEmit` (no new errors)
- [ ] Create marker file: `.agent-done-W18-01`

## Dependencies
- **None** -- can start immediately
- **Reuses**: server/src/schema.ts pattern, docker/migrations/ directory
