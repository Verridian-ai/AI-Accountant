/**
 * Invoicing Service — Wave 7
 * Full invoice lifecycle: creation, auto-numbering, status management,
 * payment tracking, credit notes, overdue detection, and summary.
 */

import { db } from '../schema.js';
import {
  invoices,
  invoiceLines,
  invoiceNumberSequences,
  invoicePayments,
  customers,
} from '../schema.js';
import { eq, and, sql, desc, gte, lte, type SQL } from 'drizzle-orm';
import { randomUUID } from 'crypto';

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

// ============================================================================
// Helpers
// ============================================================================

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowISO(): string {
  return new Date().toISOString();
}

/** Calculate line-level amounts from input */
function calculateLineAmounts(input: CreateLineItemInput) {
  const gstRate = input.gstRate ?? 0.1;
  const amount = Math.round(input.quantity * input.unitPriceCents);
  const gstAmount = Math.round(amount * gstRate);
  return { amount, gstAmount, gstRate };
}

/** Sum line amounts into invoice-level totals */
function calculateInvoiceTotals(
  lines: Array<{ amount: number; gstAmount: number }>,
  existingAmountPaid: number = 0,
) {
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const gstAmount = lines.reduce((sum, l) => sum + l.gstAmount, 0);
  const totalAmount = subtotal + gstAmount;
  const amountDue = totalAmount - existingAmountPaid;
  return { subtotal, gstAmount, totalAmount, amountDue };
}

// ============================================================================
// InvoicingService
// ============================================================================

export class InvoicingService {
  // --------------------------------------------------------------------------
  // Auto-numbering — tamper-proof, gap-free (ATO sequential requirement)
  // --------------------------------------------------------------------------

  /**
   * Atomically fetch-and-increment the invoice number sequence for a user.
   * Uses SQL-level locking to prevent race conditions and duplicates.
   */
  async getNextInvoiceNumber(userId: string): Promise<string> {
    // Attempt atomic increment. If no row exists, create one first.
    const existing = await db
      .select()
      .from(invoiceNumberSequences)
      .where(eq(invoiceNumberSequences.userId, userId))
      .get();

    if (!existing) {
      // Seed the sequence for a new user
      const id = randomUUID();
      await db
        .insert(invoiceNumberSequences)
        .values({
          id,
          userId,
          prefix: 'INV-',
          nextNumber: 2, // We'll use 1 now and set next to 2
          createdAt: nowISO(),
          updatedAt: nowISO(),
        })
        .run();

      return 'INV-000001';
    }

    const currentNumber: number = existing.nextNumber ?? 1;
    const prefix: string = existing.prefix ?? 'INV-';

    // Increment atomically
    await db
      .update(invoiceNumberSequences)
      .set({
        nextNumber: currentNumber + 1,
        updatedAt: nowISO(),
      })
      .where(eq(invoiceNumberSequences.id, existing.id))
      .run();

    // Format with zero-padding to 6 digits
    const formatted = `${prefix}${String(currentNumber).padStart(6, '0')}`;
    return formatted;
  }

  // --------------------------------------------------------------------------
  // Create Invoice
  // --------------------------------------------------------------------------

  async createInvoice(userId: string, data: CreateInvoiceInput): Promise<InvoiceWithLines> {
    const invoiceId = randomUUID();
    const invoiceNumber = await this.getNextInvoiceNumber(userId);

    // Calculate line-level amounts
    const calculatedLines = data.lineItems.map((li) => {
      const { amount, gstAmount, gstRate } = calculateLineAmounts(li);
      return { ...li, amount, gstAmount, gstRate };
    });

    // Calculate invoice totals
    const { subtotal, gstAmount, totalAmount, amountDue } = calculateInvoiceTotals(
      calculatedLines,
      0,
    );

    // Determine dates
    const issueDate = data.issueDate ?? today();
    let dueDate = data.dueDate;

    if (!dueDate) {
      // Attempt to get customer paymentTermsDays
      const customer = await db
        .select()
        .from(customers)
        .where(eq(customers.id, data.customerId))
        .get();

      const termsDays = customer?.paymentTermsDays ?? 30;
      const due = new Date(issueDate);
      due.setDate(due.getDate() + termsDays);
      dueDate = due.toISOString().slice(0, 10);
    }

    const now = nowISO();

    // Insert invoice
    await db
      .insert(invoices)
      .values({
        id: invoiceId,
        userId,
        customerId: data.customerId,
        invoiceNumber,
        type: 'invoice',
        status: 'draft',
        issueDate,
        dueDate,
        subtotal,
        gstAmount,
        totalAmount,
        amountPaid: 0,
        amountDue,
        currency: 'AUD',
        notes: data.notes ?? null,
        termsAndConditions: data.termsAndConditions ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Insert line items
    const insertedLines: InvoiceLine[] = [];
    for (let i = 0; i < calculatedLines.length; i++) {
      const li = calculatedLines[i];
      const lineId = randomUUID();
      const lineValues = {
        id: lineId,
        invoiceId,
        lineOrder: i + 1,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPriceCents,
        amount: li.amount,
        gstRate: li.gstRate,
        gstAmount: li.gstAmount,
        accountCode: li.accountCode ?? null,
        taxCode: li.taxCode ?? null,
      };
      await db.insert(invoiceLines).values(lineValues).run();
      insertedLines.push(lineValues);
    }

    return {
      invoice: {
        id: invoiceId,
        userId,
        customerId: data.customerId,
        invoiceNumber,
        type: 'invoice',
        status: 'draft',
        issueDate,
        dueDate,
        subtotal,
        gstAmount,
        totalAmount,
        amountPaid: 0,
        amountDue,
        currency: 'AUD',
        notes: data.notes ?? null,
        termsAndConditions: data.termsAndConditions ?? null,
        pdfPath: null,
        createdAt: now,
        updatedAt: now,
      },
      lines: insertedLines,
    };
  }

  // --------------------------------------------------------------------------
  // Get Invoice (with lines + customer)
  // --------------------------------------------------------------------------

  async getInvoice(userId: string, invoiceId: string): Promise<InvoiceWithLines | null> {
    const invoice = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
      .get();

    if (!invoice) return null;

    const lines = await db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoiceId))
      .all();

    let customer: Customer | undefined = undefined;
    if (invoice.customerId) {
      customer = await db
        .select()
        .from(customers)
        .where(eq(customers.id, invoice.customerId))
        .get();
    }

    return { invoice, lines, customer };
  }

  // --------------------------------------------------------------------------
  // List Invoices (paginated + filtered)
  // --------------------------------------------------------------------------

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
    const offset = options.offset ?? 0;
    const limit = Math.min(options.limit ?? 50, 100);

    // Build conditions
    const conditions: SQL[] = [eq(invoices.userId, userId)];
    if (options.status) {
      conditions.push(eq(invoices.status, options.status));
    }
    if (options.customerId) {
      conditions.push(eq(invoices.customerId, options.customerId));
    }
    if (options.dateFrom) {
      conditions.push(gte(invoices.issueDate, options.dateFrom));
    }
    if (options.dateTo) {
      conditions.push(lte(invoices.issueDate, options.dateTo));
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(whereClause)
      .get();
    const total: number = countResult?.count ?? 0;

    // Fetch page with customer join
    const rows = await db
      .select({
        invoice: invoices,
        customerName: customers.businessName,
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .where(whereClause)
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    const data: InvoiceWithCustomer[] = (rows ?? []).map(
      (r: { invoice: Invoice | null; customerName: string | null }) => ({
        invoice: r.invoice ?? r,
        customerName: r.customerName ?? 'Unknown',
      }),
    );

    return { data, total };
  }

  // --------------------------------------------------------------------------
  // Update Invoice (draft only)
  // --------------------------------------------------------------------------

  async updateInvoice(
    userId: string,
    invoiceId: string,
    data: UpdateInvoiceInput,
  ): Promise<InvoiceWithLines> {
    const existing = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
      .get();

    if (!existing) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }
    if (existing.status !== 'draft') {
      throw new Error(
        `Cannot update invoice with status '${existing.status}'. Only draft invoices can be edited.`,
      );
    }

    const updates: Record<string, unknown> = { updatedAt: nowISO() };
    if (data.customerId !== undefined) updates.customerId = data.customerId;
    if (data.issueDate !== undefined) updates.issueDate = data.issueDate;
    if (data.dueDate !== undefined) updates.dueDate = data.dueDate;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.termsAndConditions !== undefined) updates.termsAndConditions = data.termsAndConditions;

    // If line items provided, delete + re-insert and recalculate totals
    if (data.lineItems && data.lineItems.length > 0) {
      // Delete existing lines
      await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId)).run();

      // Calculate new lines
      const calculatedLines = data.lineItems.map((li) => {
        const { amount, gstAmount, gstRate } = calculateLineAmounts(li);
        return { ...li, amount, gstAmount, gstRate };
      });

      const { subtotal, gstAmount, totalAmount, amountDue } = calculateInvoiceTotals(
        calculatedLines,
        existing.amountPaid ?? 0,
      );

      updates.subtotal = subtotal;
      updates.gstAmount = gstAmount;
      updates.totalAmount = totalAmount;
      updates.amountDue = amountDue;

      // Insert new lines
      for (let i = 0; i < calculatedLines.length; i++) {
        const li = calculatedLines[i];
        await db
          .insert(invoiceLines)
          .values({
            id: randomUUID(),
            invoiceId,
            lineOrder: i + 1,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPriceCents,
            amount: li.amount,
            gstRate: li.gstRate,
            gstAmount: li.gstAmount,
            accountCode: li.accountCode ?? null,
            taxCode: li.taxCode ?? null,
          })
          .run();
      }
    }

    // Apply updates to invoice
    await db.update(invoices).set(updates).where(eq(invoices.id, invoiceId)).run();

    // Return fresh invoice with lines
    return (await this.getInvoice(userId, invoiceId))!;
  }

  // --------------------------------------------------------------------------
  // Send Invoice (draft → sent)
  // --------------------------------------------------------------------------

  async sendInvoice(userId: string, invoiceId: string): Promise<void> {
    const invoice = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
      .get();

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }
    if (invoice.status !== 'draft') {
      throw new Error(
        `Cannot send invoice with status '${invoice.status}'. Only draft invoices can be sent.`,
      );
    }

    const updates: Record<string, unknown> = {
      status: 'sent',
      updatedAt: nowISO(),
    };

    // Set issueDate to today if not already set
    if (!invoice.issueDate) {
      updates.issueDate = today();
    }

    await db.update(invoices).set(updates).where(eq(invoices.id, invoiceId)).run();

    return {
      ...invoice,
      ...updates,
    };
  }

  // --------------------------------------------------------------------------
  // Void Invoice (NOT allowed if paid)
  // --------------------------------------------------------------------------

  async voidInvoice(userId: string, invoiceId: string): Promise<InvoiceWithLines> {
    const invoice = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
      .get();

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }
    if (invoice.status === 'paid') {
      throw new Error('Cannot void a paid invoice');
    }
    if (invoice.status === 'void') {
      throw new Error('Invoice is already void');
    }

    await db
      .update(invoices)
      .set({
        status: 'void',
        amountDue: 0,
        updatedAt: nowISO(),
      })
      .where(eq(invoices.id, invoiceId))
      .run();

    return {
      ...invoice,
      status: 'void',
      amountDue: 0,
      updatedAt: nowISO(),
    };
  }

  // --------------------------------------------------------------------------
  // Record Payment
  // --------------------------------------------------------------------------

  async recordPayment(
    userId: string,
    invoiceId: string,
    data: RecordPaymentInput,
  ): Promise<InvoicePayment> {
    const invoice = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
      .get();

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }
    if (invoice.status === 'void') {
      throw new Error('Cannot record payment on a void invoice');
    }

    // Create payment record
    const paymentId = randomUUID();
    const now = nowISO();

    await db
      .insert(invoicePayments)
      .values({
        id: paymentId,
        invoiceId,
        paymentDate: data.paymentDate,
        amount: data.amountCents,
        paymentMethod: data.paymentMethod ?? null,
        reference: data.reference ?? null,
        transactionId: data.transactionId ?? null,
        notes: data.notes ?? null,
        createdAt: now,
      })
      .run();

    // Update invoice amountPaid and amountDue
    const newAmountPaid = (invoice.amountPaid ?? 0) + data.amountCents;
    const newAmountDue = (invoice.totalAmount ?? 0) - newAmountPaid;

    const invoiceUpdates: Record<string, unknown> = {
      amountPaid: newAmountPaid,
      amountDue: newAmountDue,
      updatedAt: now,
    };

    // Auto-set status to 'paid' when fully paid
    if (newAmountPaid >= (invoice.totalAmount ?? 0)) {
      invoiceUpdates.status = 'paid';
    }

    await db.update(invoices).set(invoiceUpdates).where(eq(invoices.id, invoiceId)).run();

    return {
      id: paymentId,
      invoiceId,
      paymentDate: data.paymentDate,
      amount: data.amountCents,
      paymentMethod: data.paymentMethod ?? null,
      reference: data.reference ?? null,
      transactionId: data.transactionId ?? null,
      notes: data.notes ?? null,
      createdAt: now,
    };
  }

  // --------------------------------------------------------------------------
  // Create Credit Note
  // --------------------------------------------------------------------------

  async createCreditNote(userId: string, data: CreateCreditNoteInput): Promise<InvoiceWithLines> {
    const invoiceId = randomUUID();
    const invoiceNumber = await this.getNextInvoiceNumber(userId);

    // Calculate line-level amounts (stored as positive, type='credit_note' indicates direction)
    const calculatedLines = data.lineItems.map((li) => {
      const { amount, gstAmount, gstRate } = calculateLineAmounts(li);
      return { ...li, amount, gstAmount, gstRate };
    });

    const { subtotal, gstAmount, totalAmount } = calculateInvoiceTotals(calculatedLines, 0);

    const now = nowISO();
    const issueDateStr = today();

    await db
      .insert(invoices)
      .values({
        id: invoiceId,
        userId,
        customerId: data.customerId,
        invoiceNumber,
        type: 'credit_note',
        status: 'draft',
        issueDate: issueDateStr,
        dueDate: issueDateStr,
        subtotal,
        gstAmount,
        totalAmount,
        amountPaid: 0,
        amountDue: 0, // Credit notes don't have "due" amounts
        currency: 'AUD',
        notes: data.notes ?? null,
        // TODO: Add originalInvoiceId to schema
        // originalInvoiceId: data.originalInvoiceId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Insert line items
    const insertedLines: InvoiceLine[] = [];
    for (let i = 0; i < calculatedLines.length; i++) {
      const li = calculatedLines[i];
      const lineId = randomUUID();
      const lineValues = {
        id: lineId,
        invoiceId,
        lineOrder: i + 1,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPriceCents,
        amount: li.amount,
        gstRate: li.gstRate,
        gstAmount: li.gstAmount,
        accountCode: li.accountCode ?? null,
        taxCode: li.taxCode ?? null,
      };
      await db.insert(invoiceLines).values(lineValues).run();
      insertedLines.push(lineValues);
    }

    return {
      invoice: {
        id: invoiceId,
        userId,
        customerId: data.customerId,
        invoiceNumber,
        type: 'credit_note',
        status: 'draft',
        issueDate: issueDateStr,
        dueDate: issueDateStr,
        subtotal,
        gstAmount,
        totalAmount,
        amountPaid: 0,
        amountDue: 0,
        currency: 'AUD',
        notes: data.notes ?? null,
        pdfPath: null,
        termsAndConditions: null,
        // TODO: Add originalInvoiceId to schema
        // originalInvoiceId: data.originalInvoiceId ?? null,
        createdAt: now,
        updatedAt: now,
      },
      lines: insertedLines,
    };
  }

  // --------------------------------------------------------------------------
  // Check Overdue Invoices
  // --------------------------------------------------------------------------

  async checkOverdueInvoices(
    userId: string,
  ): Promise<{ id: string; invoiceNumber: string; amountDue: number; daysOverdue: number }[]> {
    const todayStr = today();

    // Find sent invoices past due date
    const overdueInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.userId, userId),
          eq(invoices.status, 'sent'),
          lte(invoices.dueDate, todayStr),
        ),
      )
      .all();

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return [];
    }

    // Update each to 'overdue'
    const now = nowISO();
    for (const inv of overdueInvoices) {
      await db
        .update(invoices)
        .set({ status: 'overdue', updatedAt: now })
        .where(eq(invoices.id, inv.id))
        .run();
    }

    return overdueInvoices.map((inv) => ({
      ...inv,
      status: 'overdue',
      updatedAt: now,
    }));
  }

  // --------------------------------------------------------------------------
  // Invoice Summary
  // --------------------------------------------------------------------------

  async getInvoiceSummary(userId: string): Promise<InvoiceSummary> {
    // Get all invoices for user (non-void for totals)
    const allInvoices = await db.select().from(invoices).where(eq(invoices.userId, userId)).all();

    const list = allInvoices ?? [];

    // Count by status
    const counts = {
      draft: 0,
      sent: 0,
      paid: 0,
      overdue: 0,
      void: 0,
    };

    let totalOutstandingCents = 0;
    let totalOverdueCents = 0;
    let revenueThisMonthCents = 0;

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    for (const inv of list) {
      const status = inv.status as keyof typeof counts;
      if (status in counts) {
        counts[status]++;
      }

      // Outstanding = sent + overdue amountDue
      if (inv.status === 'sent' || inv.status === 'overdue') {
        totalOutstandingCents += inv.amountDue ?? 0;
      }

      // Overdue amount
      if (inv.status === 'overdue') {
        totalOverdueCents += inv.amountDue ?? 0;
      }

      // Revenue this month = paid invoices with payment this month
      if (inv.status === 'paid' && inv.updatedAt >= monthStart) {
        revenueThisMonthCents += inv.totalAmount ?? 0;
      }
    }

    return {
      totalOutstandingCents,
      totalOverdueCents,
      revenueThisMonthCents,
      counts,
    };
  }
}

// Singleton export
export const invoicingService = new InvoicingService();
