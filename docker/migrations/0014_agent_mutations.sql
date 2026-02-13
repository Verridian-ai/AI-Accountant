BEGIN;

-- ============================================================
-- Migration 0014: Agent Mutations & Streaming
-- Wave 2 — Transaction Mutation & Streaming
-- ============================================================

-- 1. Agent Sessions — Groups related agent interactions
CREATE TABLE IF NOT EXISTS agent_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'active',
    context TEXT,
    total_mutations INTEGER NOT NULL DEFAULT 0,
    confirmed_mutations INTEGER NOT NULL DEFAULT 0,
    rejected_mutations INTEGER NOT NULL DEFAULT 0,
    query_count INTEGER NOT NULL DEFAULT 0,
    agent_types_used TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_last_activity ON agent_sessions(last_activity_at);

-- 2. Agent Mutations — Tracks proposed/confirmed/executed DB changes
CREATE TABLE IF NOT EXISTS agent_mutations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES agent_sessions(id),
    agent_type TEXT NOT NULL,
    mutation_type TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_id TEXT,
    target_ids TEXT,
    before_state TEXT,
    after_state TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed',
    confidence REAL,
    requires_confirmation BOOLEAN NOT NULL DEFAULT true,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    executed_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    error_message TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_mutations_session ON agent_mutations(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_mutations_status ON agent_mutations(status);
CREATE INDEX IF NOT EXISTS idx_agent_mutations_agent ON agent_mutations(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_mutations_target ON agent_mutations(target_table);
CREATE INDEX IF NOT EXISTS idx_agent_mutations_created ON agent_mutations(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_mutations_expiry ON agent_mutations(status, expires_at);

-- 3. Agent Audit Log — Immutable audit trail
CREATE TABLE IF NOT EXISTS agent_audit_log (
    id TEXT PRIMARY KEY,
    mutation_id TEXT REFERENCES agent_mutations(id),
    session_id TEXT REFERENCES agent_sessions(id),
    agent_type TEXT NOT NULL,
    action TEXT NOT NULL,
    target_table TEXT,
    target_id TEXT,
    before_state TEXT,
    after_state TEXT,
    metadata TEXT,
    user_id TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_mutation ON agent_audit_log(mutation_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_session ON agent_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_agent ON agent_audit_log(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_audit_action ON agent_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_agent_audit_created ON agent_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_audit_target ON agent_audit_log(target_table);

COMMIT;
