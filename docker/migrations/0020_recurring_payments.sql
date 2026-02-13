-- Migration: 0020_recurring_payments.sql
-- Description: Tables for recurring invoices and payment processing (Wave 8)

CREATE TABLE IF NOT EXISTS recurring_invoices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    customer_id TEXT NOT NULL REFERENCES customers(id),
    frequency TEXT NOT NULL, -- weekly, fortnightly, monthly, quarterly, annually
    next_generation_date TEXT NOT NULL,
    end_date TEXT,
    template_invoice_id TEXT REFERENCES invoices(id),
    is_active BOOLEAN DEFAULT TRUE,
    last_generated_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_gateways (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    provider TEXT NOT NULL, -- stripe, paypal, bank_transfer
    config TEXT NOT NULL, -- encrypted JSON
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dunning_sequences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    steps TEXT NOT NULL, -- JSON array
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dunning_history (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    sequence_id TEXT NOT NULL REFERENCES dunning_sequences(id),
    step_number INTEGER NOT NULL,
    sent_at TEXT NOT NULL,
    action TEXT NOT NULL, -- email, sms, phone, suspend
    result TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_subscriptions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    name TEXT NOT NULL,
    amount INTEGER NOT NULL, -- cents
    frequency TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    status TEXT DEFAULT 'active', -- active, paused, cancelled
    recurring_invoice_id TEXT REFERENCES recurring_invoices(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Recommended Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_user_active ON recurring_invoices(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_next_date ON recurring_invoices(next_generation_date);
CREATE INDEX IF NOT EXISTS idx_dunning_history_invoice ON dunning_history(invoice_id);
CREATE INDEX IF NOT EXISTS idx_dunning_history_sequence ON dunning_history(sequence_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_customer ON customer_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_status ON customer_subscriptions(status);
