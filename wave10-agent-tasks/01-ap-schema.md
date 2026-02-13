# Agent 1: AP Schema Builder

## Role
Create all 10 accounts payable and purchase order tables in the dual schema system (SQLite + PostgreSQL) plus PostgreSQL migration 0022.

## Priority: WAVE 10 (Start Immediately)

## CRITICAL: Table Naming

These table names MUST be EXACTLY as specified below. Wave 11 (Inventory & Bank Reconciliation) code imports and references these tables directly. Any name deviation will break Wave 11.

Required names: `suppliers`, `bills`, `bill_lines`, `bill_payments`, `purchase_orders`, `po_lines`, `po_receipts`, `po_receipt_lines`, `supplier_payment_runs`, `supplier_payment_run_items`

## Files to CREATE

### 1. `docker/migrations/0022_ap_purchase_orders.sql`
**Purpose**: PostgreSQL migration adding 10 new tables for Accounts Payable
**Pattern**: Follow `docker/migrations/0012_tax_return_platform.sql` — use `CREATE TABLE IF NOT EXISTS`, include indexes, wrap in `BEGIN; ... COMMIT;`

**REVISION NOTE (D04 DEP-01 — Migration Idempotency)**: This migration MUST be idempotent because:
1. Wave 11 migration `0023_inventory_bank_recon.sql` already EXISTS on disk and may reference tables from 0022
2. Migration 0022 may need to be re-run on systems where 0023 was partially applied
3. ALL DDL statements MUST use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`
4. Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for any column additions
5. The migration MUST be safe to run multiple times without errors

- [ ] Create `suppliers` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `business_name TEXT NOT NULL`
  - `contact_name TEXT`
  - `email TEXT`
  - `phone TEXT`
  - `address TEXT`
  - `abn TEXT` (Australian Business Number)
  - `payment_terms_days INTEGER NOT NULL DEFAULT 30`
  - `bank_bsb TEXT`
  - `bank_account_number TEXT` (encrypted at app level)
  - `bank_account_name TEXT`
  - `notes TEXT`
  - `is_active BOOLEAN DEFAULT true`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(user_id, is_active)`
  - INDEX on `(user_id, abn)` WHERE abn IS NOT NULL

- [ ] Create `bills` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `supplier_id TEXT NOT NULL REFERENCES suppliers(id)`
  - `bill_number TEXT`
  - `status TEXT NOT NULL DEFAULT 'draft'` ('draft' | 'awaiting_approval' | 'approved' | 'paid' | 'overdue' | 'void')
  - `issue_date TEXT NOT NULL`
  - `due_date TEXT NOT NULL`
  - `subtotal INTEGER NOT NULL DEFAULT 0` (cents)
  - `gst_amount INTEGER NOT NULL DEFAULT 0` (cents)
  - `total_amount INTEGER NOT NULL DEFAULT 0` (cents)
  - `amount_paid INTEGER NOT NULL DEFAULT 0` (cents)
  - `amount_due INTEGER NOT NULL DEFAULT 0` (cents)
  - `currency TEXT NOT NULL DEFAULT 'AUD'`
  - `notes TEXT`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(user_id, status)`
  - INDEX on `(supplier_id)`
  - INDEX on `(due_date)`

- [ ] Create `bill_lines` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE`
  - `description TEXT NOT NULL`
  - `quantity REAL NOT NULL DEFAULT 1`
  - `unit_price INTEGER NOT NULL DEFAULT 0` (cents)
  - `amount INTEGER NOT NULL DEFAULT 0` (cents)
  - `gst_rate REAL DEFAULT 0.1` (10% GST default)
  - `gst_amount INTEGER DEFAULT 0` (cents)
  - `account_code TEXT`
  - `tax_code TEXT`
  - INDEX on `(bill_id)`

- [ ] Create `bill_payments` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `bill_id TEXT NOT NULL REFERENCES bills(id)`
  - `payment_date TEXT NOT NULL`
  - `amount INTEGER NOT NULL` (cents)
  - `payment_method TEXT` ('bank_transfer' | 'cheque' | 'cash' | 'card')
  - `reference TEXT`
  - `transaction_id TEXT REFERENCES transactions(id)` (links to bank transaction)
  - `notes TEXT`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(bill_id)`
  - INDEX on `(transaction_id)` WHERE transaction_id IS NOT NULL

- [ ] Create `purchase_orders` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `supplier_id TEXT NOT NULL REFERENCES suppliers(id)`
  - `po_number TEXT NOT NULL UNIQUE` (auto-generated: PO-000001)
  - `status TEXT NOT NULL DEFAULT 'draft'` ('draft' | 'sent' | 'partially_received' | 'received' | 'cancelled')
  - `issue_date TEXT NOT NULL`
  - `expected_date TEXT`
  - `subtotal INTEGER NOT NULL DEFAULT 0` (cents)
  - `gst_amount INTEGER NOT NULL DEFAULT 0` (cents)
  - `total_amount INTEGER NOT NULL DEFAULT 0` (cents)
  - `notes TEXT`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(user_id, status)`
  - INDEX on `(supplier_id)`
  - UNIQUE INDEX on `(po_number)`

- [ ] Create `po_lines` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE`
  - `description TEXT NOT NULL`
  - `quantity REAL NOT NULL DEFAULT 1`
  - `unit_price INTEGER NOT NULL DEFAULT 0` (cents)
  - `amount INTEGER NOT NULL DEFAULT 0` (cents)
  - `quantity_received REAL NOT NULL DEFAULT 0`
  - INDEX on `(purchase_order_id)`

- [ ] Create `po_receipts` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id)`
  - `receipt_date TEXT NOT NULL`
  - `received_by TEXT REFERENCES users(id)`
  - `notes TEXT`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(purchase_order_id)`

- [ ] Create `po_receipt_lines` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `receipt_id TEXT NOT NULL REFERENCES po_receipts(id) ON DELETE CASCADE`
  - `po_line_id TEXT NOT NULL REFERENCES po_lines(id)`
  - `quantity_received REAL NOT NULL`
  - INDEX on `(receipt_id)`
  - INDEX on `(po_line_id)` — **REVISION NOTE (D03 B5): This index is CRITICAL for three-way matching JOIN performance. Without it, the three-way match query becomes O(n²). Must be included in migration 0022.**

- [ ] Create `supplier_payment_runs` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `payment_date TEXT NOT NULL`
  - `status TEXT NOT NULL DEFAULT 'draft'` ('draft' | 'processing' | 'completed')
  - `total_amount INTEGER NOT NULL DEFAULT 0` (cents)
  - `bank_reference TEXT`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(user_id, status)`
  - INDEX on `(payment_date)`

- [ ] Create `supplier_payment_run_items` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `payment_run_id TEXT NOT NULL REFERENCES supplier_payment_runs(id) ON DELETE CASCADE`
  - `bill_id TEXT NOT NULL REFERENCES bills(id)`
  - `amount INTEGER NOT NULL` (cents)
  - INDEX on `(payment_run_id)`
  - INDEX on `(bill_id)`

## Files to MODIFY

### 2. `server/src/schema.ts`
**Purpose**: Add 10 new `sqliteTable()` definitions
**Location**: Insert BEFORE the TYPE EXPORTS section

```typescript
// ============================================================================
// ACCOUNTS PAYABLE & PURCHASE ORDERS (Wave 10)
// ============================================================================

export const suppliers = sqliteTable('suppliers', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessName: text('business_name').notNull(),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  abn: text('abn'),
  paymentTermsDays: integer('payment_terms_days').notNull().default(30),
  bankBsb: text('bank_bsb'),
  bankAccountNumber: text('bank_account_number'),
  bankAccountName: text('bank_account_name'),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const bills = sqliteTable('bills', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id),
  billNumber: text('bill_number'),
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
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const billLines = sqliteTable('bill_lines', {
  id: text('id').primaryKey(),
  billId: text('bill_id').notNull().references(() => bills.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: real('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull().default(0),
  amount: integer('amount').notNull().default(0),
  gstRate: real('gst_rate').default(0.1),
  gstAmount: integer('gst_amount').default(0),
  accountCode: text('account_code'),
  taxCode: text('tax_code'),
});

export const billPayments = sqliteTable('bill_payments', {
  id: text('id').primaryKey(),
  billId: text('bill_id').notNull().references(() => bills.id),
  paymentDate: text('payment_date').notNull(),
  amount: integer('amount').notNull(),
  paymentMethod: text('payment_method'),
  reference: text('reference'),
  transactionId: text('transaction_id').references(() => transactions.id),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const purchaseOrders = sqliteTable('purchase_orders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id),
  poNumber: text('po_number').notNull().unique(),
  status: text('status').notNull().default('draft'),
  issueDate: text('issue_date').notNull(),
  expectedDate: text('expected_date'),
  subtotal: integer('subtotal').notNull().default(0),
  gstAmount: integer('gst_amount').notNull().default(0),
  totalAmount: integer('total_amount').notNull().default(0),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const poLines = sqliteTable('po_lines', {
  id: text('id').primaryKey(),
  purchaseOrderId: text('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: real('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull().default(0),
  amount: integer('amount').notNull().default(0),
  quantityReceived: real('quantity_received').notNull().default(0),
});

export const poReceipts = sqliteTable('po_receipts', {
  id: text('id').primaryKey(),
  purchaseOrderId: text('purchase_order_id').notNull().references(() => purchaseOrders.id),
  receiptDate: text('receipt_date').notNull(),
  receivedBy: text('received_by').references(() => users.id),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const poReceiptLines = sqliteTable('po_receipt_lines', {
  id: text('id').primaryKey(),
  receiptId: text('receipt_id').notNull().references(() => poReceipts.id, { onDelete: 'cascade' }),
  poLineId: text('po_line_id').notNull().references(() => poLines.id),
  quantityReceived: real('quantity_received').notNull(),
});

export const supplierPaymentRuns = sqliteTable('supplier_payment_runs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  paymentDate: text('payment_date').notNull(),
  status: text('status').notNull().default('draft'),
  totalAmount: integer('total_amount').notNull().default(0),
  bankReference: text('bank_reference'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const supplierPaymentRunItems = sqliteTable('supplier_payment_run_items', {
  id: text('id').primaryKey(),
  paymentRunId: text('payment_run_id').notNull().references(() => supplierPaymentRuns.id, { onDelete: 'cascade' }),
  billId: text('bill_id').notNull().references(() => bills.id),
  amount: integer('amount').notNull(),
});
```

- [ ] Add type exports at the end of the TYPE EXPORTS section:

```typescript
// Accounts Payable & Purchase Orders
export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type BillLine = typeof billLines.$inferSelect;
export type NewBillLine = typeof billLines.$inferInsert;
export type BillPayment = typeof billPayments.$inferSelect;
export type NewBillPayment = typeof billPayments.$inferInsert;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type POLine = typeof poLines.$inferSelect;
export type NewPOLine = typeof poLines.$inferInsert;
export type POReceipt = typeof poReceipts.$inferSelect;
export type NewPOReceipt = typeof poReceipts.$inferInsert;
export type POReceiptLine = typeof poReceiptLines.$inferSelect;
export type NewPOReceiptLine = typeof poReceiptLines.$inferInsert;
export type SupplierPaymentRun = typeof supplierPaymentRuns.$inferSelect;
export type NewSupplierPaymentRun = typeof supplierPaymentRuns.$inferInsert;
export type SupplierPaymentRunItem = typeof supplierPaymentRunItems.$inferSelect;
export type NewSupplierPaymentRunItem = typeof supplierPaymentRunItems.$inferInsert;
```

### 3. `server/src/db/postgres-schema.ts`
**Purpose**: Add matching pgTable definitions for all 10 new tables
**Pattern**: Follow existing tables — use `pgTable()`, `timestamp(..., { withTimezone: true })`, `boolean()`, include indexes

- [ ] Add all 10 pgTable definitions with PG types
- [ ] Add matching type exports

### 4. `server/src/index.ts`
**Purpose**: Add schema imports for new tables
**Modify the import statement** to include all 10 new table names

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Migration file is valid PostgreSQL syntax
- [ ] All 10 sqliteTable definitions compile correctly
- [ ] All 20 type exports (10 select + 10 insert) resolve correctly
- [ ] Table names match EXACTLY: suppliers, bills, bill_lines, bill_payments, purchase_orders, po_lines, po_receipts, po_receipt_lines, supplier_payment_runs, supplier_payment_run_items
- [ ] Create marker file: `.agent-done-W10-01`

## Dependencies
- **None** — can start immediately
- **Note**: `users` and `transactions` tables must already exist (core tables)
