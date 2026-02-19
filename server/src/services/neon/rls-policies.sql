-- =============================================================================
-- GoldLedger Row-Level Security (RLS) Policies
-- =============================================================================
-- Apply to Neon production DB and AI-masked branch.
-- Uses a dedicated non-superuser role so RLS is enforced (superusers bypass RLS).
--
-- Usage:
--   psql $NEON_DATABASE_URL -f rls-policies.sql
--
-- After applying, set NEON_APP_ROLE_URL in server/.env to use goldledger_app role.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Application role (non-superuser — RLS is enforced for this role)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'goldledger_app') THEN
    CREATE ROLE goldledger_app WITH LOGIN;
  END IF;
END
$$;

-- Grant connect + schema access
GRANT CONNECT ON DATABASE neondb TO goldledger_app;
GRANT USAGE ON SCHEMA public TO goldledger_app;

-- Grant DML on all current + future tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO goldledger_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO goldledger_app;

-- Grant sequence usage (needed for serial/identity columns if any)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO goldledger_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO goldledger_app;

-- ---------------------------------------------------------------------------
-- 2. Helper function — reads session-local user id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gl_current_user_id()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER  -- runs as owner (neondb_owner) so it can always read the GUC
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')
$$;

-- ---------------------------------------------------------------------------
-- 3. Macro helpers (avoid copy-paste of USING / WITH CHECK clauses)
-- ---------------------------------------------------------------------------
-- Each table gets:
--   ENABLE ROW LEVEL SECURITY      -- enables the feature
--   FORCE ROW LEVEL SECURITY       -- applies to table owner too (belt-and-suspenders)
--   POLICY … FOR ALL               -- single policy covering SELECT/INSERT/UPDATE/DELETE
--     USING (user_id = gl_current_user_id())
--     WITH CHECK (user_id = gl_current_user_id())
--
-- Tables without user_id (e.g. tax_codes, tax_brackets, tenant lookup) are NOT
-- listed here — they are public reference data or joined only through RLS-protected rows.
-- ---------------------------------------------------------------------------

-- =============================================================================
-- CORE
-- =============================================================================

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_settings_isolation ON user_settings;
CREATE POLICY user_settings_isolation ON user_settings
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sessions_isolation ON sessions;
CREATE POLICY sessions_isolation ON sessions
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_isolation ON audit_log;
CREATE POLICY audit_log_isolation ON audit_log
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- =============================================================================
-- BANKING
-- =============================================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounts_isolation ON accounts;
CREATE POLICY accounts_isolation ON accounts
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- statements.user_id is nullable (set null on delete) — allow NULL rows to superuser only
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS statements_isolation ON statements;
CREATE POLICY statements_isolation ON statements
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE transfer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transfer_links_isolation ON transfer_links;
CREATE POLICY transfer_links_isolation ON transfer_links
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE reconciliation_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_alerts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reconciliation_alerts_isolation ON reconciliation_alerts;
CREATE POLICY reconciliation_alerts_isolation ON reconciliation_alerts
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- =============================================================================
-- TRANSACTIONS
-- =============================================================================

-- transactions.user_id is nullable
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transactions_isolation ON transactions;
CREATE POLICY transactions_isolation ON transactions
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE merchant_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_memory FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS merchant_memory_isolation ON merchant_memory;
CREATE POLICY merchant_memory_isolation ON merchant_memory
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE pending_categorization ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_categorization FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pending_categorization_isolation ON pending_categorization;
CREATE POLICY pending_categorization_isolation ON pending_categorization
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- =============================================================================
-- ACCOUNTING
-- =============================================================================

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chart_of_accounts_isolation ON chart_of_accounts;
CREATE POLICY chart_of_accounts_isolation ON chart_of_accounts
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS journal_entries_isolation ON journal_entries;
CREATE POLICY journal_entries_isolation ON journal_entries
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounting_periods_isolation ON accounting_periods;
CREATE POLICY accounting_periods_isolation ON accounting_periods
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE export_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_history FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS export_history_isolation ON export_history;
CREATE POLICY export_history_isolation ON export_history
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE upload_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_queue FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS upload_queue_isolation ON upload_queue;
CREATE POLICY upload_queue_isolation ON upload_queue
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE owner_equity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_equity_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_equity_events_isolation ON owner_equity_events;
CREATE POLICY owner_equity_events_isolation ON owner_equity_events
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- =============================================================================
-- TAX
-- =============================================================================

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS business_profiles_isolation ON business_profiles;
CREATE POLICY business_profiles_isolation ON business_profiles
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE bas_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE bas_periods FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bas_periods_isolation ON bas_periods;
CREATE POLICY bas_periods_isolation ON bas_periods
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deductions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deductions_isolation ON deductions;
CREATE POLICY deductions_isolation ON deductions
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE cgt_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgt_assets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cgt_assets_isolation ON cgt_assets;
CREATE POLICY cgt_assets_isolation ON cgt_assets
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE cgt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgt_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cgt_events_isolation ON cgt_events;
CREATE POLICY cgt_events_isolation ON cgt_events
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE depreciable_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciable_assets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS depreciable_assets_isolation ON depreciable_assets;
CREATE POLICY depreciable_assets_isolation ON depreciable_assets
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE tax_year_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_year_summary FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tax_year_summary_isolation ON tax_year_summary;
CREATE POLICY tax_year_summary_isolation ON tax_year_summary
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE tax_offsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_offsets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tax_offsets_isolation ON tax_offsets;
CREATE POLICY tax_offsets_isolation ON tax_offsets
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE capital_losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_losses FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS capital_losses_isolation ON capital_losses;
CREATE POLICY capital_losses_isolation ON capital_losses
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- =============================================================================
-- INVOICING
-- =============================================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customers_isolation ON customers;
CREATE POLICY customers_isolation ON customers
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_isolation ON invoices;
CREATE POLICY invoices_isolation ON invoices
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE invoice_number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_number_sequences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_number_sequences_isolation ON invoice_number_sequences;
CREATE POLICY invoice_number_sequences_isolation ON invoice_number_sequences
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- =============================================================================
-- PAYABLES / PURCHASE ORDERS
-- =============================================================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS suppliers_isolation ON suppliers;
CREATE POLICY suppliers_isolation ON suppliers
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bills_isolation ON bills;
CREATE POLICY bills_isolation ON bills
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS purchase_orders_isolation ON purchase_orders;
CREATE POLICY purchase_orders_isolation ON purchase_orders
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE supplier_payment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payment_runs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS supplier_payment_runs_isolation ON supplier_payment_runs;
CREATE POLICY supplier_payment_runs_isolation ON supplier_payment_runs
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- =============================================================================
-- PAYROLL
-- =============================================================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employees_isolation ON employees;
CREATE POLICY employees_isolation ON employees
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE pay_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_categories FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pay_categories_isolation ON pay_categories;
CREATE POLICY pay_categories_isolation ON pay_categories
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- =============================================================================
-- REPORTING / BUDGETS
-- =============================================================================

ALTER TABLE parser_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE parser_feedback FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parser_feedback_isolation ON parser_feedback;
CREATE POLICY parser_feedback_isolation ON parser_feedback
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_snapshots FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS report_snapshots_isolation ON report_snapshots;
CREATE POLICY report_snapshots_isolation ON report_snapshots
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budgets_isolation ON budgets;
CREATE POLICY budgets_isolation ON budgets
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE forecast_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_scenarios FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forecast_scenarios_isolation ON forecast_scenarios;
CREATE POLICY forecast_scenarios_isolation ON forecast_scenarios
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE kpi_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_metrics FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kpi_metrics_isolation ON kpi_metrics;
CREATE POLICY kpi_metrics_isolation ON kpi_metrics
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_layouts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dashboard_layouts_isolation ON dashboard_layouts;
CREATE POLICY dashboard_layouts_isolation ON dashboard_layouts
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE saved_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_charts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saved_charts_isolation ON saved_charts;
CREATE POLICY saved_charts_isolation ON saved_charts
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- =============================================================================
-- ANALYTICS / INTELLIGENCE
-- =============================================================================

ALTER TABLE cash_flow_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_forecasts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_flow_forecasts_isolation ON cash_flow_forecasts;
CREATE POLICY cash_flow_forecasts_isolation ON cash_flow_forecasts
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE anomaly_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_alerts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anomaly_alerts_isolation ON anomaly_alerts;
CREATE POLICY anomaly_alerts_isolation ON anomaly_alerts
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_checks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS compliance_checks_isolation ON compliance_checks;
CREATE POLICY compliance_checks_isolation ON compliance_checks
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE compliance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_schedules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS compliance_schedules_isolation ON compliance_schedules;
CREATE POLICY compliance_schedules_isolation ON compliance_schedules
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE temporal_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporal_queries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS temporal_queries_isolation ON temporal_queries;
CREATE POLICY temporal_queries_isolation ON temporal_queries
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE cross_module_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_module_insights FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cross_module_insights_isolation ON cross_module_insights;
CREATE POLICY cross_module_insights_isolation ON cross_module_insights
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE intelligence_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_subscriptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS intelligence_subscriptions_isolation ON intelligence_subscriptions;
CREATE POLICY intelligence_subscriptions_isolation ON intelligence_subscriptions
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- =============================================================================
-- DOCUMENTS / MATCHING
-- =============================================================================

ALTER TABLE ocr_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_documents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ocr_documents_isolation ON ocr_documents;
CREATE POLICY ocr_documents_isolation ON ocr_documents
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE document_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_queue FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS document_queue_isolation ON document_queue;
CREATE POLICY document_queue_isolation ON document_queue
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE payment_match_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_match_rules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_match_rules_isolation ON payment_match_rules;
CREATE POLICY payment_match_rules_isolation ON payment_match_rules
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- =============================================================================
-- COGNEE / AI / RAG
-- =============================================================================

ALTER TABLE cognee_user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognee_user_accounts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cognee_user_accounts_isolation ON cognee_user_accounts;
CREATE POLICY cognee_user_accounts_isolation ON cognee_user_accounts
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE cognee_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognee_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cognee_sessions_isolation ON cognee_sessions;
CREATE POLICY cognee_sessions_isolation ON cognee_sessions
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE datapoint_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE datapoint_configs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS datapoint_configs_isolation ON datapoint_configs;
CREATE POLICY datapoint_configs_isolation ON datapoint_configs
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE graph_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_schemas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS graph_schemas_isolation ON graph_schemas;
CREATE POLICY graph_schemas_isolation ON graph_schemas
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE cognee_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognee_feedback FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cognee_feedback_isolation ON cognee_feedback;
CREATE POLICY cognee_feedback_isolation ON cognee_feedback
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE rag_namespaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_namespaces FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rag_namespaces_isolation ON rag_namespaces;
CREATE POLICY rag_namespaces_isolation ON rag_namespaces
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_documents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rag_documents_isolation ON rag_documents;
CREATE POLICY rag_documents_isolation ON rag_documents
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rag_chunks_isolation ON rag_chunks;
CREATE POLICY rag_chunks_isolation ON rag_chunks
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE rag_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_citations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rag_citations_isolation ON rag_citations;
CREATE POLICY rag_citations_isolation ON rag_citations
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- =============================================================================
-- AGENTS
-- =============================================================================

ALTER TABLE agent_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_audit_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_audit_log_isolation ON agent_audit_log;
CREATE POLICY agent_audit_log_isolation ON agent_audit_log
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_sessions_isolation ON agent_sessions;
CREATE POLICY agent_sessions_isolation ON agent_sessions
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- =============================================================================
-- MULTI-TENANT
-- =============================================================================

-- subscriptions: user-scoped (user_id column)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscriptions_isolation ON subscriptions;
CREATE POLICY subscriptions_isolation ON subscriptions
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- =============================================================================
-- PWA / NOTIFICATIONS
-- =============================================================================

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_isolation ON push_subscriptions;
CREATE POLICY push_subscriptions_isolation ON push_subscriptions
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_preferences_isolation ON notification_preferences;
CREATE POLICY notification_preferences_isolation ON notification_preferences
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

ALTER TABLE offline_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_sync_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS offline_sync_log_isolation ON offline_sync_log;
CREATE POLICY offline_sync_log_isolation ON offline_sync_log
  AS PERMISSIVE FOR ALL TO goldledger_app
  USING (user_id = gl_current_user_id())
  WITH CHECK (user_id = gl_current_user_id());

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================
-- Run after applying to confirm all policies are in place:
--
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND policyname LIKE '%_isolation'
-- ORDER BY tablename;
--
-- Expected: 65 rows (one per table listed above)
-- =============================================================================
