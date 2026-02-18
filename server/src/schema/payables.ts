import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { users } from './core.js';
import { transactions } from './transactions.js';

// ============================================================================
// ACCOUNTS PAYABLE & PURCHASE ORDERS (Wave 10)
// ============================================================================

export const suppliers = sqliteTable('suppliers', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
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
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  supplierId: text('supplier_id')
    .notNull()
    .references(() => suppliers.id),
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
    gstRate: real('gst_rate').default(0.1),
    gstAmount: integer('gst_amount').default(0),
    accountCode: text('account_code'),
    taxCode: text('tax_code'),
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
  transactionId: text('transaction_id').references(() => transactions.id),
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
  purchaseOrderId: text('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: real('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull().default(0),
  amount: integer('amount').notNull().default(0),
  quantityReceived: real('quantity_received').notNull().default(0),
});

export const poReceipts = sqliteTable('po_receipts', {
  id: text('id').primaryKey(),
  purchaseOrderId: text('purchase_order_id')
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
});

export const supplierPaymentRuns = sqliteTable('supplier_payment_runs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  paymentDate: text('payment_date').notNull(),
  status: text('status').notNull().default('draft'),
  totalAmount: integer('total_amount').notNull().default(0),
  bankReference: text('bank_reference'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const supplierPaymentRunItems = sqliteTable('supplier_payment_run_items', {
  id: text('id').primaryKey(),
  paymentRunId: text('payment_run_id')
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
