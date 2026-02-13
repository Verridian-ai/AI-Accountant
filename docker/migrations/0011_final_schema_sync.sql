-- ============================================================================
-- 0011: Final schema sync — catch-all for columns in schema.ts not yet in DB
-- ============================================================================

-- parser_feedback: missing columns from schema.ts
ALTER TABLE parser_feedback ADD COLUMN IF NOT EXISTS ai_confidence TEXT;
ALTER TABLE parser_feedback ADD COLUMN IF NOT EXISTS user_notes TEXT;
ALTER TABLE parser_feedback ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Ensure user_categories table exists (created in 0006 but verify)
CREATE TABLE IF NOT EXISTS user_categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_name TEXT NOT NULL,
    parent_category TEXT,
    icon TEXT,
    color TEXT,
    is_income BOOLEAN DEFAULT FALSE,
    is_transfer BOOLEAN DEFAULT FALSE,
    is_hidden BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS user_categories_idx ON user_categories(user_id, category_name);

-- Ensure debt_payoff_scenarios table exists (created in 0006 but verify)
CREATE TABLE IF NOT EXISTS debt_payoff_scenarios (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    strategy TEXT NOT NULL,
    accounts_included TEXT NOT NULL,
    monthly_budget INTEGER,
    projected_payoff_date TEXT,
    total_interest_cost INTEGER,
    total_payments INTEGER,
    monthly_breakdown TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS debt_scenario_user_idx ON debt_payoff_scenarios(user_id);

-- Verify all table indexes exist (idempotent)
CREATE INDEX IF NOT EXISTS idx_upload_queue_batch ON upload_queue(batch_id);
CREATE INDEX IF NOT EXISTS idx_upload_queue_state ON upload_queue(state);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_extraction ON transactions(extraction_hash);
