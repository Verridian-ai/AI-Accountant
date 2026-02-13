-- Migration: 0021_ar_multicurrency.sql
-- Description: Tables for AR aging, multi-currency, and templates (Wave 9)

CREATE TABLE IF NOT EXISTS currencies (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimal_places INTEGER DEFAULT 2,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exchange_rates (
    id TEXT PRIMARY KEY,
    from_currency TEXT NOT NULL REFERENCES currencies(code),
    to_currency TEXT NOT NULL REFERENCES currencies(code),
    rate REAL NOT NULL,
    effective_date TEXT NOT NULL,
    source TEXT NOT NULL, -- manual, api
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_currency, to_currency, effective_date)
);

CREATE TABLE IF NOT EXISTS invoice_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    logo_path TEXT,
    header_html TEXT,
    footer_html TEXT,
    color_scheme TEXT, -- JSON
    is_default BOOLEAN DEFAULT FALSE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_statements (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    opening_balance INTEGER DEFAULT 0, -- cents
    closing_balance INTEGER DEFAULT 0, -- cents
    pdf_path TEXT,
    generated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Recommended Indexes
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(from_currency, to_currency, effective_date);
CREATE INDEX IF NOT EXISTS idx_customer_statements_customer ON customer_statements(customer_id, period_start);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_user ON invoice_templates(user_id);
