# Agent 1: Recurring Invoice Schema Builder

## Role
Create the database migration for Wave 8's 5 tables, and add all Drizzle ORM definitions to both schema files.

## Priority: SUB-WAVE 1 (No dependencies — runs immediately)

## Files to CREATE

### 1. `docker/migrations/0020_recurring_payments.sql`
**Purpose**: Create 5 new tables for recurring invoices, payment gateways, dunning, and subscriptions
**Pattern**: Follow `docker/migrations/0019_customers_invoices.sql` (Wave 7)

```sql
BEGIN;

-- 1. Recurring Invoices
CREATE TABLE IF NOT EXISTS recurring_invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'annually')),
  next_generation_date TEXT NOT NULL,
  end_date TEXT,
  template_invoice_id TEXT REFERENCES invoices(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  last_generated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Payment Gateways
CREATE TABLE IF NOT EXISTS payment_gateways (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal', 'bank_transfer')),
  config TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Dunning Sequences
CREATE TABLE IF NOT EXISTS dunning_sequences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  steps TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Dunning History
CREATE TABLE IF NOT EXISTS dunning_history (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  sequence_id TEXT NOT NULL REFERENCES dunning_sequences(id),
  step_number INTEGER NOT NULL,
  sent_at TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('email', 'sms', 'phone', 'suspend')),
  result TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Customer Subscriptions
CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'annually')),
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  recurring_invoice_id TEXT REFERENCES recurring_invoices(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_user_active ON recurring_invoices(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_next_date ON recurring_invoices(next_generation_date);
CREATE INDEX IF NOT EXISTS idx_payment_gateways_user ON payment_gateways(user_id);
CREATE INDEX IF NOT EXISTS idx_dunning_sequences_user ON dunning_sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_dunning_history_invoice ON dunning_history(invoice_id);
CREATE INDEX IF NOT EXISTS idx_dunning_history_sequence ON dunning_history(sequence_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_customer ON customer_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_status ON customer_subscriptions(status);

COMMIT;
```

- [ ] All 5 tables use `CREATE TABLE IF NOT EXISTS` for idempotency
- [ ] Wrapped in `BEGIN; ... COMMIT;` transaction
- [ ] Foreign keys reference correct parent tables (`users`, `customers`, `invoices`, `dunning_sequences`, `recurring_invoices`)
- [ ] CHECK constraints on enum columns (`frequency`, `provider`, `action`, `status`)
- [ ] All monetary values as `INTEGER` (cents)
- [ ] All indexes use `CREATE INDEX IF NOT EXISTS`

## Files to MODIFY

### 2. `server/src/schema.ts`
**Purpose**: Add 5 `sqliteTable()` definitions with type exports

**Add AFTER the existing Wave 7 invoice tables** (after `invoicePayments`):

```typescript
// ─── Wave 8: Recurring Invoices & Payments ──────────────────────────────────

export const recurringInvoices = sqliteTable('recurring_invoices', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  customerId: text('customer_id').notNull().references(() => customers.id),
  frequency: text('frequency').notNull(), // weekly|fortnightly|monthly|quarterly|annually
  nextGenerationDate: text('next_generation_date').notNull(),
  endDate: text('end_date'),
  templateInvoiceId: text('template_invoice_id').references(() => invoices.id),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastGeneratedAt: text('last_generated_at'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const paymentGateways = sqliteTable('payment_gateways', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull(), // stripe|paypal|bank_transfer
  config: text('config').notNull(), // encrypted JSON
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const dunningSequences = sqliteTable('dunning_sequences', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  steps: text('steps').notNull(), // JSON: [{daysAfterDue, action, template}]
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const dunningHistory = sqliteTable('dunning_history', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  sequenceId: text('sequence_id').notNull().references(() => dunningSequences.id),
  stepNumber: integer('step_number').notNull(),
  sentAt: text('sent_at').notNull(),
  action: text('action').notNull(), // email|sms|phone|suspend
  result: text('result'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const customerSubscriptions = sqliteTable('customer_subscriptions', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  name: text('name').notNull(),
  amount: integer('amount').notNull(), // cents
  frequency: text('frequency').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  status: text('status').notNull().default('active'), // active|paused|cancelled
  recurringInvoiceId: text('recurring_invoice_id').references(() => recurringInvoices.id),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});
```

**Add type exports**:
```typescript
export type RecurringInvoice = typeof recurringInvoices.$inferSelect;
export type NewRecurringInvoice = typeof recurringInvoices.$inferInsert;
export type PaymentGateway = typeof paymentGateways.$inferSelect;
export type NewPaymentGateway = typeof paymentGateways.$inferInsert;
export type DunningSequence = typeof dunningSequences.$inferSelect;
export type NewDunningSequence = typeof dunningSequences.$inferInsert;
export type DunningHistoryEntry = typeof dunningHistory.$inferSelect;
export type NewDunningHistoryEntry = typeof dunningHistory.$inferInsert;
export type CustomerSubscription = typeof customerSubscriptions.$inferSelect;
export type NewCustomerSubscription = typeof customerSubscriptions.$inferInsert;
```

### 3. `server/src/db/postgres-schema.ts`
**Purpose**: Add 5 matching `pgTable()` definitions

**Pattern differences from SQLite**:
- `integer('is_active', { mode: 'boolean' })` → `boolean('is_active').notNull().default(true)`
- `text('created_at').default('CURRENT_TIMESTAMP')` → `timestamp('created_at', { withTimezone: true }).defaultNow()`
- Add index definitions using `pgTable` index API

```typescript
// ─── Wave 8: Recurring Invoices & Payments ──────────────────────────────────

export const recurringInvoices = pgTable('recurring_invoices', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  customerId: text('customer_id').notNull().references(() => customers.id),
  frequency: text('frequency').notNull(),
  nextGenerationDate: text('next_generation_date').notNull(),
  endDate: text('end_date'),
  templateInvoiceId: text('template_invoice_id').references(() => invoices.id),
  isActive: boolean('is_active').notNull().default(true),
  lastGeneratedAt: text('last_generated_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const paymentGateways = pgTable('payment_gateways', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull(),
  config: text('config').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const dunningSequences = pgTable('dunning_sequences', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  steps: text('steps').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const dunningHistory = pgTable('dunning_history', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  sequenceId: text('sequence_id').notNull().references(() => dunningSequences.id),
  stepNumber: integer('step_number').notNull(),
  sentAt: text('sent_at').notNull(),
  action: text('action').notNull(),
  result: text('result'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const customerSubscriptions = pgTable('customer_subscriptions', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  name: text('name').notNull(),
  amount: integer('amount').notNull(),
  frequency: text('frequency').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  status: text('status').notNull().default('active'),
  recurringInvoiceId: text('recurring_invoice_id').references(() => recurringInvoices.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

## Verification
- [ ] Migration file `0020_recurring_payments.sql` is valid PostgreSQL
- [ ] All 5 `sqliteTable()` definitions in `schema.ts` with correct column types
- [ ] All 5 `pgTable()` definitions in `postgres-schema.ts` with correct PG types
- [ ] Type exports for all 5 tables (Select + Insert types)
- [ ] Foreign keys reference correct parent tables
- [ ] Table names match between migration SQL and Drizzle definitions
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W08-01`

## Dependencies
- **Wave 7 Agent 1**: Wave 7 schema tables (`customers`, `invoices`) must exist in both schema files
- **None within Wave 8**: This agent has no Wave 8 dependencies
