-- ============================================================================
-- 0013: PostgreSQL Schema Sync — 33 missing tables + ALTER columns + indexes
-- Syncs all SQLite tables missing from PostgreSQL
-- ALL DDL uses IF NOT EXISTS for full idempotency
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. business_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name TEXT,
    abn TEXT,
    entity_type TEXT,
    industry TEXT,
    bas_frequency TEXT,
    gst_registered BOOLEAN DEFAULT FALSE,
    financial_year_end TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_profiles_user ON business_profiles(user_id);

-- ---------------------------------------------------------------------------
-- 2. bas_periods
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bas_periods (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    financial_year TEXT,
    quarter TEXT,
    period_type TEXT,
    start_date TEXT,
    end_date TEXT,
    due_date TEXT,
    lodgement_due TEXT,
    lodgement_date TEXT,
    accounting_method TEXT,
    status TEXT,
    lodged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bas_periods_user_fy_q ON bas_periods(user_id, financial_year, quarter);

-- ---------------------------------------------------------------------------
-- 3. bas_calculations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bas_calculations (
    id TEXT PRIMARY KEY,
    bas_period_id TEXT REFERENCES bas_periods(id),
    period_id TEXT,
    label TEXT,
    value REAL,
    label_g1 REAL,
    label_g2 REAL,
    label_g3 REAL,
    label_g9 REAL,
    label_g10 REAL,
    label_g11 REAL,
    label_1a REAL,
    label_1b REAL,
    label_w1 REAL,
    label_w2 REAL,
    label_5a REAL,
    label_7c REAL,
    label_7d REAL,
    amount_owing REAL,
    refund_due REAL,
    calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bas_calculations_period ON bas_calculations(bas_period_id);
CREATE INDEX IF NOT EXISTS idx_bas_calculations_period_id ON bas_calculations(period_id);

-- ---------------------------------------------------------------------------
-- 4. tax_codes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_codes (
    id TEXT PRIMARY KEY,
    code TEXT,
    description TEXT,
    rate REAL,
    is_active BOOLEAN DEFAULT TRUE
);

-- ---------------------------------------------------------------------------
-- 5. tax_brackets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_brackets (
    id TEXT PRIMARY KEY,
    tax_year TEXT,
    financial_year TEXT,
    min_income REAL,
    max_income REAL,
    base_tax REAL,
    rate REAL
);

-- ---------------------------------------------------------------------------
-- 6. deductions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deductions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    tax_year TEXT,
    financial_year TEXT,
    category TEXT,
    subcategory TEXT,
    calculation_method TEXT,
    description TEXT,
    amount REAL,
    transaction_id TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deductions_user_year ON deductions(user_id, tax_year);

-- ---------------------------------------------------------------------------
-- 7. cgt_assets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cgt_assets (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    asset_name TEXT,
    asset_type TEXT,
    quantity REAL,
    unit_cost REAL,
    acquisition_date TEXT,
    acquisition_cost REAL,
    acquisition_costs_incidental REAL,
    improvements_cost REAL,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cgt_assets_user_status ON cgt_assets(user_id, status);

-- ---------------------------------------------------------------------------
-- 8. cgt_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cgt_events (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    asset_id TEXT REFERENCES cgt_assets(id),
    tax_year TEXT,
    event_type TEXT,
    event_date TEXT,
    disposal_date TEXT,
    disposal_proceeds REAL,
    proceeds REAL,
    cost_base REAL,
    capital_gain_loss REAL,
    capital_gain_gross REAL,
    capital_gain_net REAL,
    capital_loss REAL,
    discount_applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cgt_events_user_year ON cgt_events(user_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_cgt_events_asset ON cgt_events(asset_id);

-- ---------------------------------------------------------------------------
-- 9. depreciable_assets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS depreciable_assets (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    asset_name TEXT,
    asset_category TEXT,
    purchase_date TEXT,
    purchase_cost REAL,
    effective_life TEXT,
    effective_life_years REAL,
    depreciation_method TEXT,
    opening_value REAL,
    opening_written_down_value REAL,
    current_value REAL,
    current_written_down_value REAL,
    business_use_percentage REAL,
    is_instant_write_off BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 10. depreciation_schedule
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS depreciation_schedule (
    id TEXT PRIMARY KEY,
    asset_id TEXT REFERENCES depreciable_assets(id),
    financial_year TEXT,
    opening_value REAL,
    depreciation_amount REAL,
    closing_value REAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 11. tax_year_summary
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_year_summary (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    tax_year TEXT,
    financial_year TEXT,
    gross_income REAL,
    total_deductions REAL,
    taxable_income REAL,
    tax_payable REAL,
    medicare_levy REAL,
    tax_offsets REAL,
    net_tax REAL,
    calculated_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_year_summary_user_year ON tax_year_summary(user_id, tax_year);

-- ---------------------------------------------------------------------------
-- 12. audit_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT,
    entity_type TEXT,
    entity_id TEXT,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    user_agent TEXT,
    request_path TEXT,
    request_method TEXT,
    status_code INTEGER,
    duration_ms INTEGER,
    error_message TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- 13. sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    refresh_token_hash TEXT,
    device_fingerprint TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ---------------------------------------------------------------------------
-- 14. teams
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT,
    owner_id TEXT REFERENCES users(id),
    description TEXT,
    settings TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 15. team_members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id),
    role TEXT,
    joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 16. team_invitations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_invitations (
    id TEXT PRIMARY KEY,
    team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
    email TEXT,
    role TEXT,
    token TEXT,
    invited_by TEXT REFERENCES users(id),
    status TEXT,
    expires_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 17. subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan TEXT,
    status TEXT,
    current_period_start TEXT,
    current_period_end TEXT,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 18. export_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS export_history (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    export_type TEXT,
    format TEXT,
    parameters TEXT,
    filters TEXT,
    date_range TEXT,
    file_path TEXT,
    file_size TEXT,
    file_size_bytes INTEGER,
    record_count INTEGER,
    status TEXT,
    error_message TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 19. parser_metrics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parser_metrics (
    id TEXT PRIMARY KEY,
    statement_id TEXT,
    bank_name TEXT,
    parser_used TEXT,
    extraction_time_ms INTEGER,
    transaction_count INTEGER,
    confidence_score REAL,
    errors_count INTEGER,
    warnings_count INTEGER,
    used_vision_fallback BOOLEAN DEFAULT FALSE,
    bank_id TEXT,
    total_duration_ms INTEGER,
    parse_error_count INTEGER,
    transactions_parsed INTEGER,
    detection_confidence REAL,
    high_confidence_count INTEGER,
    low_confidence_count INTEGER,
    extraction_method TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 20. parser_accuracy_aggregates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parser_accuracy_aggregates (
    id TEXT PRIMARY KEY,
    bank_name TEXT,
    parser_version TEXT,
    period_start TEXT,
    period_end TEXT,
    total_statements INTEGER,
    successful_statements INTEGER,
    avg_confidence_score REAL,
    avg_extraction_time_ms REAL,
    vision_fallback_rate REAL,
    bank_id TEXT,
    period_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 21. parser_feedback
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parser_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    statement_id TEXT,
    transaction_id TEXT,
    feedback_type TEXT,
    original_value TEXT,
    corrected_value TEXT,
    field_name TEXT,
    notes TEXT,
    ai_confidence REAL,
    user_notes TEXT,
    status TEXT,
    bank_id TEXT,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 22. chart_of_accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    code TEXT,
    name TEXT,
    type TEXT,
    parent_id TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    account_code TEXT,
    account_name TEXT,
    account_type TEXT,
    normal_balance TEXT,
    tax_code TEXT,
    bas_label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chart_of_accounts_user_code ON chart_of_accounts(user_id, code);

-- ---------------------------------------------------------------------------
-- 23. journal_entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    entry_date TEXT,
    reference TEXT,
    description TEXT,
    transaction_id TEXT,
    is_auto BOOLEAN DEFAULT FALSE,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    posted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON journal_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_transaction ON journal_entries(transaction_id);

-- ---------------------------------------------------------------------------
-- 24. journal_entry_lines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id TEXT PRIMARY KEY,
    entry_id TEXT REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id TEXT,
    debit REAL,
    credit REAL,
    description TEXT,
    line_order INTEGER,
    journal_entry_id TEXT,
    debit_amount REAL,
    credit_amount REAL
);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON journal_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(account_id);

-- ---------------------------------------------------------------------------
-- 25. accounting_periods
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_periods (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    name TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 26. account_balances
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_balances (
    id TEXT PRIMARY KEY,
    chart_account_id TEXT REFERENCES chart_of_accounts(id),
    period_id TEXT REFERENCES accounting_periods(id),
    opening_balance REAL,
    debits REAL,
    credits REAL,
    closing_balance REAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 27. rag_namespaces
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rag_namespaces (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    name TEXT,
    description TEXT,
    chunk_count INTEGER DEFAULT 0,
    embedding_model TEXT,
    embedding_dimensions INTEGER,
    document_count INTEGER DEFAULT 0,
    last_indexed_at TIMESTAMPTZ,
    status TEXT,
    settings TEXT,
    last_updated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 28. rag_chunks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rag_chunks (
    id TEXT PRIMARY KEY,
    namespace_id TEXT REFERENCES rag_namespaces(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id),
    content TEXT,
    content_hash TEXT,
    chunk_type TEXT,
    metadata TEXT,
    embedding TEXT,
    source_id TEXT,
    source_type TEXT,
    document_id TEXT,
    category TEXT,
    account_id TEXT,
    date_start TEXT,
    date_end TEXT,
    content_tokens INTEGER,
    total_amount REAL,
    transaction_count INTEGER,
    merchant_normalized TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_namespace ON rag_chunks(namespace_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_content_hash ON rag_chunks(content_hash);

-- ---------------------------------------------------------------------------
-- 29. rag_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rag_documents (
    id TEXT PRIMARY KEY,
    namespace_id TEXT REFERENCES rag_namespaces(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id),
    title TEXT,
    source_type TEXT,
    source_id TEXT,
    version INTEGER DEFAULT 1,
    chunk_count INTEGER DEFAULT 0,
    status TEXT,
    content_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 30. rag_citations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rag_citations (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    query_id TEXT,
    chunk_id TEXT REFERENCES rag_chunks(id),
    relevance_score REAL,
    used_in_response BOOLEAN DEFAULT FALSE,
    document_id TEXT,
    rerank_score REAL,
    position INTEGER,
    excerpt_used TEXT,
    was_helpful BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 31. tax_offsets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_offsets (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    tax_year TEXT,
    offset_type TEXT,
    amount REAL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 32. capital_losses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capital_losses (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    tax_year TEXT,
    asset_description TEXT,
    acquisition_date TEXT,
    disposal_date TEXT,
    loss_amount REAL,
    applied_amount REAL DEFAULT 0,
    carried_forward REAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 33. upload_queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS upload_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    batch_id TEXT,
    filename TEXT,
    original_name TEXT,
    size INTEGER,
    mime_type TEXT,
    state TEXT,
    priority INTEGER DEFAULT 0,
    statement_id TEXT,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_upload_queue_user_state ON upload_queue(user_id, state);
CREATE INDEX IF NOT EXISTS idx_upload_queue_batch ON upload_queue(batch_id);

-- ---------------------------------------------------------------------------
-- Part B: ALTER existing tables (add missing columns)
-- ---------------------------------------------------------------------------
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ownership_tag TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gst_amount REAL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gst_category TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_hash TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS parser_version TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS extraction_hash TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_owner_contribution BOOLEAN DEFAULT FALSE;

COMMIT;
