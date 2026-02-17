/**
 * Invoicing Service — Core Service Class
 * Thin orchestrator delegating to invoice-mutations and invoice-queries.
 */

import type {
  InvoicePayment,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  RecordPaymentInput,
  CreateCreditNoteInput,
  InvoiceWithLines,
  InvoiceWithCustomer,
  InvoiceSummary,
} from './types.js';
import {
  getNextInvoiceNumber,
  createInvoice,
  updateInvoice,
  sendInvoice,
  voidInvoice,
  recordPayment,
  createCreditNote,
} from './invoice-mutations.js';
import {
  getInvoice,
  listInvoices,
  checkOverdueInvoices,
  getInvoiceSummary,
} from './invoice-queries.js';

// ============================================================================
// InvoicingService
// ============================================================================

export class InvoicingService {
  async getNextInvoiceNumber(userId: string): Promise<string> {
    return getNextInvoiceNumber(userId);
  }

  async createInvoice(userId: string, data: CreateInvoiceInput): Promise<InvoiceWithLines> {
    return createInvoice(userId, data);
  }

  async getInvoice(userId: string, invoiceId: string): Promise<InvoiceWithLines | null> {
    return getInvoice(userId, invoiceId);
  }

  async listInvoices(
    userId: string,
    options: {
      offset?: number;
      limit?: number;
      status?: string;
      customerId?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {},
  ): Promise<{ data: InvoiceWithCustomer[]; total: number }> {
    return listInvoices(userId, options);
  }

  async updateInvoice(
    userId: string,
    invoiceId: string,
    data: UpdateInvoiceInput,
  ): Promise<InvoiceWithLines> {
    return updateInvoice(userId, invoiceId, data, getInvoice);
  }

  async sendInvoice(userId: string, invoiceId: string): Promise<void> {
    return sendInvoice(userId, invoiceId);
  }

  async voidInvoice(userId: string, invoiceId: string): Promise<InvoiceWithLines> {
    return voidInvoice(userId, invoiceId);
  }

  async recordPayment(
    userId: string,
    invoiceId: string,
    data: RecordPaymentInput,
  ): Promise<InvoicePayment> {
    return recordPayment(userId, invoiceId, data);
  }

  async createCreditNote(userId: string, data: CreateCreditNoteInput): Promise<InvoiceWithLines> {
    return createCreditNote(userId, data);
  }

  async checkOverdueInvoices(
    userId: string,
  ): Promise<{ id: string; invoiceNumber: string; amountDue: number; daysOverdue: number }[]> {
    return checkOverdueInvoices(userId);
  }

  async getInvoiceSummary(userId: string): Promise<InvoiceSummary> {
    return getInvoiceSummary(userId);
  }
}

// Singleton export
export const invoicingService = new InvoicingService();
