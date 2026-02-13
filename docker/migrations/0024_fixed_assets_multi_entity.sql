-- Migration 0024: Fixed Assets Register + Multi-Entity Consolidation
-- Adds 10 new tables for asset tracking, depreciation, disposals,
-- entity hierarchy, inter-entity transactions, and consolidation snapshots.

BEGIN;

-- ============================================================================
-- ENTITIES (Multi-Entity Hierarchy) — must come first, referenced by others
-- ============================================================================

CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN (
        'sole_trader', 'company', 'trust', 'partnership', 'smsf', 'individual'
    )),
    abn TEXT,
    acn TEXT,
    tfn TEXT,
    parent_entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
    is_consolidated_parent INTEGER DEFAULT 0,
    financial_year_end TEXT DEFAULT '06-30',
    reporting_currency TEXT DEFAULT 'AUD',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'dormant')),
    address TEXT,
    contact_email TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_entities_user ON entities(user_id);
CREATE INDEX IF NOT EXISTS idx_entities_parent ON entities(parent_entity_id);

-- ============================================================================
-- ENTITY ACCOUNTS (Link entities to bank accounts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_accounts (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'operating' CHECK (role IN (
        'operating', 'savings', 'loan', 'offset', 'credit_card',
        'investment', 'trust', 'super'
    )),
    ownership_percentage REAL DEFAULT 100.0,
    linked_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_id, account_id)
);

-- ============================================================================
-- ENTITY SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_settings (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL UNIQUE REFERENCES entities(id) ON DELETE CASCADE,
    bas_reporting_frequency TEXT DEFAULT 'quarterly' CHECK (bas_reporting_frequency IN (
        'monthly', 'quarterly', 'annually'
    )),
    gst_registered INTEGER DEFAULT 0,
    gst_method TEXT DEFAULT 'cash' CHECK (gst_method IN ('cash', 'accrual')),
    tax_rate REAL,
    lodgement_due_dates TEXT,
    default_depreciation_method TEXT DEFAULT 'diminishing_value',
    instant_write_off_threshold INTEGER DEFAULT 2000000,
    chart_of_accounts_template TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- FIXED ASSETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS fixed_assets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    asset_name TEXT NOT NULL,
    asset_number TEXT UNIQUE,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'plant_and_equipment', 'motor_vehicle', 'office_equipment',
        'computer_equipment', 'furniture_fittings', 'building', 'land',
        'leasehold_improvement', 'intangible', 'low_value_pool'
    )),
    purchase_date TEXT NOT NULL,
    purchase_price INTEGER NOT NULL,
    residual_value INTEGER DEFAULT 0,
    useful_life_months INTEGER,
    depreciation_method TEXT NOT NULL CHECK (depreciation_method IN (
        'straight_line', 'diminishing_value', 'instant_write_off', 'low_value_pool'
    )),
    effective_life_years REAL,
    ato_effective_life_years REAL,
    opening_written_down_value INTEGER,
    current_written_down_value INTEGER,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'disposed', 'fully_depreciated', 'written_off'
    )),
    location TEXT,
    serial_number TEXT,
    supplier TEXT,
    invoice_reference TEXT,
    gst_claimed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_user_status ON fixed_assets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_entity ON fixed_assets(entity_id);

-- ============================================================================
-- ASSET DEPRECIATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_depreciation (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
    financial_year TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    opening_value INTEGER NOT NULL,
    depreciation_amount INTEGER NOT NULL,
    closing_value INTEGER NOT NULL,
    depreciation_rate REAL,
    method_used TEXT NOT NULL,
    is_adjustment INTEGER DEFAULT 0,
    adjustment_reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_id, financial_year)
);

CREATE INDEX IF NOT EXISTS idx_asset_depreciation_fy ON asset_depreciation(financial_year);

-- ============================================================================
-- ASSET DISPOSALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_disposals (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
    disposal_date TEXT NOT NULL,
    disposal_method TEXT NOT NULL CHECK (disposal_method IN (
        'sale', 'scrapped', 'trade_in', 'theft', 'insurance_claim'
    )),
    proceeds INTEGER DEFAULT 0,
    written_down_value_at_disposal INTEGER NOT NULL,
    profit_loss INTEGER NOT NULL,
    gst_on_proceeds INTEGER DEFAULT 0,
    buyer_details TEXT,
    invoice_reference TEXT,
    cgt_applicable INTEGER DEFAULT 0,
    cgt_discount_eligible INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asset_disposals_date ON asset_disposals(disposal_date);

-- ============================================================================
-- INTER-ENTITY TRANSACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS inter_entity_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    to_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    from_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    to_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    description TEXT,
    transaction_date TEXT NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'loan', 'management_fee', 'dividend', 'distribution', 'rent',
        'service_fee', 'asset_transfer', 'capital_contribution'
    )),
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'confirmed', 'eliminated', 'disputed'
    )),
    confirmed_by_from INTEGER DEFAULT 0,
    confirmed_by_to INTEGER DEFAULT 0,
    elimination_group_id TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inter_entity_from ON inter_entity_transactions(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_inter_entity_to ON inter_entity_transactions(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_inter_entity_status ON inter_entity_transactions(status);
CREATE INDEX IF NOT EXISTS idx_inter_entity_elimination ON inter_entity_transactions(elimination_group_id);

-- ============================================================================
-- CONSOLIDATION RULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS consolidation_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    rule_name TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK (rule_type IN (
        'elimination', 'adjustment', 'reclassification', 'minority_interest'
    )),
    description TEXT,
    criteria_json TEXT NOT NULL,
    action_json TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consolidation_rules_parent ON consolidation_rules(parent_entity_id);

-- ============================================================================
-- CONSOLIDATION SNAPSHOTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS consolidation_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    financial_year TEXT NOT NULL,
    snapshot_date TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'finalized')),
    total_revenue INTEGER,
    total_expenses INTEGER,
    total_assets INTEGER,
    total_liabilities INTEGER,
    total_equity INTEGER,
    eliminations_applied INTEGER DEFAULT 0,
    adjustments_json TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parent_entity_id, financial_year, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_consolidation_snapshots_parent_fy ON consolidation_snapshots(parent_entity_id, financial_year);

-- ============================================================================
-- CONSOLIDATION SNAPSHOT LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS consolidation_snapshot_lines (
    id TEXT PRIMARY KEY,
    snapshot_id TEXT NOT NULL REFERENCES consolidation_snapshots(id) ON DELETE CASCADE,
    entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    line_type TEXT NOT NULL CHECK (line_type IN (
        'revenue', 'expense', 'asset', 'liability', 'equity',
        'elimination', 'adjustment'
    )),
    category TEXT NOT NULL,
    description TEXT,
    amount INTEGER NOT NULL,
    is_elimination INTEGER DEFAULT 0,
    source_rule_id TEXT REFERENCES consolidation_rules(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_snapshot_lines_snapshot ON consolidation_snapshot_lines(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_lines_entity ON consolidation_snapshot_lines(entity_id);

COMMIT;
