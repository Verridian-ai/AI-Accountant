-- ============================================================================
-- 0023: Inventory Management & Bank Reconciliation
-- ============================================================================

-- ---------------------------------------------------------------------------
-- inventory_items: Product/stock catalog with costing methods
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit_of_measure TEXT NOT NULL DEFAULT 'each',
    cost_method TEXT NOT NULL DEFAULT 'weighted_average',
    current_cost_cents INTEGER NOT NULL DEFAULT 0,
    sale_price_cents INTEGER DEFAULT 0,
    gst_applicable BOOLEAN DEFAULT TRUE,
    reorder_point INTEGER DEFAULT 0,
    reorder_quantity INTEGER DEFAULT 0,
    supplier_name TEXT,
    supplier_abn TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_user_sku ON inventory_items(user_id, sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_category ON inventory_items(user_id, category);

-- ---------------------------------------------------------------------------
-- warehouses: Storage locations for inventory
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_user_name ON warehouses(user_id, name);

-- ---------------------------------------------------------------------------
-- inventory_stock: Current stock levels per item per warehouse
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_stock (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity_on_hand REAL NOT NULL DEFAULT 0,
    quantity_reserved REAL DEFAULT 0,
    last_counted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_stock_item_warehouse ON inventory_stock(item_id, warehouse_id);

-- ---------------------------------------------------------------------------
-- inventory_movements: Audit trail for all stock changes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
    movement_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_cost_cents INTEGER NOT NULL DEFAULT 0,
    total_cost_cents INTEGER NOT NULL DEFAULT 0,
    reference_id TEXT,
    reference_type TEXT,
    notes TEXT,
    movement_date TEXT NOT NULL,
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_date ON inventory_movements(item_id, movement_date);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse_date ON inventory_movements(warehouse_id, movement_date);

-- ---------------------------------------------------------------------------
-- bank_recon_rules: Configurable matching rules for reconciliation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_recon_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    match_type TEXT NOT NULL,
    match_config TEXT NOT NULL,
    auto_confirm BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bank_recon_rules_user_active ON bank_recon_rules(user_id, is_active);

-- ---------------------------------------------------------------------------
-- bank_recon_sessions: Reconciliation session tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_recon_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    session_name TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    statement_balance_cents INTEGER,
    ledger_balance_cents INTEGER,
    difference_cents INTEGER,
    total_matched INTEGER DEFAULT 0,
    total_unmatched INTEGER DEFAULT 0,
    auto_matched INTEGER DEFAULT 0,
    manual_matched INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bank_recon_sessions_user_account_status ON bank_recon_sessions(user_id, account_id, status);

-- ---------------------------------------------------------------------------
-- bank_recon_matches: Individual match results within a session
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_recon_matches (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES bank_recon_sessions(id) ON DELETE CASCADE,
    bank_transaction_id TEXT NOT NULL REFERENCES transactions(id),
    ledger_entry_id TEXT,
    match_type TEXT NOT NULL,
    confidence REAL DEFAULT 0,
    match_rule_id TEXT REFERENCES bank_recon_rules(id),
    match_reasons TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    confirmed_by TEXT REFERENCES users(id),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bank_recon_matches_session_status ON bank_recon_matches(session_id, status);
CREATE INDEX IF NOT EXISTS idx_bank_recon_matches_bank_tx ON bank_recon_matches(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_bank_recon_matches_session_confidence ON bank_recon_matches(session_id, confidence DESC);
