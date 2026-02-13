# Agent 1: Customer & Invoice Schema Builder

## Role
Create customer management and invoice tables in the dual schema system (SQLite + PostgreSQL) plus PostgreSQL migration 0019.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0019_customers_invoices.sql`
**Purpose**: PostgreSQL migration adding 6 new tables for customer management and invoicing
**Pattern**: Follow `docker/migrations/0012_tax_return_platform.sql` — use `CREATE TABLE IF NOT EXISTS`, include indexes, wrap in `BEGIN; ... COMMIT;`

- [ ] Create `customers` table:
  - `id TEXT PRIMARY KEY`
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `business_name TEXT NOT NULL`
  - `contact_name TEXT`
  - `email TEXT`
  - `phone TEXT`
  - `address TEXT`
  - `city TEXT`
  - `state TEXT`
  - `postcode TEXT`
  - `country TEXT NOT NULL DEFAULT 'AU'`
  - `abn TEXT`
  - `payment_terms_days INTEGER NOT NULL DEFAULT 30`
  - `notes TEXT`
  - `is_active BOOLEAN DEFAULT true`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(user_id, is_active)`
  - INDEX on `(user_id, abn)` where abn is NOT NULL
  - INDEX on `(user_id, email)` where email is NOT NULL

- [ ] Create `customer_contacts` table:
  - `id TEXT PRIMARY KEY`
  - `customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE`
  - `name TEXT NOT NULL`
  - `email TEXT`
  - `phone TEXT`
  - `role TEXT`
  - `is_primary BOOLEAN DEFAULT false`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(customer_id)`

- [ ] Create `invoices` table:
  - `id TEXT PRIMARY KEY`
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `customer_id TEXT NOT NULL REFERENCES customers(id)`
  - `invoice_number TEXT NOT NULL UNIQUE`
  - `type TEXT NOT NULL DEFAULT 'tax_invoice'` (tax_invoice, credit_note, receipt)
  - `status TEXT NOT NULL DEFAULT 'draft'` (draft, sent, viewed, paid, overdue, void)
  - `issue_date TEXT NOT NULL`
  - `due_date TEXT NOT NULL`
  - `subtotal INTEGER NOT NULL DEFAULT 0` (cents)
  - `gst_amount INTEGER NOT NULL DEFAULT 0` (cents)
  - `total_amount INTEGER NOT NULL DEFAULT 0` (cents)
  - `amount_paid INTEGER NOT NULL DEFAULT 0` (cents)
  - `amount_due INTEGER NOT NULL DEFAULT 0` (cents)
  - `currency TEXT NOT NULL DEFAULT 'AUD'`
  - `notes TEXT`
  - `terms_and_conditions TEXT`
  - `pdf_path TEXT`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(user_id, status)`
  - INDEX on `(customer_id)`
  - INDEX on `(due_date)`
  - UNIQUE INDEX on `(invoice_number)` — already via column constraint

- [ ] Create `invoice_lines` table:
  - `id TEXT PRIMARY KEY`
  - `invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE`
  - `description TEXT NOT NULL`
  - `quantity REAL NOT NULL DEFAULT 1`
  - `unit_price INTEGER NOT NULL DEFAULT 0` (cents)
  - `amount INTEGER NOT NULL DEFAULT 0` (cents = quantity × unit_price)
  - `gst_rate REAL NOT NULL DEFAULT 0.1` (10% GST)
  - `gst_amount INTEGER NOT NULL DEFAULT 0` (cents)
  - `account_code TEXT`
  - `tax_code TEXT`
  - INDEX on `(invoice_id)`

- [ ] Create `invoice_number_sequences` table:
  - `id TEXT PRIMARY KEY`
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `prefix TEXT NOT NULL DEFAULT 'INV-'`
  - `next_number INTEGER NOT NULL DEFAULT 1`
  - `format TEXT NOT NULL DEFAULT '{prefix}{number:06d}'`
  - UNIQUE INDEX on `(user_id)`

- [ ] Create `invoice_payments` table:
  - `id TEXT PRIMARY KEY`
  - `invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE`
  - `payment_date TEXT NOT NULL`
  - `amount INTEGER NOT NULL` (cents)
  - `payment_method TEXT`
  - `reference TEXT`
  - `transaction_id TEXT REFERENCES transactions(id)`
  - `notes TEXT`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(invoice_id)`
  - INDEX on `(transaction_id)` where transaction_id is NOT NULL

## Files to MODIFY

### 2. `server/src/schema.ts`
**Purpose**: Add 6 new `sqliteTable()` definitions
**Location**: Insert BEFORE the TYPE EXPORTS section

```typescript
// ============================================================================
// CUSTOMER MANAGEMENT & INVOICING
// ============================================================================

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessName: text('business_name').notNull(),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  postcode: text('postcode'),
  country: text('country').notNull().default('AU'),
  abn: text('abn'),
  paymentTermsDays: integer('payment_terms_days').notNull().default(30),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const customerContacts = sqliteTable('customer_contacts', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  role: text('role'),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull().references(() => customers.id),
  invoiceNumber: text('invoice_number').notNull(),
  type: text('type').notNull().default('tax_invoice'),
  status: text('status').notNull().default('draft'),
  issueDate: text('issue_date').notNull(),
  dueDate: text('due_date').notNull(),
  subtotal: integer('subtotal').notNull().default(0),
  gstAmount: integer('gst_amount').notNull().default(0),
  totalAmount: integer('total_amount').notNull().default(0),
  amountPaid: integer('amount_paid').notNull().default(0),
  amountDue: integer('amount_due').notNull().default(0),
  currency: text('currency').notNull().default('AUD'),
  notes: text('notes'),
  termsAndConditions: text('terms_and_conditions'),
  pdfPath: text('pdf_path'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const invoiceLines = sqliteTable('invoice_lines', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: real('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull().default(0),
  amount: integer('amount').notNull().default(0),
  gstRate: real('gst_rate').notNull().default(0.1),
  gstAmount: integer('gst_amount').notNull().default(0),
  accountCode: text('account_code'),
  taxCode: text('tax_code'),
});

export const invoiceNumberSequences = sqliteTable('invoice_number_sequences', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  prefix: text('prefix').notNull().default('INV-'),
  nextNumber: integer('next_number').notNull().default(1),
  format: text('format').notNull().default('{prefix}{number:06d}'),
});

export const invoicePayments = sqliteTable('invoice_payments', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  paymentDate: text('payment_date').notNull(),
  amount: integer('amount').notNull(),
  paymentMethod: text('payment_method'),
  reference: text('reference'),
  transactionId: text('transaction_id').references(() => transactions.id),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});
```

- [ ] Add type exports at the end of the TYPE EXPORTS section:

```typescript
// Customers & Invoicing
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerContact = typeof customerContacts.$inferSelect;
export type NewCustomerContact = typeof customerContacts.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type NewInvoiceLine = typeof invoiceLines.$inferInsert;
export type InvoiceNumberSequence = typeof invoiceNumberSequences.$inferSelect;
export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type NewInvoicePayment = typeof invoicePayments.$inferInsert;
```

### 3. `server/src/db/postgres-schema.ts`
**Purpose**: Add matching pgTable definitions for all 6 new tables
**Pattern**: Follow existing tables — use `pgTable()`, `timestamp(..., { withTimezone: true })`, `boolean()`, include indexes

- [ ] Add `customers` pgTable with PG types (boolean instead of integer, timestamp instead of text)
- [ ] Add `customerContacts` pgTable
- [ ] Add `invoices` pgTable
- [ ] Add `invoiceLines` pgTable
- [ ] Add `invoiceNumberSequences` pgTable
- [ ] Add `invoicePayments` pgTable
- [ ] Add matching type exports

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean (no new errors from schema additions)
- [ ] Migration file `0019_customers_invoices.sql` is valid PostgreSQL syntax
- [ ] All 6 sqliteTable definitions compile correctly
- [ ] All type exports (select + insert) resolve correctly
- [ ] Table names EXACTLY match: `customers`, `customer_contacts`, `invoices`, `invoice_lines`, `invoice_number_sequences`, `invoice_payments`
- [ ] Create marker file: `.agent-done-W07-01`

## Dependencies
- **None** — can start immediately
- **Reuses**: schema.ts patterns, postgres-schema.ts patterns, migration conventions
