-- Migration 0026: AI OCR Document Processing & Payment Matching
-- Adds 5 new tables for document scanning, line-item extraction,
-- intelligent payment matching with rules and a processing queue.

BEGIN;

-- ============================================================================
-- OCR DOCUMENTS (Scanned invoices, receipts, bills)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ocr_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    document_type TEXT CHECK (document_type IN (
        'invoice', 'receipt', 'bill', 'credit_note',
        'statement', 'quote', 'purchase_order', 'unknown'
    )),
    document_number TEXT,
    vendor_name TEXT,
    vendor_abn TEXT,
    document_date TEXT,
    due_date TEXT,
    subtotal REAL,
    gst_amount REAL,
    total_amount REAL,
    currency TEXT DEFAULT 'AUD',
    extracted_data TEXT,
    confidence_score REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'extracted', 'verified',
        'matched', 'failed', 'archived'
    )),
    error_message TEXT,
    processed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ocr_documents_user_status ON ocr_documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ocr_documents_vendor_date ON ocr_documents(vendor_name, document_date);

-- ============================================================================
-- OCR LINE ITEMS (Extracted line items from documents)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ocr_line_items (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES ocr_documents(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    unit_price REAL,
    amount REAL NOT NULL,
    gst_amount REAL DEFAULT 0,
    gst_inclusive INTEGER DEFAULT 1,
    category TEXT,
    account_code TEXT,
    confidence_score REAL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ocr_line_items_document ON ocr_line_items(document_id);

-- ============================================================================
-- PAYMENT MATCH RULES (User-configurable matching rules)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_match_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK (rule_type IN (
        'exact_amount', 'amount_range', 'vendor_match',
        'recurring', 'composite'
    )),
    vendor_pattern TEXT,
    amount_exact REAL,
    amount_min REAL,
    amount_max REAL,
    amount_tolerance REAL DEFAULT 0.01,
    date_tolerance_days INTEGER DEFAULT 7,
    category_filter TEXT,
    priority INTEGER DEFAULT 100,
    is_active INTEGER DEFAULT 1,
    match_count INTEGER DEFAULT 0,
    last_matched_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_match_rules_user_active ON payment_match_rules(user_id, is_active);

-- ============================================================================
-- PAYMENT MATCHES (Links between documents and transactions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_matches (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES ocr_documents(id) ON DELETE CASCADE,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    rule_id TEXT REFERENCES payment_match_rules(id) ON DELETE SET NULL,
    match_score REAL NOT NULL,
    match_method TEXT NOT NULL CHECK (match_method IN (
        'auto_rule', 'auto_ai', 'manual', 'suggested'
    )),
    amount_difference REAL DEFAULT 0,
    date_difference INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN (
        'suggested', 'confirmed', 'rejected'
    )),
    confirmed_by TEXT,
    confirmed_at TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_matches_document ON payment_matches(document_id);
CREATE INDEX IF NOT EXISTS idx_payment_matches_transaction ON payment_matches(transaction_id);

-- ============================================================================
-- DOCUMENT QUEUE (Processing queue for OCR pipeline)
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES ocr_documents(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN (
        'ocr_extract', 'classify', 'match', 'verify', 'reprocess'
    )),
    priority INTEGER DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
        'queued', 'processing', 'completed', 'failed', 'cancelled'
    )),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    scheduled_at TEXT DEFAULT CURRENT_TIMESTAMP,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_document_queue_status_priority ON document_queue(status, priority, scheduled_at);

COMMIT;
