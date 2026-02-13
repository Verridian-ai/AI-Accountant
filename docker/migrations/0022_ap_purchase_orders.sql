-- Migration 0022: Accounts Payable & Purchase Orders (Wave 10)
-- Adds 10 tables for AP workflow: suppliers, bills, POs, receipts, payment runs
-- IDEMPOTENT: Safe to run multiple times (CREATE TABLE/INDEX IF NOT EXISTS)

BEGIN;

-- 1. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    abn TEXT,
    payment_terms_days INTEGER NOT NULL DEFAULT 30,
    bank_bsb TEXT,
    bank_account_number TEXT,
    bank_account_name TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_user_active ON suppliers(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_abn ON suppliers(user_id, abn) WHERE abn IS NOT NULL;

-- 2. Bills
CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id),
    bill_number TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    subtotal INTEGER NOT NULL DEFAULT 0,
    gst_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    amount_paid INTEGER NOT NULL DEFAULT 0,
    amount_due INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'AUD',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bills_user_status ON bills(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_supplier ON bills(supplier_id);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills(due_date);

-- 3. Bill Lines
CREATE TABLE IF NOT EXISTS bill_lines (
    id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price INTEGER NOT NULL DEFAULT 0,
    amount INTEGER NOT NULL DEFAULT 0,
    gst_rate REAL DEFAULT 0.1,
    gst_amount INTEGER DEFAULT 0,
    account_code TEXT,
    tax_code TEXT
);

CREATE INDEX IF NOT EXISTS idx_bill_lines_bill ON bill_lines(bill_id);

-- 4. Bill Payments
CREATE TABLE IF NOT EXISTS bill_payments (
    id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL REFERENCES bills(id),
    payment_date TEXT NOT NULL,
    amount INTEGER NOT NULL,
    payment_method TEXT,
    reference TEXT,
    transaction_id TEXT REFERENCES transactions(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_payments_bill ON bill_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_transaction ON bill_payments(transaction_id) WHERE transaction_id IS NOT NULL;

-- 5. Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id),
    po_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft',
    issue_date TEXT NOT NULL,
    expected_date TEXT,
    subtotal INTEGER NOT NULL DEFAULT 0,
    gst_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_status ON purchase_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);

-- 6. PO Lines
CREATE TABLE IF NOT EXISTS po_lines (
    id TEXT PRIMARY KEY,
    purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price INTEGER NOT NULL DEFAULT 0,
    amount INTEGER NOT NULL DEFAULT 0,
    quantity_received REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_po_lines_purchase_order ON po_lines(purchase_order_id);

-- 7. PO Receipts
CREATE TABLE IF NOT EXISTS po_receipts (
    id TEXT PRIMARY KEY,
    purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id),
    receipt_date TEXT NOT NULL,
    received_by TEXT REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_receipts_purchase_order ON po_receipts(purchase_order_id);

-- 8. PO Receipt Lines (CRITICAL for three-way matching JOINs)
CREATE TABLE IF NOT EXISTS po_receipt_lines (
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL REFERENCES po_receipts(id) ON DELETE CASCADE,
    po_line_id TEXT NOT NULL REFERENCES po_lines(id),
    quantity_received REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_po_receipt_lines_receipt ON po_receipt_lines(receipt_id);
CREATE INDEX IF NOT EXISTS idx_po_receipt_lines_po_line ON po_receipt_lines(po_line_id);

-- 9. Supplier Payment Runs
CREATE TABLE IF NOT EXISTS supplier_payment_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    total_amount INTEGER NOT NULL DEFAULT 0,
    bank_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_payment_runs_user_status ON supplier_payment_runs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_supplier_payment_runs_date ON supplier_payment_runs(payment_date);

-- 10. Supplier Payment Run Items
CREATE TABLE IF NOT EXISTS supplier_payment_run_items (
    id TEXT PRIMARY KEY,
    payment_run_id TEXT NOT NULL REFERENCES supplier_payment_runs(id) ON DELETE CASCADE,
    bill_id TEXT NOT NULL REFERENCES bills(id),
    amount INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_supplier_payment_run_items_run ON supplier_payment_run_items(payment_run_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payment_run_items_bill ON supplier_payment_run_items(bill_id);

COMMIT;
