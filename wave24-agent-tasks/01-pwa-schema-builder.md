# Agent 1: PWA Schema Builder

## Role
Create 3 database tables and migration 0036 for push notification subscriptions, notification preferences, and offline sync tracking.

## Priority: WAVE 24 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0036_pwa_support.sql`
**Purpose**: 3 new tables for PWA push notifications and offline sync

```sql
-- push_subscriptions: Web Push API subscription records
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE, -- Push service URL
    keys_json JSONB NOT NULL, -- { p256dh: string, auth: string }
    user_agent TEXT, -- Browser/device identifier
    device_name TEXT, -- User-friendly device name: "Daniel's iPhone", "Work Laptop"
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMP,
    error_count INTEGER NOT NULL DEFAULT 0, -- Increment on delivery failure, deactivate at 5
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- notification_preferences: Per-user notification settings
CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- Category toggles
    transaction_alerts BOOLEAN NOT NULL DEFAULT true, -- Large transactions, unusual activity
    bas_reminders BOOLEAN NOT NULL DEFAULT true, -- BAS due date approaching
    budget_alerts BOOLEAN NOT NULL DEFAULT true, -- Over-budget categories
    tax_reminders BOOLEAN NOT NULL DEFAULT true, -- Tax deadlines, lodgement dates
    bill_reminders BOOLEAN NOT NULL DEFAULT true, -- Recurring bill due dates
    sync_notifications BOOLEAN NOT NULL DEFAULT false, -- Offline sync completed
    team_notifications BOOLEAN NOT NULL DEFAULT true, -- Member added, role changed
    system_notifications BOOLEAN NOT NULL DEFAULT true, -- Maintenance, updates
    -- Thresholds
    large_transaction_threshold_cents INTEGER NOT NULL DEFAULT 100000, -- $1,000 default
    budget_alert_threshold_percent INTEGER NOT NULL DEFAULT 80, -- Alert at 80% of budget
    -- Delivery preferences
    push_enabled BOOLEAN NOT NULL DEFAULT true,
    email_enabled BOOLEAN NOT NULL DEFAULT false,
    quiet_hours_start TEXT, -- HH:MM format, e.g. '22:00'
    quiet_hours_end TEXT, -- HH:MM format, e.g. '07:00'
    timezone TEXT DEFAULT 'Australia/Sydney',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

-- offline_sync_log: Track offline changes and sync status
CREATE TABLE IF NOT EXISTS offline_sync_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL, -- Unique device/browser identifier
    operation TEXT NOT NULL, -- 'create', 'update', 'delete'
    resource_type TEXT NOT NULL, -- 'transaction', 'account', 'note', etc.
    resource_id TEXT, -- ID of the affected resource (null for create until synced)
    payload_json JSONB NOT NULL, -- The offline change payload
    sync_status TEXT NOT NULL DEFAULT 'pending', -- pending, syncing, synced, conflict, failed
    conflict_resolution TEXT, -- 'client_wins', 'server_wins', 'manual', null
    conflict_details JSONB, -- Details about the conflict if any
    server_version INTEGER, -- Server-side version at time of sync attempt
    client_version INTEGER, -- Client-side version when change was made
    synced_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_tenant ON push_subscriptions(tenant_id);
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(is_active);
CREATE INDEX idx_notification_preferences_user_tenant ON notification_preferences(user_id, tenant_id);
CREATE INDEX idx_offline_sync_user ON offline_sync_log(user_id);
CREATE INDEX idx_offline_sync_status ON offline_sync_log(sync_status);
CREATE INDEX idx_offline_sync_device ON offline_sync_log(device_id);
CREATE INDEX idx_offline_sync_pending ON offline_sync_log(sync_status, created_at) WHERE sync_status = 'pending';
```

- [ ] Write complete migration SQL with all 3 tables, indexes, and constraints

### 2. `server/src/schema.ts` additions
- [ ] Add `pushSubscriptions` sqliteTable matching migration
- [ ] Add `notificationPreferences` sqliteTable matching migration
- [ ] Add `offlineSyncLog` sqliteTable matching migration
- [ ] Export all 3 tables

### 3. `server/src/db/postgres-schema.ts` additions
- [ ] Add `pushSubscriptions` pgTable with PostgreSQL types
- [ ] Add `notificationPreferences` pgTable with PostgreSQL types
- [ ] Add `offlineSyncLog` pgTable with PostgreSQL types
- [ ] Export all 3 tables

## Files to MODIFY

### 4. `server/src/schema.ts`
- [ ] Add exports for all 3 new tables

### 5. `server/src/db/postgres-schema.ts`
- [ ] Add exports for all 3 new tables

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Migration SQL runs without errors against PostgreSQL
- [ ] All 3 tables created with correct columns and constraints
- [ ] FK cascades work (delete user cascades to subscriptions, preferences, sync log)
- [ ] Unique constraint on `notification_preferences(user_id, tenant_id)` enforced
- [ ] Unique constraint on `push_subscriptions.endpoint` enforced
- [ ] Create marker file: `.agent-done-W24-01`

## Dependencies
- **None** -- can start immediately
- **Schema lock**: Only this agent may modify schema.ts and postgres-schema.ts in Wave 24
