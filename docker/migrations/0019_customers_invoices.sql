-- ============================================================================
-- 0019: Customer Management & Invoice Generation (Wave 7)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- customers: Customer/client records for invoicing
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    postcode TEXT,
    country TEXT NOT NULL DEFAULT 'AU',
    abn TEXT,
    payment_terms_days INTEGER NOT NULL DEFAULT 30,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_user_active ON customers(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customers_user_abn ON customers(user_id, abn) WHERE abn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_user_email ON customers(user_id, email) WHERE email IS NOT NULL;

-- ---------------------------------------------------------------------------
-- customer_contacts: Multiple contacts per customer
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_contacts (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON customer_contacts(customer_id);

-- ---------------------------------------------------------------------------
-- invoices: Tax invoices, credit notes, receipts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    invoice_number TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT 'tax_invoice',
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
    terms_and_conditions TEXT,
    pdf_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_user_status ON invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- ---------------------------------------------------------------------------
-- invoice_lines: Line items on invoices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_lines (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price INTEGER NOT NULL DEFAULT 0,
    amount INTEGER NOT NULL DEFAULT 0,
    gst_rate REAL NOT NULL DEFAULT 0.1,
    gst_amount INTEGER NOT NULL DEFAULT 0,
    account_code TEXT,
    tax_code TEXT
);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);

-- ---------------------------------------------------------------------------
-- invoice_number_sequences: Auto-incrementing invoice number per user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_number_sequences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prefix TEXT NOT NULL DEFAULT 'INV-',
    next_number INTEGER NOT NULL DEFAULT 1,
    format TEXT NOT NULL DEFAULT '{prefix}{number:06d}'
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_sequences_user ON invoice_number_sequences(user_id);

-- ---------------------------------------------------------------------------
-- invoice_payments: Payment records against invoices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_payments (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_date TEXT NOT NULL,
    amount INTEGER NOT NULL,
    payment_method TEXT,
    reference TEXT,
    transaction_id TEXT REFERENCES transactions(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_transaction ON invoice_payments(transaction_id) WHERE transaction_id IS NOT NULL;

COMMIT;
