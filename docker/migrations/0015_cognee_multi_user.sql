-- ============================================================================
-- 0015: Cognee Multi-User — per-user Cognee accounts + session tracking
-- ============================================================================

-- ---------------------------------------------------------------------------
-- cognee_user_accounts: One-to-one mapping between app users and Cognee accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cognee_user_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cognee_email TEXT NOT NULL,
    cognee_refresh_token TEXT,  -- AES-256-GCM encrypted Cognee refresh token (NOT password per D02 CRIT-03)
    cognee_user_id TEXT,        -- Cognee's internal user ID, populated after registration
    dataset_prefix TEXT NOT NULL, -- e.g. 'user_abc123' — prefixes all dataset names
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cognee_user_accounts_user_id ON cognee_user_accounts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cognee_user_accounts_email ON cognee_user_accounts(cognee_email);

-- ---------------------------------------------------------------------------
-- cognee_sessions: Track per-user Cognee interaction sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cognee_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_type TEXT NOT NULL DEFAULT 'chat',  -- 'chat', 'analysis', 'batch'
    cognee_session_id TEXT,                      -- Cognee's internal session ID if applicable
    state TEXT NOT NULL DEFAULT 'active',        -- 'active', 'paused', 'expired'
    context_data TEXT,                           -- JSON: conversation history, active filters, last query
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL              -- default: created_at + 30 minutes
);

CREATE INDEX IF NOT EXISTS idx_cognee_sessions_user_state ON cognee_sessions(user_id, state);
CREATE INDEX IF NOT EXISTS idx_cognee_sessions_expires ON cognee_sessions(expires_at);
