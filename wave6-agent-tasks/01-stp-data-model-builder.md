# Agent 1: STP Data Model Builder

## Role
Create 7 new tables (STP events, employee YTD, payslips, awards, award rates, timesheets, timesheet entries) in dual schema (SQLite + PostgreSQL) and the migration SQL file.

## Priority: SUB-WAVE 1 (No dependencies — start immediately)

## Files to CREATE

### 1. `docker/migrations/0018_stp_payslips_timesheets.sql`
**Purpose**: Create all 7 Wave 6 tables with indexes and foreign keys

```sql
BEGIN;

-- STP Events
CREATE TABLE IF NOT EXISTS stp_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  pay_run_id TEXT REFERENCES pay_runs(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('pay_event', 'update', 'finalisation')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'accepted', 'rejected')),
  submission_date TEXT,
  ato_response_id TEXT,
  xml_payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stp_events_user_status ON stp_events(user_id, status);
CREATE INDEX IF NOT EXISTS idx_stp_events_pay_run ON stp_events(pay_run_id);

-- STP Employee YTD
CREATE TABLE IF NOT EXISTS stp_employee_ytd (
  id TEXT PRIMARY KEY,
  stp_event_id TEXT NOT NULL REFERENCES stp_events(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  gross_payments INTEGER NOT NULL DEFAULT 0,
  tax_withheld INTEGER NOT NULL DEFAULT 0,
  super_guarantee INTEGER NOT NULL DEFAULT 0,
  reportable_super INTEGER NOT NULL DEFAULT 0,
  rfba INTEGER NOT NULL DEFAULT 0,
  lump_sum_a INTEGER NOT NULL DEFAULT 0,
  lump_sum_b INTEGER NOT NULL DEFAULT 0,
  lump_sum_d INTEGER NOT NULL DEFAULT 0,
  lump_sum_e INTEGER NOT NULL DEFAULT 0,
  etp_code TEXT,
  etp_amount INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_stp_ytd_event ON stp_employee_ytd(stp_event_id);
CREATE INDEX IF NOT EXISTS idx_stp_ytd_employee ON stp_employee_ytd(employee_id);

-- Payslips
CREATE TABLE IF NOT EXISTS payslips (
  id TEXT PRIMARY KEY,
  pay_run_id TEXT NOT NULL REFERENCES pay_runs(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  pay_period_start TEXT NOT NULL,
  pay_period_end TEXT NOT NULL,
  pay_date TEXT NOT NULL,
  gross_pay INTEGER NOT NULL DEFAULT 0,
  tax_withheld INTEGER NOT NULL DEFAULT 0,
  super_amount INTEGER NOT NULL DEFAULT 0,
  net_pay INTEGER NOT NULL DEFAULT 0,
  pdf_path TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payslips_pay_run ON payslips(pay_run_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);

-- Modern Awards
CREATE TABLE IF NOT EXISTS awards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  code TEXT,
  effective_date TEXT NOT NULL,
  expiry_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_awards_user_active ON awards(user_id, is_active);

-- Award Rates
CREATE TABLE IF NOT EXISTS award_rates (
  id TEXT PRIMARY KEY,
  award_id TEXT NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
  classification TEXT NOT NULL,
  level TEXT NOT NULL,
  hourly_rate INTEGER NOT NULL,
  casual_loading REAL NOT NULL DEFAULT 0.25,
  overtime_multiplier REAL NOT NULL DEFAULT 1.5,
  effective_date TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_award_rates_award_class ON award_rates(award_id, classification);

-- Timesheets
CREATE TABLE IF NOT EXISTS timesheets (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  total_hours REAL NOT NULL DEFAULT 0,
  pay_category_id TEXT REFERENCES pay_categories(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'approved')),
  approved_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_timesheets_employee_date ON timesheets(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON timesheets(status);

-- Timesheet Entries
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id TEXT PRIMARY KEY,
  timesheet_id TEXT NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  project_id TEXT,
  task_description TEXT,
  hours REAL NOT NULL DEFAULT 0,
  billable INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheet ON timesheet_entries(timesheet_id);

COMMIT;
```

## Files to MODIFY

### 2. `server/src/schema.ts`
**Purpose**: Add 7 new `sqliteTable()` definitions

**Location**: Add after existing Wave 5 tables (leave_transactions table definition)

Add these table definitions:

```typescript
// ==================== Wave 6: STP, Payslips, Timesheets ====================

export const stpEvents = sqliteTable('stp_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  payRunId: text('pay_run_id').references(() => payRuns.id),
  eventType: text('event_type').notNull(), // 'pay_event' | 'update' | 'finalisation'
  status: text('status').notNull().default('draft'), // 'draft' | 'submitted' | 'accepted' | 'rejected'
  submissionDate: text('submission_date'),
  atoResponseId: text('ato_response_id'),
  xmlPayload: text('xml_payload'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const stpEmployeeYtd = sqliteTable('stp_employee_ytd', {
  id: text('id').primaryKey(),
  stpEventId: text('stp_event_id').notNull().references(() => stpEvents.id),
  employeeId: text('employee_id').notNull().references(() => employees.id),
  grossPayments: integer('gross_payments').notNull().default(0),
  taxWithheld: integer('tax_withheld').notNull().default(0),
  superGuarantee: integer('super_guarantee').notNull().default(0),
  reportableSuper: integer('reportable_super').notNull().default(0),
  rfba: integer('rfba').notNull().default(0),
  lumpSumA: integer('lump_sum_a').notNull().default(0),
  lumpSumB: integer('lump_sum_b').notNull().default(0),
  lumpSumD: integer('lump_sum_d').notNull().default(0),
  lumpSumE: integer('lump_sum_e').notNull().default(0),
  etpCode: text('etp_code'),
  etpAmount: integer('etp_amount').notNull().default(0),
});

export const payslips = sqliteTable('payslips', {
  id: text('id').primaryKey(),
  payRunId: text('pay_run_id').notNull().references(() => payRuns.id),
  employeeId: text('employee_id').notNull().references(() => employees.id),
  payPeriodStart: text('pay_period_start').notNull(),
  payPeriodEnd: text('pay_period_end').notNull(),
  payDate: text('pay_date').notNull(),
  grossPay: integer('gross_pay').notNull().default(0),
  taxWithheld: integer('tax_withheld').notNull().default(0),
  superAmount: integer('super_amount').notNull().default(0),
  netPay: integer('net_pay').notNull().default(0),
  pdfPath: text('pdf_path'),
  sentAt: text('sent_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const awards = sqliteTable('awards', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  code: text('code'),
  effectiveDate: text('effective_date').notNull(),
  expiryDate: text('expiry_date'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const awardRates = sqliteTable('award_rates', {
  id: text('id').primaryKey(),
  awardId: text('award_id').notNull().references(() => awards.id),
  classification: text('classification').notNull(),
  level: text('level').notNull(),
  hourlyRate: integer('hourly_rate').notNull(),
  casualLoading: real('casual_loading').notNull().default(0.25),
  overtimeMultiplier: real('overtime_multiplier').notNull().default(1.5),
  effectiveDate: text('effective_date').notNull(),
});

export const timesheets = sqliteTable('timesheets', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id),
  date: text('date').notNull(),
  startTime: text('start_time'),
  endTime: text('end_time'),
  breakMinutes: integer('break_minutes').notNull().default(0),
  totalHours: real('total_hours').notNull().default(0),
  payCategoryId: text('pay_category_id').references(() => payCategories.id),
  status: text('status').notNull().default('draft'), // 'draft' | 'submitted' | 'approved'
  approvedBy: text('approved_by').references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const timesheetEntries = sqliteTable('timesheet_entries', {
  id: text('id').primaryKey(),
  timesheetId: text('timesheet_id').notNull().references(() => timesheets.id),
  projectId: text('project_id'),
  taskDescription: text('task_description'),
  hours: real('hours').notNull().default(0),
  billable: integer('billable').notNull().default(0),
});
```

**Type exports** — add at the end of the file:
```typescript
export type STPEvent = typeof stpEvents.$inferSelect;
export type STPEmployeeYTD = typeof stpEmployeeYtd.$inferSelect;
export type Payslip = typeof payslips.$inferSelect;
export type Award = typeof awards.$inferSelect;
export type AwardRate = typeof awardRates.$inferSelect;
export type Timesheet = typeof timesheets.$inferSelect;
export type TimesheetEntry = typeof timesheetEntries.$inferSelect;
```

### 3. `server/src/db/postgres-schema.ts`
**Purpose**: Add matching 7 `pgTable()` definitions

**Location**: Add after existing Wave 5 tables

Add matching PostgreSQL table definitions using `pgTable()` with the same column names and types as the SQLite schema. Use `text()`, `integer()`, `real()`, `boolean()` as appropriate for PG. Follow the same pattern as existing PG tables in this file.

**Type exports** — mirror SQLite exports.

## Verification
- [ ] `docker/migrations/0018_stp_payslips_timesheets.sql` is valid SQL and executes without errors
- [ ] All 7 tables defined in `schema.ts` with correct column types
- [ ] All 7 tables defined in `postgres-schema.ts` with matching columns
- [ ] All foreign keys reference correct parent tables
- [ ] All monetary columns are INTEGER (cents) — never REAL/float for money
- [ ] All indexes created for composite query patterns
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Type exports exist for all 7 new types
- [ ] Create marker file: `.agent-done-W06-01`

## Dependencies
- **None** — this agent starts immediately
- **Coordination rule**: Only Agent 1 modifies `schema.ts` and `postgres-schema.ts`
