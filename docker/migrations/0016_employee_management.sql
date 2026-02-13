-- ============================================================================
-- 0016: Employee Management — 7 tables for employee/payroll management
-- ============================================================================

-- ---------------------------------------------------------------------------
-- employees: Core employee records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    date_of_birth TEXT,
    address TEXT, -- JSON: { street, city, state, postcode, country }
    tax_file_number TEXT, -- AES-256-GCM encrypted ciphertext
    start_date TEXT NOT NULL,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'terminated', 'on_leave')),
    employment_type TEXT NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'casual', 'contractor')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employees_user_status ON employees(user_id, status);
CREATE INDEX IF NOT EXISTS idx_employees_user_name ON employees(user_id, last_name, first_name);

-- ---------------------------------------------------------------------------
-- employee_bank_details: Bank account details for pay deposits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_bank_details (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    bsb TEXT NOT NULL, -- AES-256-GCM encrypted ciphertext
    account_number TEXT NOT NULL, -- AES-256-GCM encrypted ciphertext
    account_name TEXT NOT NULL,
    split_percentage REAL NOT NULL DEFAULT 100.0,
    is_primary BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employee_bank_details_employee ON employee_bank_details(employee_id);

-- ---------------------------------------------------------------------------
-- employee_super_funds: Superannuation fund details
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_super_funds (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    fund_name TEXT NOT NULL,
    fund_abn TEXT, -- 11-digit Australian Business Number
    usi TEXT, -- Unique Superannuation Identifier
    member_number TEXT,
    contribution_rate REAL NOT NULL DEFAULT 11.5, -- 11.5% for FY2025-26
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employee_super_funds_employee ON employee_super_funds(employee_id);

-- ---------------------------------------------------------------------------
-- employee_tax_declarations: Tax withholding declarations (TFN dec equivalent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_tax_declarations (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    tax_free_threshold BOOLEAN DEFAULT true,
    help_debt BOOLEAN DEFAULT false,
    sfss_debt BOOLEAN DEFAULT false,
    claim_dependents INTEGER DEFAULT 0,
    tax_offset_estimated INTEGER DEFAULT 0, -- cents
    effective_date TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employee_tax_declarations_employee_date ON employee_tax_declarations(employee_id, effective_date DESC);

-- ---------------------------------------------------------------------------
-- pay_categories: Pay types (ordinary, overtime, allowances, deductions, super, leave)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pay_categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ordinary', 'overtime', 'allowance', 'deduction', 'super', 'leave')),
    rate_type TEXT NOT NULL DEFAULT 'hourly' CHECK (rate_type IN ('hourly', 'annual', 'fixed')),
    default_rate INTEGER DEFAULT 0, -- cents
    multiplier REAL DEFAULT 1.0,
    is_taxable BOOLEAN DEFAULT true,
    is_super_bearing BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pay_categories_user_type ON pay_categories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_pay_categories_user_active ON pay_categories(user_id, is_active);

-- ---------------------------------------------------------------------------
-- pay_structures: Links employees to pay categories with specific rates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pay_structures (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    pay_category_id TEXT NOT NULL REFERENCES pay_categories(id),
    rate INTEGER NOT NULL, -- cents
    hours_per_week REAL,
    annual_salary INTEGER, -- cents
    effective_date TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pay_structures_employee_date ON pay_structures(employee_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_pay_structures_pay_category ON pay_structures(pay_category_id);

-- ---------------------------------------------------------------------------
-- employee_documents: Uploaded documents (TFN dec, super choice, contracts, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_documents (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('tfn_declaration', 'super_choice', 'contract', 'id', 'visa', 'other')),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER, -- bytes
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_type ON employee_documents(employee_id, document_type);
