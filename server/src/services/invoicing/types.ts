/**
 * Invoicing Service — Type Definitions
 */

import type { invoices, invoiceLines, customers, invoicePayments } from '../../schema.js';

export type Invoice = typeof invoices.$inferSelect;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type InvoicePayment = typeof invoicePayments.$inferSelect;

// ============================================================================
// Types
// ============================================================================

export interface CreateLineItemInput {
  description: string;
  quantity: number;
  unitPriceCents: number;
  gstRate?: number; // defaults to 0.1 (10%)
  accountCode?: string;
  taxCode?: string;
}

export interface CreateInvoiceInput {
  customerId: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  termsAndConditions?: string;
  lineItems: CreateLineItemInput[];
}

export interface UpdateInvoiceInput {
  customerId?: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  termsAndConditions?: string;
  lineItems?: CreateLineItemInput[];
}

export interface RecordPaymentInput {
  paymentDate: string;
  amountCents: number;
  paymentMethod?: string;
  reference?: string;
  transactionId?: string;
  notes?: string;
}

export interface CreateCreditNoteInput {
  customerId: string;
  originalInvoiceId?: string;
  lineItems: CreateLineItemInput[];
  notes?: string;
}

export interface InvoiceWithLines {
  invoice: Invoice;
  lines: InvoiceLine[];
  customer?: Customer;
}

export interface InvoiceWithCustomer {
  invoice: Invoice;
  customerName: string;
}

export interface InvoiceSummary {
  totalOutstandingCents: number;
  totalOverdueCents: number;
  revenueThisMonthCents: number;
  counts: {
    draft: number;
    sent: number;
    paid: number;
    overdue: number;
    void: number;
  };
}
