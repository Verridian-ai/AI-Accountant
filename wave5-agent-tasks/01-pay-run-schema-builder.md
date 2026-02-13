# Agent 1: Pay Run Schema Builder

## Role
Create pay run and leave management tables in the dual schema system (SQLite + PostgreSQL) plus PostgreSQL migration 0017.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0017_pay_runs_leave.sql`
**Purpose**: PostgreSQL migration adding 7 new tables for pay run processing and leave management
**Pattern**: Follow `docker/migrations/0012_tax_return_platform.sql` — use `CREATE TABLE IF NOT EXISTS`, wrap in `BEGIN; COMMIT;`

```sql
BEGIN;

-- Pay Runs
CREATE TABLE IF NOT EXISTS pay_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pay_period_start TEXT NOT NULL,
  pay_period_end TEXT NOT NULL,
  pay_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  frequency TEXT NOT NULL DEFAULT 'fortnightly',
  total_gross INTEGER NOT NULL DEFAULT 0,
  total_tax INTEGER NOT NULL DEFAULT 0,
  total_super INTEGER NOT NULL DEFAULT 0,
  total_net INTEGER NOT NULL DEFAULT 0,
  processed_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pay_runs_user_status ON pay_runs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pay_runs_period ON pay_runs(pay_period_start, pay_period_end);

-- Pay Run Lines
CREATE TABLE IF NOT EXISTS pay_run_lines (
  id TEXT PRIMARY KEY,
  pay_run_id TEXT NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  pay_category_id TEXT NOT NULL REFERENCES pay_categories(id),
  hours REAL,
  rate INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL DEFAULT 0,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_pay_run_lines_pay_run ON pay_run_lines(pay_run_id);
CREATE INDEX IF NOT EXISTS idx_pay_run_lines_employee ON pay_run_lines(employee_id);

-- Pay Run Summary (per-employee totals)
CREATE TABLE IF NOT EXISTS pay_run_summary (
  id TEXT PRIMARY KEY,
  pay_run_id TEXT NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  gross_pay INTEGER NOT NULL DEFAULT 0,
  tax_withheld INTEGER NOT NULL DEFAULT 0,
  super_guarantee INTEGER NOT NULL DEFAULT 0,
  super_salary_sacrifice INTEGER NOT NULL DEFAULT 0,
  net_pay INTEGER NOT NULL DEFAULT 0,
  leave_loading INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pay_run_summary_unique ON pay_run_summary(pay_run_id, employee_id);

-- Leave Types
CREATE TABLE IF NOT EXISTS leave_types (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  accrual_rate REAL NOT NULL DEFAULT 0,
  accrual_frequency TEXT NOT NULL DEFAULT 'per_year',
  max_balance REAL,
  is_paid BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leave Balances
CREATE TABLE IF NOT EXISTS leave_balances (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
  balance REAL NOT NULL DEFAULT 0,
  accrued REAL NOT NULL DEFAULT 0,
  taken REAL NOT NULL DEFAULT 0,
  adjustments REAL NOT NULL DEFAULT 0,
  as_at_date TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_balances_unique ON leave_balances(employee_id, leave_type_id);

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  hours REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status ON leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- Leave Transactions (ledger entries for accrual/taken/adjustment)
CREATE TABLE IF NOT EXISTS leave_transactions (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
  pay_run_id TEXT REFERENCES pay_runs(id),
  type TEXT NOT NULL,
  hours REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_leave_transactions_employee_type ON leave_transactions(employee_id, leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_transactions_pay_run ON leave_transactions(pay_run_id);

COMMIT;
```

## Files to MODIFY

### 2. `server/src/schema.ts`
**Purpose**: Add 7 new `sqliteTable()` definitions for pay run and leave tables
**Location**: Insert AFTER the employee/pay structure tables (Wave 4 section) and BEFORE the TYPE EXPORTS section

Add these table definitions:

- [ ] `payRuns` — `sqliteTable('pay_runs', { ... })` with columns:
  - `id: text('id').primaryKey()`
  - `userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' })`
  - `payPeriodStart: text('pay_period_start').notNull()`
  - `payPeriodEnd: text('pay_period_end').notNull()`
  - `payDate: text('pay_date').notNull()`
  - `status: text('status').notNull().default('draft')` — 'draft'|'processing'|'completed'|'reversed'
  - `frequency: text('frequency').notNull().default('fortnightly')` — 'weekly'|'fortnightly'|'monthly'
  - `totalGross: integer('total_gross').notNull().default(0)` — cents
  - `totalTax: integer('total_tax').notNull().default(0)` — cents
  - `totalSuper: integer('total_super').notNull().default(0)` — cents
  - `totalNet: integer('total_net').notNull().default(0)` — cents
  - `processedAt: text('processed_at')`
  - `createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP')`
  - `updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP')`

- [ ] `payRunLines` — FK to `payRuns`, `employees`, `payCategories`; columns: hours (REAL), rate (INTEGER cents), amount (INTEGER cents), description

- [ ] `payRunSummary` — FK to `payRuns`, `employees`; columns: grossPay, taxWithheld, superGuarantee, superSalarySacrifice, netPay, leaveLoading (all INTEGER cents)

- [ ] `leaveTypes` — FK to `users`; columns: name, accrualRate (REAL), accrualFrequency, maxBalance (REAL), isPaid (boolean), isActive (boolean)

- [ ] `leaveBalances` — FK to `employees`, `leaveTypes`; columns: balance, accrued, taken, adjustments (all REAL), asAtDate

- [ ] `leaveRequests` — FK to `employees`, `leaveTypes`, `users` (approvedBy); columns: startDate, endDate, hours (REAL), status, notes

- [ ] `leaveTransactions` — FK to `employees`, `leaveTypes`, `payRuns`; columns: type ('accrual'|'taken'|'adjustment'), hours (REAL), date, notes

- [ ] Add type exports at the end of TYPE EXPORTS section:
```typescript
// Pay Runs
export type PayRun = typeof payRuns.$inferSelect;
export type NewPayRun = typeof payRuns.$inferInsert;
export type PayRunLine = typeof payRunLines.$inferSelect;
export type NewPayRunLine = typeof payRunLines.$inferInsert;
export type PayRunSummaryRecord = typeof payRunSummary.$inferSelect;

// Leave
export type LeaveType = typeof leaveTypes.$inferSelect;
export type NewLeaveType = typeof leaveTypes.$inferInsert;
export type LeaveBalance = typeof leaveBalances.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type NewLeaveRequest = typeof leaveRequests.$inferInsert;
export type LeaveTransaction = typeof leaveTransactions.$inferSelect;
```

### 3. `server/src/db/postgres-schema.ts`
**Purpose**: Add matching `pgTable()` definitions for all 7 new tables
**Pattern**: Follow existing Wave 11/12 tables — use `pgTable()`, `timestamp({ withTimezone: true })`, `boolean()`

- [ ] Add `payRuns` pgTable with PG types (TIMESTAMPTZ for dates, BOOLEAN for booleans)
- [ ] Add `payRunLines` pgTable
- [ ] Add `payRunSummary` pgTable
- [ ] Add `leaveTypes` pgTable
- [ ] Add `leaveBalances` pgTable
- [ ] Add `leaveRequests` pgTable
- [ ] Add `leaveTransactions` pgTable
- [ ] Add matching type exports

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean (no new errors from schema additions)
- [ ] Migration file `0017_pay_runs_leave.sql` is valid PostgreSQL syntax
- [ ] All 7 `sqliteTable()` definitions compile correctly
- [ ] All type exports resolve correctly
- [ ] Foreign keys reference correct tables: `employees` (Wave 4), `pay_categories` (Wave 4), `users` (core)
- [ ] All monetary amounts are INTEGER (cents), never REAL/float
- [ ] Booleans use `integer('...', { mode: 'boolean' })` in SQLite, `boolean()` in PostgreSQL
- [ ] Create marker file: `.agent-done-W05-01`

## Dependencies
- **None** — can start immediately
- **Reuses**: schema.ts patterns, postgres-schema.ts patterns, migration conventions
- **Requires tables from Wave 4**: `employees`, `pay_categories` (these must exist in schema.ts already)
