-- Migration: 0018_stp_payslips_timesheets.sql
-- Description: Tables for STP compliance, payslips, and timesheets (Wave 6)

CREATE TABLE IF NOT EXISTS stp_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    pay_run_id TEXT NOT NULL REFERENCES pay_runs(id),
    event_type TEXT NOT NULL, -- pay_event, update, finalisation
    status TEXT NOT NULL DEFAULT 'draft', -- draft, submitted, accepted, rejected, error
    submission_date TEXT,
    ato_response_id TEXT,
    xml_payload TEXT, -- ENCRYPTED (AES-256-GCM)
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stp_employee_ytd (
    id TEXT PRIMARY KEY,
    stp_event_id TEXT NOT NULL REFERENCES stp_events(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    gross_payments INTEGER DEFAULT 0,
    ordinary_time_earnings INTEGER DEFAULT 0,
    overtime_payments INTEGER DEFAULT 0,
    bonuses_commissions INTEGER DEFAULT 0,
    paid_leave INTEGER DEFAULT 0,
    allowances_income INTEGER DEFAULT 0,
    tax_withheld INTEGER DEFAULT 0,
    super_guarantee INTEGER DEFAULT 0,
    reportable_super INTEGER DEFAULT 0,
    rfba INTEGER DEFAULT 0,
    lump_sum_a INTEGER DEFAULT 0,
    lump_sum_b INTEGER DEFAULT 0,
    lump_sum_d INTEGER DEFAULT 0,
    lump_sum_e INTEGER DEFAULT 0,
    etp_code TEXT,
    etp_amount INTEGER DEFAULT 0,
    income_stream_code TEXT,
    tax_treatment_code TEXT,
    employment_basis TEXT,
    cessation_type TEXT,
    cessation_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payslips (
    id TEXT PRIMARY KEY,
    pay_run_id TEXT NOT NULL REFERENCES pay_runs(id),
    employee_id TEXT NOT NULL REFERENCES employees(id),
    pay_period_start TEXT NOT NULL,
    pay_period_end TEXT NOT NULL,
    pay_date TEXT NOT NULL,
    gross_pay INTEGER NOT NULL,
    tax_withheld INTEGER NOT NULL,
    super_amount INTEGER NOT NULL,
    net_pay INTEGER NOT NULL,
    pdf_path TEXT,
    sent_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS awards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    effective_date TEXT,
    expiry_date TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS award_rates (
    id TEXT PRIMARY KEY,
    award_id TEXT NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
    classification TEXT NOT NULL,
    level TEXT,
    hourly_rate INTEGER NOT NULL,
    casual_loading REAL DEFAULT 0.25,
    overtime_multiplier REAL DEFAULT 1.5,
    effective_date TEXT
);

CREATE TABLE IF NOT EXISTS timesheets (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    break_minutes INTEGER DEFAULT 0,
    total_hours REAL DEFAULT 0,
    pay_category_id TEXT REFERENCES pay_categories(id),
    status TEXT NOT NULL DEFAULT 'draft', -- draft, submitted, approved
    approved_by TEXT REFERENCES users(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS timesheet_entries (
    id TEXT PRIMARY KEY,
    timesheet_id TEXT NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
    project_id TEXT,
    task_description TEXT,
    hours REAL NOT NULL,
    billable BOOLEAN DEFAULT FALSE
);

-- Recommended Indexes
CREATE INDEX IF NOT EXISTS idx_stp_events_user_status ON stp_events(user_id, status);
CREATE INDEX IF NOT EXISTS idx_stp_employee_ytd_event ON stp_employee_ytd(stp_event_id);
CREATE INDEX IF NOT EXISTS idx_payslips_run_employee ON payslips(pay_run_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_awards_user_active ON awards(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_timesheets_employee_date ON timesheets(employee_id, date);
