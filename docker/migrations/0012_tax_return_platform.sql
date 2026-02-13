-- ============================================================================
-- 0012: Tax Return Platform — new tables + claim columns on transactions
-- ============================================================================

-- ---------------------------------------------------------------------------
-- owner_equity_events: Track owner contributions and drawings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS owner_equity_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('contribution', 'drawing')),
    amount INTEGER NOT NULL,
    detected_by TEXT, -- 'ai', 'manual', 'rule'
    confirmed BOOLEAN DEFAULT FALSE,
    financial_year TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_equity_user_fy ON owner_equity_events(user_id, financial_year);

-- ---------------------------------------------------------------------------
-- tax_strategies: AI-suggested tax optimisation strategies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_strategies (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    financial_year TEXT NOT NULL,
    strategy_name TEXT NOT NULL,
    description TEXT,
    estimated_saving INTEGER, -- cents
    confidence REAL,
    ato_ruling_ref TEXT,
    applicable_entities TEXT, -- JSON array
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'applied', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_strategies_user_fy ON tax_strategies(user_id, financial_year);

-- ---------------------------------------------------------------------------
-- loan_scenarios: Loan comparison / repayment calculator scenarios
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loan_scenarios (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    loan_type TEXT NOT NULL CHECK (loan_type IN ('home', 'investment', 'vehicle', 'personal', 'business', 'other')),
    principal INTEGER NOT NULL, -- cents
    rate REAL NOT NULL, -- annual interest rate as decimal
    term_months INTEGER NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'monthly', -- 'weekly', 'fortnightly', 'monthly'
    offset_balance INTEGER DEFAULT 0, -- cents
    extra_repayment INTEGER DEFAULT 0, -- cents per period
    results_json TEXT, -- JSON with amortisation schedule & summaries
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- budget_templates: Reusable budget templates per entity type
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    entity_type TEXT, -- 'sole_trader', 'company', 'trust', 'personal'
    categories_json TEXT, -- JSON array of category budget entries
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- economic_data_cache: Cache for RBA rates, ABS data, etc.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS economic_data_cache (
    id TEXT PRIMARY KEY,
    data_source TEXT NOT NULL, -- 'rba', 'abs', 'ato', etc.
    data_key TEXT NOT NULL,
    data_value TEXT, -- JSON payload
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE (data_source, data_key)
);
CREATE INDEX IF NOT EXISTS idx_econ_cache_source_key ON economic_data_cache(data_source, data_key);

-- ---------------------------------------------------------------------------
-- ALTER transactions: Add tax-claim columns
-- ---------------------------------------------------------------------------
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS claim_type TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS claim_amount INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS claim_method TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS substantiation_status TEXT DEFAULT 'none';
