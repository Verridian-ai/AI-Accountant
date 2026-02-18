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
// CUSTOMER MANAGEMENT & INVOICING (Wave 7)
// =============================================================================

export const pgCustomers = pgTable(
  'customers',
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
    city: text('city'),
    state: text('state'),
    postcode: text('postcode'),
    country: text('country').notNull().default('AU'),
    abn: text('abn'),
    paymentTermsDays: integer('payment_terms_days').notNull().default(30),
    notes: text('notes'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userActiveIdx: index('idx_customers_user_active').on(table.userId, table.isActive),
    userAbnIdx: index('idx_customers_user_abn').on(table.userId, table.abn),
    userEmailIdx: index('idx_customers_user_email').on(table.userId, table.email),
  }),
);

export const pgCustomerContacts = pgTable(
  'customer_contacts',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => pgCustomers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    role: text('role'),
    isPrimary: boolean('is_primary').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    customerIdx: index('idx_customer_contacts_customer').on(table.customerId),
  }),
);

export const pgInvoices = pgTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => pgCustomers.id),
    invoiceNumber: text('invoice_number').notNull().unique(),
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
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userStatusIdx: index('idx_invoices_user_status').on(table.userId, table.status),
    customerIdx: index('idx_invoices_customer').on(table.customerId),
    dueDateIdx: index('idx_invoices_due_date').on(table.dueDate),
  }),
);

export const pgInvoiceLines = pgTable(
  'invoice_lines',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => pgInvoices.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    quantity: real('quantity').notNull().default(1),
    unitPrice: integer('unit_price').notNull().default(0),
    amount: integer('amount').notNull().default(0),
    gstRate: real('gst_rate').notNull().default(0.1),
    gstAmount: integer('gst_amount').notNull().default(0),
    accountCode: text('account_code'),
    taxCode: text('tax_code'),
  },
  (table) => ({
    invoiceIdx: index('idx_invoice_lines_invoice').on(table.invoiceId),
  }),
);

export const pgInvoiceNumberSequences = pgTable(
  'invoice_number_sequences',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    prefix: text('prefix').notNull().default('INV-'),
    nextNumber: integer('next_number').notNull().default(1),
    format: text('format').notNull().default('{prefix}{number:06d}'),
  },
  (table) => ({
    userIdx: uniqueIndex('idx_invoice_sequences_user').on(table.userId),
  }),
);

export const pgInvoicePayments = pgTable(
  'invoice_payments',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => pgInvoices.id, { onDelete: 'cascade' }),
    paymentDate: text('payment_date').notNull(),
    amount: integer('amount').notNull(),
    paymentMethod: text('payment_method'),
    reference: text('reference'),
    transactionId: text('transaction_id').references(() => transactions.id),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    invoiceIdx: index('idx_invoice_payments_invoice').on(table.invoiceId),
    transactionIdx: index('idx_invoice_payments_transaction').on(table.transactionId),
  }),
);

export type PgCustomer = typeof pgCustomers.$inferSelect;
export type NewPgCustomer = typeof pgCustomers.$inferInsert;
export type PgCustomerContact = typeof pgCustomerContacts.$inferSelect;
export type NewPgCustomerContact = typeof pgCustomerContacts.$inferInsert;
export type PgInvoice = typeof pgInvoices.$inferSelect;
export type NewPgInvoice = typeof pgInvoices.$inferInsert;
export type PgInvoiceLine = typeof pgInvoiceLines.$inferSelect;
export type NewPgInvoiceLine = typeof pgInvoiceLines.$inferInsert;
export type PgInvoiceNumberSequence = typeof pgInvoiceNumberSequences.$inferSelect;
export type NewPgInvoiceNumberSequence = typeof pgInvoiceNumberSequences.$inferInsert;
export type PgInvoicePayment = typeof pgInvoicePayments.$inferSelect;
export type NewPgInvoicePayment = typeof pgInvoicePayments.$inferInsert;
