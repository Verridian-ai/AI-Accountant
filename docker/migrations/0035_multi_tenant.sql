-- Migration 0035: Multi-Tenant Architecture
-- Wave 23: Tenants, members, invitations, RBAC permissions, subscription plans, API rate limits
-- Created: 2026-02-13

-- tenants: Organization/workspace entities
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE, -- URL-safe identifier: my-company
    logo_url TEXT,
    primary_contact_email TEXT,
    abn TEXT, -- Australian Business Number
    entity_type TEXT, -- sole_trader, company, trust, partnership, smsf
    industry TEXT,
    financial_year_end TEXT DEFAULT '06-30', -- MM-DD format
    timezone TEXT DEFAULT 'Australia/Sydney',
    settings_json JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- tenant_members: Users belonging to tenants with roles
CREATE TABLE IF NOT EXISTS tenant_members (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer', -- owner, admin, accountant, bookkeeper, viewer
    display_name TEXT,
    is_primary_contact BOOLEAN NOT NULL DEFAULT false,
    invited_by TEXT REFERENCES users(id),
    joined_at TIMESTAMP DEFAULT NOW(),
    last_active_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- tenant_invitations: Pending invitations to join a tenant
CREATE TABLE IF NOT EXISTS tenant_invitations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    invited_by TEXT NOT NULL REFERENCES users(id),
    token TEXT NOT NULL UNIQUE, -- Secure invitation token
    status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, expired, revoked
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- permissions: Granular permission definitions
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL UNIQUE, -- e.g. 'transactions.read', 'bas.submit', 'reports.export'
    description TEXT,
    resource TEXT NOT NULL, -- transactions, accounts, bas, tax, reports, settings, members
    action TEXT NOT NULL, -- read, write, delete, submit, export, manage
    is_system BOOLEAN NOT NULL DEFAULT false, -- System permissions cannot be modified
    created_at TIMESTAMP DEFAULT NOW()
);

-- role_permissions: Mapping roles to permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_by TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, role, permission_id)
);

-- subscription_plans: Available subscription tiers
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL UNIQUE, -- free, starter, professional, enterprise
    display_name TEXT NOT NULL,
    description TEXT,
    price_monthly_cents INTEGER NOT NULL DEFAULT 0,
    price_annual_cents INTEGER NOT NULL DEFAULT 0,
    max_members INTEGER NOT NULL DEFAULT 1,
    max_accounts INTEGER NOT NULL DEFAULT 2,
    max_transactions_per_month INTEGER NOT NULL DEFAULT 500,
    max_ai_queries_per_month INTEGER NOT NULL DEFAULT 50,
    max_storage_mb INTEGER NOT NULL DEFAULT 100,
    features_json JSONB DEFAULT '[]', -- Array of feature flags: ['bas_lodgement', 'multi_entity', 'api_access']
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- subscription_history: Tenant subscription records
CREATE TABLE IF NOT EXISTS subscription_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
    status TEXT NOT NULL DEFAULT 'active', -- active, cancelled, expired, trialing, past_due
    billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- monthly, annual
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    cancelled_at TIMESTAMP,
    trial_end TIMESTAMP,
    payment_method_json JSONB, -- Tokenized payment info (no raw card data)
    usage_json JSONB DEFAULT '{"members":0,"accounts":0,"transactions":0,"aiQueries":0,"storageMb":0}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- api_rate_limits: Per-tenant API rate limiting configuration
CREATE TABLE IF NOT EXISTS api_rate_limits (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    endpoint_pattern TEXT NOT NULL, -- e.g. '/api/stream/*', '/api/chat', '/api/*'
    requests_per_minute INTEGER NOT NULL DEFAULT 60,
    requests_per_hour INTEGER NOT NULL DEFAULT 1000,
    requests_per_day INTEGER NOT NULL DEFAULT 10000,
    burst_limit INTEGER NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, endpoint_pattern)
);

-- Indexes
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX idx_tenant_members_role ON tenant_members(tenant_id, role);
CREATE INDEX idx_tenant_invitations_email ON tenant_invitations(email);
CREATE INDEX idx_tenant_invitations_token ON tenant_invitations(token);
CREATE INDEX idx_tenant_invitations_status ON tenant_invitations(tenant_id, status);
CREATE INDEX idx_role_permissions_tenant_role ON role_permissions(tenant_id, role);
CREATE INDEX idx_subscription_history_tenant ON subscription_history(tenant_id);
CREATE INDEX idx_subscription_history_status ON subscription_history(tenant_id, status);
CREATE INDEX idx_api_rate_limits_tenant ON api_rate_limits(tenant_id);

-- Seed default permissions (16 system permissions)
INSERT INTO permissions (name, description, resource, action, is_system) VALUES
('transactions.read', 'View transactions', 'transactions', 'read', true),
('transactions.write', 'Create and edit transactions', 'transactions', 'write', true),
('transactions.delete', 'Delete transactions', 'transactions', 'delete', true),
('accounts.read', 'View accounts', 'accounts', 'read', true),
('accounts.write', 'Create and edit accounts', 'accounts', 'write', true),
('accounts.delete', 'Delete accounts', 'accounts', 'delete', true),
('bas.read', 'View BAS reports', 'bas', 'read', true),
('bas.submit', 'Submit BAS to ATO', 'bas', 'submit', true),
('tax.read', 'View tax information', 'tax', 'read', true),
('tax.write', 'Edit tax returns', 'tax', 'write', true),
('reports.read', 'View reports', 'reports', 'read', true),
('reports.export', 'Export reports', 'reports', 'export', true),
('settings.read', 'View settings', 'settings', 'read', true),
('settings.manage', 'Manage settings', 'settings', 'manage', true),
('members.read', 'View team members', 'members', 'read', true),
('members.manage', 'Add/remove team members', 'members', 'manage', true);

-- Seed default subscription plans (4 tiers)
INSERT INTO subscription_plans (name, display_name, description, price_monthly_cents, price_annual_cents, max_members, max_accounts, max_transactions_per_month, max_ai_queries_per_month, max_storage_mb, features_json, sort_order) VALUES
('free', 'Free', 'Get started with basic bookkeeping', 0, 0, 1, 2, 500, 50, 100, '["basic_reports"]', 0),
('starter', 'Starter', 'For freelancers and sole traders', 2900, 29000, 3, 5, 2000, 200, 500, '["basic_reports","gst_tracking","bank_feeds"]', 1),
('professional', 'Professional', 'For growing businesses', 7900, 79000, 10, 20, 10000, 1000, 2000, '["basic_reports","gst_tracking","bank_feeds","bas_lodgement","multi_entity","api_access","custom_dashboards"]', 2),
('enterprise', 'Enterprise', 'For large organizations', 19900, 199000, 50, 100, 100000, 10000, 10000, '["basic_reports","gst_tracking","bank_feeds","bas_lodgement","multi_entity","api_access","custom_dashboards","priority_support","dedicated_account","sla"]', 3);
