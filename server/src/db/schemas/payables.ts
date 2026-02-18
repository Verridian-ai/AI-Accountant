import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './core.js';
import { transactions } from './banking.js';

// =============================================================================
// ACCOUNTS PAYABLE & PURCHASE ORDERS (Wave 10)
// =============================================================================

export const suppliers = pgTable(
  'suppliers',
  {
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
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userActiveIdx: index('idx_suppliers_user_active').on(table.userId, table.isActive),
    userAbnIdx: index('idx_suppliers_user_abn').on(table.userId, table.abn),
  }),
);

export const bills = pgTable(
  'bills',
  {
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
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userStatusIdx: index('idx_bills_user_status').on(table.userId, table.status),
    supplierIdx: index('idx_bills_supplier').on(table.supplierId),
    dueDateIdx: index('idx_bills_due_date').on(table.dueDate),
  }),
);

export const billLines = pgTable(
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
  (table) => ({
    billIdx: index('idx_bill_lines_bill').on(table.billId),
  }),
);

export const billPayments = pgTable(
  'bill_payments',
  {
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
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    billIdx: index('idx_bill_payments_bill').on(table.billId),
    transactionIdx: index('idx_bill_payments_transaction').on(table.transactionId),
  }),
);

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
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
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userStatusIdx: index('idx_purchase_orders_user_status').on(table.userId, table.status),
    supplierIdx: index('idx_purchase_orders_supplier').on(table.supplierId),
    poNumberIdx: uniqueIndex('idx_purchase_orders_po_number').on(table.poNumber),
  }),
);

export const poLines = pgTable(
  'po_lines',
  {
    id: text('id').primaryKey(),
    purchaseOrderId: text('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    quantity: real('quantity').notNull().default(1),
    unitPrice: integer('unit_price').notNull().default(0),
    amount: integer('amount').notNull().default(0),
    quantityReceived: real('quantity_received').notNull().default(0),
  },
  (table) => ({
    purchaseOrderIdx: index('idx_po_lines_purchase_order').on(table.purchaseOrderId),
  }),
);

export const poReceipts = pgTable(
  'po_receipts',
  {
    id: text('id').primaryKey(),
    purchaseOrderId: text('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id),
    receiptDate: text('receipt_date').notNull(),
    receivedBy: text('received_by').references(() => users.id),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    purchaseOrderIdx: index('idx_po_receipts_purchase_order').on(table.purchaseOrderId),
  }),
);

export const poReceiptLines = pgTable(
  'po_receipt_lines',
  {
    id: text('id').primaryKey(),
    receiptId: text('receipt_id')
      .notNull()
      .references(() => poReceipts.id, { onDelete: 'cascade' }),
    poLineId: text('po_line_id')
      .notNull()
      .references(() => poLines.id),
    quantityReceived: real('quantity_received').notNull(),
  },
  (table) => ({
    receiptIdx: index('idx_po_receipt_lines_receipt').on(table.receiptId),
    poLineIdx: index('idx_po_receipt_lines_po_line').on(table.poLineId),
  }),
);

export const supplierPaymentRuns = pgTable(
  'supplier_payment_runs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    paymentDate: text('payment_date').notNull(),
    status: text('status').notNull().default('draft'),
    totalAmount: integer('total_amount').notNull().default(0),
    bankReference: text('bank_reference'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userStatusIdx: index('idx_supplier_payment_runs_user_status').on(table.userId, table.status),
    dateIdx: index('idx_supplier_payment_runs_date').on(table.paymentDate),
  }),
);

export const supplierPaymentRunItems = pgTable(
  'supplier_payment_run_items',
  {
    id: text('id').primaryKey(),
    paymentRunId: text('payment_run_id')
      .notNull()
      .references(() => supplierPaymentRuns.id, { onDelete: 'cascade' }),
    billId: text('bill_id')
      .notNull()
      .references(() => bills.id),
    amount: integer('amount').notNull(),
  },
  (table) => ({
    runIdx: index('idx_supplier_payment_run_items_run').on(table.paymentRunId),
    billIdx: index('idx_supplier_payment_run_items_bill').on(table.billId),
  }),
);

export type PgSupplier = typeof suppliers.$inferSelect;
export type NewPgSupplier = typeof suppliers.$inferInsert;
export type PgBill = typeof bills.$inferSelect;
export type NewPgBill = typeof bills.$inferInsert;
export type PgBillLine = typeof billLines.$inferSelect;
export type NewPgBillLine = typeof billLines.$inferInsert;
export type PgBillPayment = typeof billPayments.$inferSelect;
export type NewPgBillPayment = typeof billPayments.$inferInsert;
export type PgPurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPgPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type PgPOLine = typeof poLines.$inferSelect;
export type NewPgPOLine = typeof poLines.$inferInsert;
export type PgPOReceipt = typeof poReceipts.$inferSelect;
export type NewPgPOReceipt = typeof poReceipts.$inferInsert;
export type PgPOReceiptLine = typeof poReceiptLines.$inferSelect;
export type NewPgPOReceiptLine = typeof poReceiptLines.$inferInsert;
export type PgSupplierPaymentRun = typeof supplierPaymentRuns.$inferSelect;
export type NewPgSupplierPaymentRun = typeof supplierPaymentRuns.$inferInsert;
export type PgSupplierPaymentRunItem = typeof supplierPaymentRunItems.$inferSelect;
export type NewPgSupplierPaymentRunItem = typeof supplierPaymentRunItems.$inferInsert;
