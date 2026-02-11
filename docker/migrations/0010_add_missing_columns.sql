-- Migration 0010: Add missing columns to existing tables + new tables
-- Matches schema.ts updates for TypeScript compilation

-- 1. parser_metrics - additional tracking columns
ALTER TABLE parser_metrics ADD COLUMN IF NOT EXISTS bank_id TEXT;
ALTER TABLE parser_metrics ADD COLUMN IF NOT EXISTS total_duration_ms INTEGER;
ALTER TABLE parser_metrics ADD COLUMN IF NOT EXISTS parse_error_count INTEGER;
ALTER TABLE parser_metrics ADD COLUMN IF NOT EXISTS transactions_parsed INTEGER;
ALTER TABLE parser_metrics ADD COLUMN IF NOT EXISTS detection_confidence REAL;
ALTER TABLE parser_metrics ADD COLUMN IF NOT EXISTS high_confidence_count INTEGER;
ALTER TABLE parser_metrics ADD COLUMN IF NOT EXISTS low_confidence_count INTEGER;
ALTER TABLE parser_metrics ADD COLUMN IF NOT EXISTS extraction_method TEXT;

-- 2. parser_accuracy_aggregates - grouping columns
ALTER TABLE parser_accuracy_aggregates ADD COLUMN IF NOT EXISTS bank_id TEXT;
ALTER TABLE parser_accuracy_aggregates ADD COLUMN IF NOT EXISTS period_type TEXT;

-- 3. chart_of_accounts - alias columns for ledger service
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS account_code TEXT;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS account_type TEXT;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS normal_balance TEXT;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS tax_code TEXT;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS bas_label TEXT;

-- 4. journal_entry_lines - additional references
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS journal_entry_id TEXT;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS debit_amount INTEGER;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS credit_amount INTEGER;

-- 5. parser_feedback - bank tracking and review
ALTER TABLE parser_feedback ADD COLUMN IF NOT EXISTS bank_id TEXT;
ALTER TABLE parser_feedback ADD COLUMN IF NOT EXISTS reviewed_at TEXT;

-- 6. teams - description and settings
ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS settings TEXT;

-- 7. team_invitations - acceptance tracking
ALTER TABLE team_invitations ADD COLUMN IF NOT EXISTS accepted_at TEXT;

-- 8. rag_citations - enhanced citation tracking
ALTER TABLE rag_citations ADD COLUMN IF NOT EXISTS document_id TEXT;
ALTER TABLE rag_citations ADD COLUMN IF NOT EXISTS rerank_score REAL;
ALTER TABLE rag_citations ADD COLUMN IF NOT EXISTS position INTEGER;
ALTER TABLE rag_citations ADD COLUMN IF NOT EXISTS excerpt_used TEXT;
ALTER TABLE rag_citations ADD COLUMN IF NOT EXISTS was_helpful BOOLEAN;

-- 9. rag_chunks - financial metadata
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS document_id TEXT;
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS date_start TEXT;
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS date_end TEXT;
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS content_tokens INTEGER;
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS total_amount INTEGER;
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS transaction_count INTEGER;
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS merchant_normalized TEXT;

-- 10. rag_namespaces - embedding and status tracking
ALTER TABLE rag_namespaces ADD COLUMN IF NOT EXISTS embedding_model TEXT;
ALTER TABLE rag_namespaces ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER;
ALTER TABLE rag_namespaces ADD COLUMN IF NOT EXISTS document_count INTEGER;
ALTER TABLE rag_namespaces ADD COLUMN IF NOT EXISTS last_indexed_at TEXT;
ALTER TABLE rag_namespaces ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE rag_namespaces ADD COLUMN IF NOT EXISTS settings TEXT;

-- 11. rag_documents - deduplication hash
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- 12. New tables: tax_offsets and capital_losses
CREATE TABLE IF NOT EXISTS tax_offsets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tax_year TEXT NOT NULL,
    offset_type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS capital_losses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tax_year TEXT NOT NULL,
    asset_description TEXT NOT NULL,
    acquisition_date TEXT,
    disposal_date TEXT,
    loss_amount INTEGER NOT NULL,
    applied_amount INTEGER,
    carried_forward BOOLEAN,
    created_at TEXT NOT NULL
);
