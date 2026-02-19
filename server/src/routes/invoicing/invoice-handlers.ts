import type { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import {
  InvoicingService,
  type CreateInvoiceInput,
  type CreateCreditNoteInput,
  type RecordPaymentInput,
} from '../../services/invoicing.js';
import { InvoicePDFService } from '../../services/invoice-pdf.js';
import { db, businessProfiles } from '../../schema.js';
import { eq } from 'drizzle-orm';
import {
  paginationSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  recordPaymentSchema,
  createCreditNoteSchema,
} from '../../validation/features/invoicing.js';
import { getUserId } from './helpers.js';

const invoicingService = new InvoicingService();
const invoicePDFService = new InvoicePDFService();

export function registerInvoiceHandlers(app: Hono): void {
  // GET /invoices — paginated list with filters
  app.get('/invoices', zValidator('query', paginationSchema), async (c) => {
    const userId = getUserId(c);
    const { page, limit } = c.req.valid('query');
    const offset = (page - 1) * limit;

    const status = c.req.query('status') || undefined;
    const customerId = c.req.query('customerId') || undefined;
    const dateFrom = c.req.query('dateFrom') || undefined;
    const dateTo = c.req.query('dateTo') || undefined;

    const result = await invoicingService.listInvoices(userId, {
      offset,
      limit,
      status,
      customerId,
      dateFrom,
      dateTo,
    });
    return c.json(result);
  });

  // POST /invoices — create invoice with line items
  app.post('/invoices', zValidator('json', createInvoiceSchema), async (c) => {
    const userId = getUserId(c);
    const data = c.req.valid('json');
    const invoice = await invoicingService.createInvoice(
      userId,
      data as unknown as CreateInvoiceInput,
    );
    return c.json(invoice, 201);
  });

  // GET /invoices/next-number — MUST be BEFORE /invoices/:id to avoid route conflict
  app.get('/invoices/next-number', async (c) => {
    const userId = getUserId(c);
    const nextNumber = await invoicingService.getNextInvoiceNumber(userId);
    return c.json({ nextNumber });
  });

  // POST /invoices/credit-note — create credit note (BEFORE :id routes)
  app.post('/invoices/credit-note', zValidator('json', createCreditNoteSchema), async (c) => {
    const userId = getUserId(c);
    const data = c.req.valid('json');
    const creditNote = await invoicingService.createCreditNote(
      userId,
      data as unknown as CreateCreditNoteInput,
    );
    return c.json(creditNote, 201);
  });

  // GET /invoices/:id — get invoice with lines + customer
  app.get('/invoices/:id', async (c) => {
    const userId = getUserId(c);
    const invoiceId = c.req.param('id');
    const result = await invoicingService.getInvoice(userId, invoiceId);
    if (!result) {
      return c.json({ error: 'Invoice not found' }, 404);
    }
    return c.json(result);
  });

  // PATCH /invoices/:id — update draft invoice
  app.patch('/invoices/:id', zValidator('json', updateInvoiceSchema), async (c) => {
    try {
      const userId = getUserId(c);
      const invoiceId = c.req.param('id');
      const data = c.req.valid('json');
      const result = await invoicingService.updateInvoice(userId, invoiceId, data);
      return c.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found')) return c.json({ error: msg }, 404);
      if (msg.includes('Cannot update')) return c.json({ error: msg }, 400);
      return c.json({ error: msg || 'Failed to update invoice' }, 500);
    }
  });

  // POST /invoices/:id/send — mark as sent
  app.post('/invoices/:id/send', zValidator('json', z.object({}).optional()), async (c) => {
    try {
      const userId = getUserId(c);
      const invoiceId = c.req.param('id');
      const result = await invoicingService.sendInvoice(userId, invoiceId);
      return c.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found')) return c.json({ error: msg }, 404);
      if (msg.includes('Cannot send')) return c.json({ error: msg }, 400);
      return c.json({ error: msg || 'Failed to send invoice' }, 500);
    }
  });

  // POST /invoices/:id/void — void invoice
  app.post('/invoices/:id/void', zValidator('json', z.object({}).optional()), async (c) => {
    try {
      const userId = getUserId(c);
      const invoiceId = c.req.param('id');
      const result = await invoicingService.voidInvoice(userId, invoiceId);
      return c.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found')) return c.json({ error: msg }, 404);
      if (msg.includes('Cannot void') || msg.includes('already void'))
        return c.json({ error: msg }, 400);
      return c.json({ error: msg || 'Failed to void invoice' }, 500);
    }
  });

  // GET /invoices/:id/pdf — generate and serve PDF
  app.get('/invoices/:id/pdf', async (c) => {
    try {
      const userId = getUserId(c);
      const invoiceId = c.req.param('id');

      const invoiceData = await invoicingService.getInvoice(userId, invoiceId);
      if (!invoiceData) {
        return c.json({ error: 'Invoice not found' }, 404);
      }

      const profile = await db
        .select()
        .from(businessProfiles)
        .where(eq(businessProfiles.userId, userId))
        .get();

      const pdfBuffer = await invoicePDFService.generateInvoicePDF(
        invoiceData,
        profile ?? undefined,
      );
      await invoicePDFService.saveInvoicePDF(invoiceId, pdfBuffer);

      const invoiceNumber = invoiceData.invoice?.invoiceNumber ?? invoiceId;
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `attachment; filename="invoice-${invoiceNumber}.pdf"`);
      return c.body(new Uint8Array(pdfBuffer));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found')) return c.json({ error: msg }, 404);
      return c.json({ error: msg || 'Failed to generate PDF' }, 500);
    }
  });

  // POST /invoices/:id/payment — record payment
  app.post('/invoices/:id/payment', zValidator('json', recordPaymentSchema), async (c) => {
    try {
      const userId = getUserId(c);
      const invoiceId = c.req.param('id');
      const data = c.req.valid('json');
      const payment = await invoicingService.recordPayment(
        userId,
        invoiceId,
        data as unknown as RecordPaymentInput,
      );
      return c.json(payment, 201);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found')) return c.json({ error: msg }, 404);
      if (msg.includes('Cannot record')) return c.json({ error: msg }, 400);
      return c.json({ error: msg || 'Failed to record payment' }, 500);
    }
  });
}
