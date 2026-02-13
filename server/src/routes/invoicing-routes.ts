/**
 * Invoicing Routes — Wave 7
 * 17 API endpoints for customer management and invoice lifecycle.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { CustomerService } from '../services/customers.js';
import { InvoicingService } from '../services/invoicing.js';
import { InvoicePDFService } from '../services/invoice-pdf.js';
import { db, businessProfiles } from '../schema.js';
import { eq } from 'drizzle-orm';

const invoicingRoutes = new Hono();

// Service instances
const customerService = new CustomerService();
const invoicingService = new InvoicingService();
const invoicePDFService = new InvoicePDFService();

// ============================================================================
// Zod Schemas
// ============================================================================

const paginationSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const createCustomerSchema = z.object({
  businessName: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().default('AU'),
  abn: z
    .string()
    .regex(/^\d{11}$/)
    .optional(),
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  notes: z.string().optional(),
});

const updateCustomerSchema = createCustomerSchema.partial();

const createContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().min(0),
  gstRate: z.number().min(0).max(1).default(0.1),
  accountCode: z.string().optional(),
  taxCode: z.string().optional(),
});

const createInvoiceSchema = z.object({
  customerId: z.string().min(1),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1),
});

const updateInvoiceSchema = z.object({
  customerId: z.string().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
});

const recordPaymentSchema = z.object({
  paymentDate: z.string().min(1),
  amountCents: z.number().int().positive(),
  paymentMethod: z.string().optional(),
  reference: z.string().optional(),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
});

const createCreditNoteSchema = z.object({
  customerId: z.string().min(1),
  originalInvoiceId: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1),
  notes: z.string().optional(),
});

// Helper: extract userId from JWT payload
function getUserId(c: any): string {
  const payload = c.get('jwtPayload');
  return payload?.userId ?? 'default-user';
}

// ============================================================================
// CUSTOMER ENDPOINTS (7)
// ============================================================================

// 1. GET /customers — paginated list
invoicingRoutes.get('/customers', async (c) => {
  try {
    const userId = getUserId(c);
    const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10));
    const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '50', 10)), 100);
    const search = c.req.query('search') || undefined;
    const isActiveParam = c.req.query('isActive');
    const isActive =
      isActiveParam === 'false' ? false : isActiveParam === 'true' ? true : undefined;

    const result = await customerService.listCustomers(userId, { offset, limit, search, isActive });
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message ?? 'Failed to list customers' }, 500);
  }
});

// 2. POST /customers — create customer
invoicingRoutes.post('/customers', zValidator('json', createCustomerSchema), async (c) => {
  try {
    const userId = getUserId(c);
    const data = c.req.valid('json');
    const customer = await customerService.createCustomer(userId, data);
    return c.json(customer, 201);
  } catch (err: any) {
    const status = err.message?.includes('ABN') ? 400 : 500;
    return c.json({ error: err.message ?? 'Failed to create customer' }, status);
  }
});

// 3. GET /customers/:id — get customer with balance
invoicingRoutes.get('/customers/:id', async (c) => {
  try {
    const userId = getUserId(c);
    const customerId = c.req.param('id');
    const result = await customerService.getCustomerWithBalance(userId, customerId);
    return c.json(result);
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      return c.json({ error: err.message }, 404);
    }
    return c.json({ error: err.message ?? 'Failed to get customer' }, 500);
  }
});

// 4. PATCH /customers/:id — update customer
invoicingRoutes.patch('/customers/:id', zValidator('json', updateCustomerSchema), async (c) => {
  try {
    const userId = getUserId(c);
    const customerId = c.req.param('id');
    const data = c.req.valid('json');
    const customer = await customerService.updateCustomer(userId, customerId, data);
    return c.json(customer);
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      return c.json({ error: err.message }, 404);
    }
    const status = err.message?.includes('ABN') ? 400 : 500;
    return c.json({ error: err.message ?? 'Failed to update customer' }, status);
  }
});

// 5. DELETE /customers/:id — archive (soft delete)
invoicingRoutes.delete('/customers/:id', async (c) => {
  try {
    const userId = getUserId(c);
    const customerId = c.req.param('id');
    await customerService.archiveCustomer(userId, customerId);
    return c.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      return c.json({ error: err.message }, 404);
    }
    return c.json({ error: err.message ?? 'Failed to archive customer' }, 500);
  }
});

// 6. GET /customers/:id/contacts — list contacts
invoicingRoutes.get('/customers/:id/contacts', async (c) => {
  try {
    const customerId = c.req.param('id');
    const contacts = await customerService.listContacts(customerId);
    return c.json(contacts);
  } catch (err: any) {
    return c.json({ error: err.message ?? 'Failed to list contacts' }, 500);
  }
});

// 7. POST /customers/:id/contacts — add contact
invoicingRoutes.post(
  '/customers/:id/contacts',
  zValidator('json', createContactSchema),
  async (c) => {
    try {
      const customerId = c.req.param('id');
      const data = c.req.valid('json');
      const contact = await customerService.addContact(customerId, data);
      return c.json(contact, 201);
    } catch (err: any) {
      return c.json({ error: err.message ?? 'Failed to add contact' }, 500);
    }
  },
);

// ============================================================================
// INVOICE ENDPOINTS (10)
// ============================================================================

// 8. GET /invoices — paginated list with filters
invoicingRoutes.get('/invoices', async (c) => {
  try {
    const userId = getUserId(c);
    const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10));
    const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '50', 10)), 100);
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
  } catch (err: any) {
    return c.json({ error: err.message ?? 'Failed to list invoices' }, 500);
  }
});

// 9. POST /invoices — create invoice with line items
invoicingRoutes.post('/invoices', zValidator('json', createInvoiceSchema), async (c) => {
  try {
    const userId = getUserId(c);
    const data = c.req.valid('json');
    const invoice = await invoicingService.createInvoice(userId, data);
    return c.json(invoice, 201);
  } catch (err: any) {
    return c.json({ error: err.message ?? 'Failed to create invoice' }, 500);
  }
});

// 10. GET /invoices/next-number — MUST be BEFORE /invoices/:id to avoid route conflict
invoicingRoutes.get('/invoices/next-number', async (c) => {
  try {
    const userId = getUserId(c);
    const nextNumber = await invoicingService.getNextInvoiceNumber(userId);
    return c.json({ nextNumber });
  } catch (err: any) {
    return c.json({ error: err.message ?? 'Failed to get next invoice number' }, 500);
  }
});

// 11. POST /invoices/credit-note — create credit note (BEFORE :id routes)
invoicingRoutes.post(
  '/invoices/credit-note',
  zValidator('json', createCreditNoteSchema),
  async (c) => {
    try {
      const userId = getUserId(c);
      const data = c.req.valid('json');
      const creditNote = await invoicingService.createCreditNote(userId, data);
      return c.json(creditNote, 201);
    } catch (err: any) {
      return c.json({ error: err.message ?? 'Failed to create credit note' }, 500);
    }
  },
);

// 12. GET /invoices/:id — get invoice with lines + customer
invoicingRoutes.get('/invoices/:id', async (c) => {
  try {
    const userId = getUserId(c);
    const invoiceId = c.req.param('id');
    const result = await invoicingService.getInvoice(userId, invoiceId);
    if (!result) {
      return c.json({ error: 'Invoice not found' }, 404);
    }
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message ?? 'Failed to get invoice' }, 500);
  }
});

// 13. PATCH /invoices/:id — update draft invoice
invoicingRoutes.patch('/invoices/:id', zValidator('json', updateInvoiceSchema), async (c) => {
  try {
    const userId = getUserId(c);
    const invoiceId = c.req.param('id');
    const data = c.req.valid('json');
    const result = await invoicingService.updateInvoice(userId, invoiceId, data);
    return c.json(result);
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      return c.json({ error: err.message }, 404);
    }
    if (err.message?.includes('Cannot update')) {
      return c.json({ error: err.message }, 400);
    }
    return c.json({ error: err.message ?? 'Failed to update invoice' }, 500);
  }
});

// 14. POST /invoices/:id/send — mark as sent
invoicingRoutes.post('/invoices/:id/send', async (c) => {
  try {
    const userId = getUserId(c);
    const invoiceId = c.req.param('id');
    const result = await invoicingService.sendInvoice(userId, invoiceId);
    return c.json(result);
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      return c.json({ error: err.message }, 404);
    }
    if (err.message?.includes('Cannot send')) {
      return c.json({ error: err.message }, 400);
    }
    return c.json({ error: err.message ?? 'Failed to send invoice' }, 500);
  }
});

// 15. POST /invoices/:id/void — void invoice
invoicingRoutes.post('/invoices/:id/void', async (c) => {
  try {
    const userId = getUserId(c);
    const invoiceId = c.req.param('id');
    const result = await invoicingService.voidInvoice(userId, invoiceId);
    return c.json(result);
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      return c.json({ error: err.message }, 404);
    }
    if (err.message?.includes('Cannot void') || err.message?.includes('already void')) {
      return c.json({ error: err.message }, 400);
    }
    return c.json({ error: err.message ?? 'Failed to void invoice' }, 500);
  }
});

// 16. GET /invoices/:id/pdf — generate and serve PDF
invoicingRoutes.get('/invoices/:id/pdf', async (c) => {
  try {
    const userId = getUserId(c);
    const invoiceId = c.req.param('id');

    // Get invoice data
    const invoiceData = await invoicingService.getInvoice(userId, invoiceId);
    if (!invoiceData) {
      return c.json({ error: 'Invoice not found' }, 404);
    }

    // Get business profile for header
    const profile = await (db as any)
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId))
      .get();

    // Generate PDF
    const pdfBuffer = await invoicePDFService.generateInvoicePDF(invoiceData, profile ?? undefined);

    // Save to disk
    await invoicePDFService.saveInvoicePDF(invoiceId, pdfBuffer);

    // Return as PDF
    const invoiceNumber = invoiceData.invoice?.invoiceNumber ?? invoiceId;
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `attachment; filename="invoice-${invoiceNumber}.pdf"`);
    return c.body(new Uint8Array(pdfBuffer));
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      return c.json({ error: err.message }, 404);
    }
    return c.json({ error: err.message ?? 'Failed to generate PDF' }, 500);
  }
});

// 17. POST /invoices/:id/payment — record payment
invoicingRoutes.post(
  '/invoices/:id/payment',
  zValidator('json', recordPaymentSchema),
  async (c) => {
    try {
      const userId = getUserId(c);
      const invoiceId = c.req.param('id');
      const data = c.req.valid('json');
      const payment = await invoicingService.recordPayment(userId, invoiceId, data);
      return c.json(payment, 201);
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        return c.json({ error: err.message }, 404);
      }
      if (err.message?.includes('Cannot record')) {
        return c.json({ error: err.message }, 400);
      }
      return c.json({ error: err.message ?? 'Failed to record payment' }, 500);
    }
  },
);

export default invoicingRoutes;
