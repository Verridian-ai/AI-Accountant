import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { users } from './core.js';
import { transactions } from './transactions.js';

// IMPORTANT — CURRENT_TIMESTAMP in PostgreSQL:
// The wrapPgDb() proxy stores the literal string 'CURRENT_TIMESTAMP' in PostgreSQL
// instead of evaluating it. All inserts MUST set timestamp fields explicitly:
//   createdAt: new Date().toISOString()   (see repositories/*.ts)

// ============================================================================
// CUSTOMER MANAGEMENT & INVOICING (Wave 7)
// ============================================================================

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  abn: text('abn'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  paymentTerms: text('payment_terms'),
  businessName: text('business_name'),
  contactName: text('contact_name'),
  city: text('city'),
  state: text('state'),
  postcode: text('postcode'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  tenantId: text('tenant_id'),
});

export const customerContacts = sqliteTable('customer_contacts', {
  id: text('id').primaryKey(),
  customerId: text('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  customerId: text('customer_id')
    .notNull()
    .references(() => customers.id),
  invoiceNumber: text('invoice_number').notNull(),
  issueDate: text('invoice_date').notNull(),
  dueDate: text('due_date').notNull(),
  subtotal: integer('subtotal').notNull().default(0),
  gstAmount: integer('gst_amount').notNull().default(0),
  totalAmount: integer('total_amount').notNull().default(0),
  amountPaid: integer('amount_paid').default(0),
  amountDue: integer('amount_due'),
  status: text('status').notNull().default('draft'),
  termsAndConditions: text('terms_and_conditions'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  tenantId: text('tenant_id'),
});

export const invoiceLines = sqliteTable(
  'invoice_lines',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    quantity: real('quantity').notNull().default(1),
    unitPrice: integer('unit_price').notNull().default(0),
    amount: integer('amount').notNull().default(0),
    gstAmount: integer('gst_amount').default(0),
    taxCode: text('tax_code'),
    createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  },
  (t) => ({
    invoiceIdx: index('idx_invoice_lines_invoice_id').on(t.invoiceId),
  }),
);

export const invoiceNumberSequences = sqliteTable('invoice_number_sequences', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  prefix: text('prefix').notNull().default('INV-'),
  nextNumber: integer('next_number').notNull().default(1),
  format: text('format').notNull().default('{prefix}{number:06d}'),
});

export const invoicePayments = sqliteTable('invoice_payments', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  paymentDate: text('payment_date').notNull(),
  amount: integer('amount').notNull(),
  paymentMethod: text('payment_method'),
  reference: text('reference'),
  transactionId: text('transaction_id').references(() => transactions.id),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Type exports
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
