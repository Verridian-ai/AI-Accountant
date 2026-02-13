-- Migration: 0017_pay_runs_leave.sql
-- Description: Tables for pay runs and leave management (Wave 5)

CREATE TABLE IF NOT EXISTS pay_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    pay_period_start TEXT NOT NULL,
    pay_period_end TEXT NOT NULL,
    pay_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, processing, completed, reversed
    frequency TEXT NOT NULL, -- weekly, fortnightly, monthly
    total_gross INTEGER DEFAULT 0,
    total_tax INTEGER DEFAULT 0,
    total_super INTEGER DEFAULT 0,
    total_net INTEGER DEFAULT 0,
    processed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pay_run_lines (
    id TEXT PRIMARY KEY,
    pay_run_id TEXT NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    pay_category_id TEXT NOT NULL REFERENCES pay_categories(id),
    hours REAL DEFAULT 0,
    rate INTEGER DEFAULT 0,
    amount INTEGER DEFAULT 0,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pay_run_summary (
    id TEXT PRIMARY KEY,
    pay_run_id TEXT NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    gross_pay INTEGER DEFAULT 0,
    tax_withheld INTEGER DEFAULT 0,
    super_guarantee INTEGER DEFAULT 0,
    super_salary_sacrifice INTEGER DEFAULT 0,
    net_pay INTEGER DEFAULT 0,
    leave_loading INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pay_run_id, employee_id)
);

CREATE TABLE IF NOT EXISTS leave_types (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    accrual_rate REAL DEFAULT 0,
    accrual_frequency TEXT NOT NULL, -- per_hour, per_pay_period, per_year
    max_balance REAL,
    is_paid BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_balances (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
    balance REAL DEFAULT 0,
    accrued REAL DEFAULT 0,
    taken REAL DEFAULT 0,
    adjustments REAL DEFAULT 0,
    as_at_date TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, leave_type_id)
);

CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    hours REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    approved_by TEXT REFERENCES users(id),
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_transactions (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
    pay_run_id TEXT REFERENCES pay_runs(id),
    type TEXT NOT NULL, -- accrual, taken, adjustment
    hours REAL NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Recommended Indexes
CREATE INDEX IF NOT EXISTS idx_pay_runs_user_status ON pay_runs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pay_run_lines_run ON pay_run_lines(pay_run_id);
CREATE INDEX IF NOT EXISTS idx_pay_run_lines_employee ON pay_run_lines(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status ON leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_transactions_employee_type ON leave_transactions(employee_id, leave_type_id);
