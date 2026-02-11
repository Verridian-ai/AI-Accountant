-- ═══════════════════════════════════════════════════════════════════
-- CBA Statements Parse v2.0 — Database Migration
-- New tables and column additions for GST automation, budgeting,
-- recurring patterns, anomaly detection, and cross-account transfers.
-- ═══════════════════════════════════════════════════════════════════

-- Enable pgvector extension (required for Cognee vector storage)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── New Table: GST Learning Rules ───────────────────────────────
-- User corrections that improve GST classification over time
CREATE TABLE IF NOT EXISTS gst_learning_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    description_pattern TEXT NOT NULL,
    original_gst_category TEXT,
    corrected_gst_category TEXT NOT NULL,
    correction_count INTEGER DEFAULT 1,
    confidence_boost REAL DEFAULT 0.2,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gst_learning_rules_user ON gst_learning_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_gst_learning_rules_pattern ON gst_learning_rules(description_pattern);

-- ─── New Table: Budgets ──────────────────────────────────────────
-- Per-category budget tracking (monthly, quarterly, annual)
CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
    period_start TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period_start);

-- ─── New Table: Recurring Patterns ───────────────────────────────
-- Auto-detected recurring payments and subscriptions
CREATE TABLE IF NOT EXISTS recurring_patterns (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id INTEGER,
    merchant_pattern TEXT NOT NULL,
    typical_amount_cents INTEGER NOT NULL,
    amount_variance_cents INTEGER DEFAULT 100,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'annual')),
    interval_days INTEGER,
    last_occurrence TEXT,
    next_expected TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    category TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_merchant ON recurring_patterns(merchant_pattern);
CREATE INDEX IF NOT EXISTS idx_recurring_next ON recurring_patterns(next_expected);

-- ─── New Table: Anomalies ────────────────────────────────────────
-- Detected unusual transactions or spending patterns
CREATE TABLE IF NOT EXISTS anomalies (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    transaction_id TEXT,
    anomaly_type TEXT NOT NULL,  -- 'amount', 'frequency', 'duplicate', 'new_merchant', 'time'
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    description TEXT NOT NULL,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_reason TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anomalies_user ON anomalies(user_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_dismissed ON anomalies(is_dismissed);

-- ─── New Table: Transfer Links ───────────────────────────────────
-- Cross-account transfer matches (debit in A = credit in B)
CREATE TABLE IF NOT EXISTS transfer_links (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_transaction_id TEXT NOT NULL,
    target_transaction_id TEXT NOT NULL,
    confidence REAL NOT NULL,
    match_reasons TEXT,  -- JSON array of match reasons
    is_confirmed BOOLEAN DEFAULT FALSE,
    confirmed_at TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transfer_links_user ON transfer_links(user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_links_source ON transfer_links(source_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transfer_links_target ON transfer_links(target_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transfer_links_confirmed ON transfer_links(is_confirmed);

-- ═══════════════════════════════════════════════════════════════════
-- Column Additions to Existing Tables
-- ═══════════════════════════════════════════════════════════════════

-- ─── Enhanced Transaction GST Tracking ───────────────────────────
-- These columns may already exist; using DO blocks for safety
DO $$ BEGIN
    ALTER TABLE transactions ADD COLUMN gst_confidence REAL DEFAULT 0.6;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE transactions ADD COLUMN gst_override BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE transactions ADD COLUMN gst_override_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE transactions ADD COLUMN gst_learning_rule_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── Enhanced Accounts ───────────────────────────────────────────
DO $$ BEGIN
    ALTER TABLE accounts ADD COLUMN nickname TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE accounts ADD COLUMN account_type TEXT DEFAULT 'transaction';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE accounts ADD COLUMN color TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── Enhanced BAS Periods ────────────────────────────────────────
DO $$ BEGIN
    ALTER TABLE bas_periods ADD COLUMN review_notes TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE bas_periods ADD COLUMN reviewed_by TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE bas_periods ADD COLUMN reviewed_at TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE bas_periods ADD COLUMN locked BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE bas_periods ADD COLUMN reporting_method TEXT DEFAULT 'simpler';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
