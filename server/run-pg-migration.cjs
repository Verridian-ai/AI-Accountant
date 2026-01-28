const { Pool } = require('pg');

const pool = new Pool({
    host: '35.189.25.241',
    port: 5432,
    database: 'ai_accountant',
    user: 'app_user',
    password: 'p9qlWBwrA37w4Oa4kMD0lxpT',
    ssl: { rejectUnauthorized: false }
});

const createTables = `
-- Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- User Settings
CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    model_parsing_text TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
    model_parsing_vision TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
    model_categorization TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
    model_chat TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
    model_embedding TEXT NOT NULL DEFAULT 'openai/text-embedding-3-large'
);

-- Accounts
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_number TEXT NOT NULL,
    account_number_hash TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    bank_name TEXT,
    current_balance INTEGER DEFAULT 0,
    last_statement_date TEXT,
    interest_rate REAL,
    credit_limit INTEGER,
    minimum_payment INTEGER,
    payment_due_day INTEGER,
    linked_payment_account_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Statements
CREATE TABLE IF NOT EXISTS statements (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    upload_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    parsing_status TEXT NOT NULL DEFAULT 'PENDING',
    ai_model_used TEXT,
    error_message TEXT,
    error_type TEXT,
    error_details TEXT,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    period_start_date TEXT,
    period_end_date TEXT,
    opening_balance INTEGER,
    closing_balance INTEGER,
    transaction_count INTEGER DEFAULT 0,
    is_complete BOOLEAN DEFAULT TRUE,
    validation_errors TEXT
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance INTEGER,
    category TEXT,
    gst_applicable BOOLEAN DEFAULT FALSE,
    ai_reasoning_notes TEXT,
    confidence_score REAL DEFAULT 1.0,
    is_edited BOOLEAN DEFAULT FALSE,
    is_transfer BOOLEAN DEFAULT FALSE,
    transfer_link_id TEXT,
    merchant_normalized TEXT,
    parent_transaction_id TEXT,
    statement_id TEXT REFERENCES statements(id) ON DELETE SET NULL,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- Merchant Memory
CREATE TABLE IF NOT EXISTS merchant_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    merchant_pattern TEXT NOT NULL,
    merchant_display_name TEXT,
    category TEXT NOT NULL,
    gst_applicable BOOLEAN DEFAULT FALSE,
    times_used INTEGER DEFAULT 1,
    last_used TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    is_user_confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Pending Categorization
CREATE TABLE IF NOT EXISTS pending_categorization (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    suggested_category TEXT,
    suggested_confidence REAL,
    ai_reasoning TEXT,
    alternative_categories TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    user_selected_category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    resolved_at TIMESTAMPTZ
);

-- Transfer Links
CREATE TABLE IF NOT EXISTS transfer_links (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    destination_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    source_account_id TEXT REFERENCES accounts(id),
    destination_account_id TEXT REFERENCES accounts(id),
    amount INTEGER NOT NULL,
    transfer_date TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    is_user_confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Transaction History
CREATE TABLE IF NOT EXISTS transaction_history (
    id TEXT PRIMARY KEY,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    change_type TEXT NOT NULL,
    old_data TEXT,
    new_data TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Account Balance History
CREATE TABLE IF NOT EXISTS account_balance_history (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL,
    balance_date TEXT NOT NULL,
    source TEXT NOT NULL,
    statement_id TEXT REFERENCES statements(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Reconciliation Alerts
CREATE TABLE IF NOT EXISTS reconciliation_alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    expected_value INTEGER,
    actual_value INTEGER,
    difference INTEGER,
    description TEXT NOT NULL,
    statement_id TEXT REFERENCES statements(id),
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Statement Accounts (link table)
CREATE TABLE IF NOT EXISTS statement_accounts (
    statement_id TEXT PRIMARY KEY REFERENCES statements(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE
);

-- Business Profiles
CREATE TABLE IF NOT EXISTS business_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name TEXT,
    abn TEXT,
    industry TEXT,
    entity_type TEXT,
    financial_year_end TEXT,
    is_gst_registered BOOLEAN DEFAULT FALSE,
    bas_frequency TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON accounts(user_id);
CREATE INDEX IF NOT EXISTS statements_user_id_idx ON statements(user_id);
CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON transactions(user_id);
CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(date);
CREATE INDEX IF NOT EXISTS transactions_statement_id_idx ON transactions(statement_id);
`;

async function main() {
    console.log('Connecting to Cloud SQL...');
    try {
        const client = await pool.connect();
        console.log('Connected! Running migrations...');
        await client.query(createTables);
        console.log('Tables created successfully!');

        // Check what tables exist
        const result = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
        console.log('Tables in database:', result.rows.map(r => r.tablename));

        client.release();
        await pool.end();
        console.log('Done!');
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

main();
