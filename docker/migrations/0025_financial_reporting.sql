-- ============================================================================
-- 0025: Financial Reporting & Budgeting Platform
-- Tables: report_templates, report_snapshots, budgets, budget_lines,
--         budget_vs_actual, forecast_scenarios, forecast_periods, kpi_metrics
-- ============================================================================

-- ---------------------------------------------------------------------------
-- report_templates: Saved report configurations (P&L, Balance Sheet, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('profit_and_loss', 'balance_sheet', 'cash_flow', 'trial_balance', 'custom')),
    config TEXT NOT NULL,
    schedule TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- report_snapshots: Point-in-time report outputs for comparison & audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_snapshots (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    data TEXT NOT NULL,
    comparison_data TEXT,
    metadata TEXT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_user_type_period
    ON report_snapshots(user_id, report_type, period_start);

-- ---------------------------------------------------------------------------
-- budgets: Top-level budget definitions (annual, quarterly, monthly, project)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    budget_type TEXT NOT NULL CHECK (budget_type IN ('annual', 'quarterly', 'monthly', 'project')),
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'archived')),
    auto_generated BOOLEAN DEFAULT FALSE,
    source_method TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- budget_lines: Per-category budget allocations within a budget
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_lines (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    subcategory TEXT,
    period TEXT NOT NULL,
    budgeted_amount REAL NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(budget_id, category, period)
);

-- ---------------------------------------------------------------------------
-- budget_vs_actual: Variance tracking between budgeted and actual amounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_vs_actual (
    id TEXT PRIMARY KEY,
    budget_line_id TEXT NOT NULL REFERENCES budget_lines(id) ON DELETE CASCADE,
    actual_amount REAL NOT NULL DEFAULT 0,
    variance_amount REAL NOT NULL DEFAULT 0,
    variance_percent REAL DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    last_calculated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_budget_vs_actual_line
    ON budget_vs_actual(budget_line_id);

-- ---------------------------------------------------------------------------
-- forecast_scenarios: What-if scenario definitions for financial forecasting
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS forecast_scenarios (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    scenario_type TEXT NOT NULL CHECK (scenario_type IN ('optimistic', 'realistic', 'pessimistic', 'custom')),
    base_period_start TEXT NOT NULL,
    base_period_end TEXT NOT NULL,
    forecast_months INTEGER NOT NULL DEFAULT 12,
    assumptions TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- forecast_periods: Per-period forecast data within a scenario
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS forecast_periods (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL REFERENCES forecast_scenarios(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    category TEXT NOT NULL,
    forecast_amount REAL NOT NULL,
    confidence_lower REAL,
    confidence_upper REAL,
    method TEXT NOT NULL,
    UNIQUE(scenario_id, period, category)
);

-- ---------------------------------------------------------------------------
-- kpi_metrics: Tracked financial KPIs (margins, ratios, growth rates)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kpi_metrics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    period TEXT NOT NULL,
    target_value REAL,
    trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'stable')),
    previous_value REAL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, metric_name, period)
);
CREATE INDEX IF NOT EXISTS idx_kpi_metrics_user_metric_period
    ON kpi_metrics(user_id, metric_name, period);
