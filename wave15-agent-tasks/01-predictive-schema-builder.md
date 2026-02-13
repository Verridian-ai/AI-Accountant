# Agent W15-01: Predictive Schema Builder

## Role
Create 6 new database tables and migration 0027 for predictive analytics and compliance monitoring.

## Priority: WAVE 15 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0027_predictive_analytics.sql`
**Purpose**: 6 tables for cash flow forecasting, anomaly detection, and compliance tracking

- [ ] Create `cash_flow_forecasts` table:
  ```sql
  CREATE TABLE IF NOT EXISTS cash_flow_forecasts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    account_id TEXT REFERENCES accounts(id),
    name TEXT NOT NULL,
    forecast_type TEXT NOT NULL CHECK (forecast_type IN ('linear', 'seasonal', 'ml_weighted')),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    granularity TEXT NOT NULL DEFAULT 'monthly' CHECK (granularity IN ('daily', 'weekly', 'monthly', 'quarterly')),
    accuracy_score REAL,
    confidence_level REAL DEFAULT 0.85,
    parameters TEXT, -- JSON: model params, weights, seasonality factors
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'archived')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ```

- [ ] Create `cash_flow_forecast_periods` table:
  ```sql
  CREATE TABLE IF NOT EXISTS cash_flow_forecast_periods (
    id TEXT PRIMARY KEY,
    forecast_id TEXT NOT NULL REFERENCES cash_flow_forecasts(id) ON DELETE CASCADE,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    predicted_inflow REAL NOT NULL DEFAULT 0,
    predicted_outflow REAL NOT NULL DEFAULT 0,
    predicted_net REAL NOT NULL DEFAULT 0,
    actual_inflow REAL,
    actual_outflow REAL,
    actual_net REAL,
    variance REAL,
    variance_pct REAL,
    confidence_lower REAL,
    confidence_upper REAL,
    breakdown TEXT, -- JSON: per-category predictions
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_forecast_periods_forecast ON cash_flow_forecast_periods(forecast_id);
  CREATE INDEX idx_forecast_periods_dates ON cash_flow_forecast_periods(period_start, period_end);
  ```

- [ ] Create `anomaly_alerts` table:
  ```sql
  CREATE TABLE IF NOT EXISTS anomaly_alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    account_id TEXT REFERENCES accounts(id),
    transaction_id TEXT REFERENCES transactions(id),
    alert_type TEXT NOT NULL CHECK (alert_type IN ('duplicate_payment', 'amount_anomaly', 'velocity_spike', 'category_drift', 'unusual_merchant', 'schedule_deviation')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    details TEXT, -- JSON: anomaly metrics, thresholds, context
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
    resolved_by TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_anomaly_alerts_user ON anomaly_alerts(user_id);
  CREATE INDEX idx_anomaly_alerts_status ON anomaly_alerts(status);
  CREATE INDEX idx_anomaly_alerts_type ON anomaly_alerts(alert_type);
  ```

- [ ] Create `compliance_checks` table:
  ```sql
  CREATE TABLE IF NOT EXISTS compliance_checks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    obligation_type TEXT NOT NULL CHECK (obligation_type IN ('bas_lodgement', 'tax_return', 'payg_instalment', 'super_guarantee', 'tpar_report', 'stp_finalisation', 'fbt_return', 'annual_review')),
    period TEXT NOT NULL, -- e.g. '2024-Q3', '2024-25'
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'compliant', 'overdue', 'lodged', 'waived')),
    lodged_date TEXT,
    amount_due REAL,
    amount_paid REAL,
    reference_number TEXT,
    notes TEXT,
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_compliance_checks_user ON compliance_checks(user_id);
  CREATE INDEX idx_compliance_checks_due ON compliance_checks(due_date);
  CREATE INDEX idx_compliance_checks_status ON compliance_checks(status);
  ```

- [ ] Create `compliance_schedules` table:
  ```sql
  CREATE TABLE IF NOT EXISTS compliance_schedules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    obligation_type TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'annually')),
    base_due_day INTEGER NOT NULL, -- day of month (28 for BAS quarterly)
    reminder_days_before INTEGER NOT NULL DEFAULT 14,
    auto_generate BOOLEAN NOT NULL DEFAULT true,
    last_generated TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_compliance_schedules_user ON compliance_schedules(user_id);
  ```

- [ ] Create `audit_trails` table:
  ```sql
  CREATE TABLE IF NOT EXISTS audit_trails (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    entity_type TEXT NOT NULL, -- 'transaction', 'forecast', 'compliance_check', etc.
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'approve', 'reject', 'lodge', 'review')),
    field_changed TEXT,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    performed_by TEXT NOT NULL, -- 'user', 'system', 'agent:forecasting', etc.
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_audit_trails_entity ON audit_trails(entity_type, entity_id);
  CREATE INDEX idx_audit_trails_user ON audit_trails(user_id);
  CREATE INDEX idx_audit_trails_created ON audit_trails(created_at);
  ```

### 2. `server/src/schema.ts` — Add 6 sqliteTable definitions
- [ ] Add `cashFlowForecasts` sqliteTable after existing table definitions
- [ ] Add `cashFlowForecastPeriods` sqliteTable with FK to cashFlowForecasts
- [ ] Add `anomalyAlerts` sqliteTable with FKs to users, accounts, transactions
- [ ] Add `complianceChecks` sqliteTable with FK to users
- [ ] Add `complianceSchedules` sqliteTable with FK to users
- [ ] Add `auditTrails` sqliteTable with FK to users

### 3. `server/src/db/postgres-schema.ts` — Add 6 pgTable definitions
- [ ] Mirror all 6 tables using pgTable with PostgreSQL types (`boolean()` instead of `integer({mode:'boolean'})`)
- [ ] Add appropriate indexes in third argument of pgTable

## Files to MODIFY

### 4. `server/src/schema.ts`
- [ ] Export all 6 new table constants
- [ ] Ensure FK references point to existing `users`, `accounts`, `transactions` tables

### 5. `server/src/db/postgres-schema.ts`
- [ ] Export all 6 new pgTable constants matching the sqliteTable names

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Migration SQL is valid (no syntax errors when run against PostgreSQL)
- [ ] All 6 tables exported from both schema files
- [ ] Foreign key references are valid (users.id, accounts.id, transactions.id)
- [ ] Create marker file: `.agent-done-W15-01`

## Dependencies
- **None** -- can start immediately
- **Schema lock**: Only W15-01 may modify schema.ts and postgres-schema.ts in Wave 15
