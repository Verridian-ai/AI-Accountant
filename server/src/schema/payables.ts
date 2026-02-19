import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { users } from './core.js';

// IMPORTANT — CURRENT_TIMESTAMP in PostgreSQL:
// The wrapPgDb() proxy stores the literal string 'CURRENT_TIMESTAMP' in PostgreSQL
// instead of evaluating it. All inserts MUST set timestamp fields explicitly:
//   createdAt: new Date().toISOString()   (see repositories/*.ts)

// ============================================================================
// ACCOUNTS PAYABLE & PURCHASE ORDERS (Wave 10)
// ============================================================================

export const suppliers = sqliteTable('suppliers', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  businessName: text('business_name'),
  contactName: text('contact_name'),
  abn: text('abn'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  paymentTerms: text('payment_terms'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  tenantId: text('tenant_id'),
});

export const bills = sqliteTable('bills', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  supplierId: text('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  billNumber: text('bill_number'),
  billDate: text('bill_date').notNull(),
  issueDate: text('issue_date'),
  dueDate: text('due_date').notNull(),
  subtotal: integer('subtotal').notNull().default(0),
  gstAmount: integer('gst_amount').notNull().default(0),
  totalAmount: integer('total_amount').notNull().default(0),
  amountDue: integer('amount_due'),
  status: text('status').notNull().default('draft'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  tenantId: text('tenant_id'),
});

export const billLines = sqliteTable(
  'bill_lines',
  {
    id: text('id').primaryKey(),
    billId: text('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    quantity: real('quantity').notNull().default(1),
    unitPrice: integer('unit_price').notNull().default(0),
    amount: integer('amount').notNull().default(0),
    taxCode: text('tax_code'),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (t) => ({
    billIdx: index('idx_bill_lines_bill_id').on(t.billId),
  }),
);

export const billPayments = sqliteTable('bill_payments', {
  id: text('id').primaryKey(),
  billId: text('bill_id')
    .notNull()
    .references(() => bills.id),
  paymentDate: text('payment_date').notNull(),
  amount: integer('amount').notNull(),
  paymentMethod: text('payment_method'),
  reference: text('reference'),
  transactionId: text('transaction_id'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const purchaseOrders = sqliteTable('purchase_orders', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  supplierId: text('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  poNumber: text('po_number').notNull().unique(),
  issueDate: text('issue_date').notNull(),
  expectedDate: text('expected_date'),
  status: text('status').notNull().default('draft'),
  subtotal: integer('subtotal').notNull().default(0),
  gstAmount: integer('gst_amount').notNull().default(0),
  totalAmount: integer('total_amount').notNull().default(0),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at'),
});

export const poLines = sqliteTable('po_lines', {
  id: text('id').primaryKey(),
  purchaseOrderId: text('po_id')
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: real('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull().default(0),
  amount: integer('amount').notNull().default(0),
  quantityReceived: real('quantity_received').default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const poReceipts = sqliteTable('po_receipts', {
  id: text('id').primaryKey(),
  purchaseOrderId: text('po_id')
    .notNull()
    .references(() => purchaseOrders.id),
  receiptDate: text('receipt_date').notNull(),
  receivedBy: text('received_by').references(() => users.id),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const poReceiptLines = sqliteTable('po_receipt_lines', {
  id: text('id').primaryKey(),
  receiptId: text('receipt_id')
    .notNull()
    .references(() => poReceipts.id, { onDelete: 'cascade' }),
  poLineId: text('po_line_id')
    .notNull()
    .references(() => poLines.id),
  quantityReceived: real('quantity_received').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const supplierPaymentRuns = sqliteTable('supplier_payment_runs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  runDate: text('run_date').notNull(),
  status: text('status').notNull().default('draft'),
  totalAmount: integer('total_amount').notNull().default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const supplierPaymentRunItems = sqliteTable('supplier_payment_run_items', {
  id: text('id').primaryKey(),
  paymentRunId: text('run_id')
    .notNull()
    .references(() => supplierPaymentRuns.id, { onDelete: 'cascade' }),
  billId: text('bill_id')
    .notNull()
    .references(() => bills.id),
  amount: integer('amount').notNull(),
});

// Type exports
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
