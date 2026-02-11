-- ============================================================================
-- 0007: Create all missing tables from schema.ts
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  abn TEXT,
  entity_type TEXT NOT NULL DEFAULT 'sole_trader',
  industry TEXT,
  bas_frequency TEXT DEFAULT 'quarterly',
  gst_registered BOOLEAN DEFAULT false,
  financial_year_end TEXT DEFAULT '06-30',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bas_periods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  financial_year TEXT NOT NULL,
  quarter INTEGER NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'quarterly',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  due_date TEXT,
  lodgement_due TEXT,
  lodgement_date TEXT,
  accounting_method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'draft',
  lodged_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bas_calculations (
  id TEXT PRIMARY KEY,
  bas_period_id TEXT NOT NULL REFERENCES bas_periods(id) ON DELETE CASCADE,
  period_id TEXT REFERENCES bas_periods(id) ON DELETE CASCADE,
  label TEXT,
  value INTEGER DEFAULT 0,
  label_g1 INTEGER DEFAULT 0,
  label_g2 INTEGER DEFAULT 0,
  label_g3 INTEGER DEFAULT 0,
  label_g10 INTEGER DEFAULT 0,
  label_g11 INTEGER DEFAULT 0,
  label_1a INTEGER DEFAULT 0,
  label_1b INTEGER DEFAULT 0,
  label_w1 INTEGER DEFAULT 0,
  label_w2 INTEGER DEFAULT 0,
  label_5a INTEGER DEFAULT 0,
  label_7c INTEGER DEFAULT 0,
  label_7d INTEGER DEFAULT 0,
  amount_owing INTEGER DEFAULT 0,
  refund_due INTEGER DEFAULT 0,
  calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tax_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  rate REAL NOT NULL,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS tax_brackets (
  id TEXT PRIMARY KEY,
  tax_year TEXT NOT NULL,
  financial_year TEXT,
  min_income INTEGER NOT NULL,
  max_income INTEGER,
  base_tax INTEGER NOT NULL DEFAULT 0,
  rate REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS deductions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tax_year TEXT NOT NULL,
  financial_year TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  calculation_method TEXT,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  transaction_id TEXT REFERENCES transactions(id),
  is_verified BOOLEAN DEFAULT false,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cgt_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  quantity REAL DEFAULT 1,
  unit_cost INTEGER,
  acquisition_date TEXT NOT NULL,
  acquisition_cost INTEGER NOT NULL,
  acquisition_costs_incidental INTEGER DEFAULT 0,
  improvements_cost INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'held',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cgt_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES cgt_assets(id) ON DELETE CASCADE,
  tax_year TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  disposal_date TEXT,
  disposal_proceeds INTEGER,
  proceeds INTEGER,
  cost_base INTEGER,
  capital_gain_loss INTEGER,
  capital_gain_gross INTEGER,
  capital_gain_net INTEGER,
  capital_loss INTEGER,
  discount_applied BOOLEAN DEFAULT false,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS depreciable_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_name TEXT NOT NULL,
  asset_category TEXT NOT NULL,
  purchase_date TEXT NOT NULL,
  purchase_cost INTEGER NOT NULL,
  effective_life INTEGER NOT NULL,
  effective_life_years INTEGER,
  depreciation_method TEXT NOT NULL DEFAULT 'diminishing',
  opening_value INTEGER NOT NULL,
  opening_written_down_value INTEGER,
  current_value INTEGER NOT NULL,
  current_written_down_value INTEGER,
  business_use_percentage REAL DEFAULT 100,
  is_instant_write_off BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS depreciation_schedule (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES depreciable_assets(id) ON DELETE CASCADE,
  financial_year TEXT NOT NULL,
  opening_value INTEGER NOT NULL,
  depreciation_amount INTEGER NOT NULL,
  closing_value INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tax_year_summary (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tax_year TEXT NOT NULL,
  financial_year TEXT,
  gross_income INTEGER DEFAULT 0,
  total_deductions INTEGER DEFAULT 0,
  taxable_income INTEGER DEFAULT 0,
  tax_payable INTEGER DEFAULT 0,
  medicare_levy INTEGER DEFAULT 0,
  tax_offsets INTEGER DEFAULT 0,
  net_tax INTEGER DEFAULT 0,
  calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
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
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  device_fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_invitations (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  token TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS export_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL,
  format TEXT NOT NULL,
  parameters TEXT,
  filters TEXT,
  date_range TEXT,
  file_path TEXT,
  file_size INTEGER,
  file_size_bytes INTEGER,
  record_count INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS parser_metrics (
  id TEXT PRIMARY KEY,
  statement_id TEXT REFERENCES statements(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  parser_used TEXT NOT NULL,
  extraction_time_ms INTEGER,
  transaction_count INTEGER,
  confidence_score REAL,
  errors_count INTEGER DEFAULT 0,
  warnings_count INTEGER DEFAULT 0,
  used_vision_fallback BOOLEAN DEFAULT false,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parser_accuracy_aggregates (
  id TEXT PRIMARY KEY,
  bank_name TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_statements INTEGER NOT NULL DEFAULT 0,
  successful_statements INTEGER NOT NULL DEFAULT 0,
  avg_confidence_score REAL,
  avg_extraction_time_ms REAL,
  vision_fallback_rate REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parser_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  statement_id TEXT REFERENCES statements(id) ON DELETE SET NULL,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL,
  original_value TEXT,
  corrected_value TEXT,
  field_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id TEXT,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  reference TEXT,
  description TEXT NOT NULL,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  is_auto BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  posted_at TEXT
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES chart_of_accounts(id),
  debit INTEGER DEFAULT 0,
  credit INTEGER DEFAULT 0,
  description TEXT,
  line_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS accounting_periods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account_balances (
  id TEXT PRIMARY KEY,
  chart_account_id TEXT NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES accounting_periods(id) ON DELETE CASCADE,
  opening_balance INTEGER NOT NULL DEFAULT 0,
  debits INTEGER NOT NULL DEFAULT 0,
  credits INTEGER NOT NULL DEFAULT 0,
  closing_balance INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rag_namespaces (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  chunk_count INTEGER DEFAULT 0,
  last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rag_chunks (
  id TEXT PRIMARY KEY,
  namespace_id TEXT NOT NULL REFERENCES rag_namespaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  chunk_type TEXT NOT NULL,
  metadata TEXT,
  embedding TEXT,
  source_id TEXT,
  source_type TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rag_documents (
  id TEXT PRIMARY KEY,
  namespace_id TEXT NOT NULL REFERENCES rag_namespaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  chunk_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'indexed',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rag_citations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL REFERENCES rag_chunks(id) ON DELETE CASCADE,
  relevance_score REAL,
  used_in_response BOOLEAN DEFAULT false,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS upload_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  statement_id TEXT REFERENCES statements(id),
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_profiles_user ON business_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_bas_periods_user ON bas_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_bas_calculations_period ON bas_calculations(bas_period_id);
CREATE INDEX IF NOT EXISTS idx_deductions_user ON deductions(user_id);
CREATE INDEX IF NOT EXISTS idx_cgt_assets_user ON cgt_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_cgt_events_asset ON cgt_events(asset_id);
CREATE INDEX IF NOT EXISTS idx_depreciable_assets_user ON depreciable_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_depreciation_schedule_asset ON depreciation_schedule(asset_id);
CREATE INDEX IF NOT EXISTS idx_tax_year_summary_user ON tax_year_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_export_history_user ON export_history(user_id);
CREATE INDEX IF NOT EXISTS idx_parser_metrics_statement ON parser_metrics(statement_id);
CREATE INDEX IF NOT EXISTS idx_parser_feedback_user ON parser_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_user ON chart_of_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON journal_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_user ON accounting_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_period ON account_balances(period_id);
CREATE INDEX IF NOT EXISTS idx_rag_namespaces_user ON rag_namespaces(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_namespace ON rag_chunks(namespace_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_namespace ON rag_documents(namespace_id);
CREATE INDEX IF NOT EXISTS idx_upload_queue_user ON upload_queue(user_id);
