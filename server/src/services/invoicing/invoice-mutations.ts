/**
 * Invoicing Service — Mutation Operations
 * Create, update, send invoices, and auto-numbering.
 * Payment, void, and credit note operations are in ./invoice-payments.ts.
 */

import { db } from '../../schema.js';
import { invoices, invoiceLines, invoiceNumberSequences } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type {
  InvoiceLine,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceWithLines,
} from './types.js';
import { today, nowISO, calculateLineAmounts, calculateInvoiceTotals } from './helpers.js';

// Re-export extracted operations for backward compatibility
export { voidInvoice, recordPayment, createCreditNote } from './invoice-payments.js';

// --------------------------------------------------------------------------
// Auto-numbering — tamper-proof, gap-free (ATO sequential requirement)
// --------------------------------------------------------------------------

export async function getNextInvoiceNumber(userId: string): Promise<string> {
  const existing = await db
    .select()
    .from(invoiceNumberSequences)
    .where(eq(invoiceNumberSequences.userId, userId))
    .get();

  if (!existing) {
    const id = randomUUID();
    await db
      .insert(invoiceNumberSequences)
      .values({
        id,
        userId,
        prefix: 'INV-',
        nextNumber: 2,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      })
      .run();

    return 'INV-000001';
  }

  const currentNumber: number = existing.nextNumber ?? 1;
  const prefix: string = existing.prefix ?? 'INV-';

  await db
    .update(invoiceNumberSequences)
    .set({
      nextNumber: currentNumber + 1,
      updatedAt: nowISO(),
    })
    .where(eq(invoiceNumberSequences.id, existing.id))
    .run();

  const formatted = `${prefix}${String(currentNumber).padStart(6, '0')}`;
  return formatted;
}

// --------------------------------------------------------------------------
// Create Invoice
// --------------------------------------------------------------------------

export async function createInvoice(
  userId: string,
  data: CreateInvoiceInput,
): Promise<InvoiceWithLines> {
  const invoiceId = randomUUID();
  const invoiceNumber = await getNextInvoiceNumber(userId);

  const calculatedLines = data.lineItems.map((li) => {
    const { amount, gstAmount, gstRate } = calculateLineAmounts(li);
    return { ...li, amount, gstAmount, gstRate };
  });

  const { subtotal, gstAmount, totalAmount } = calculateInvoiceTotals(calculatedLines, 0);

  const issueDate = data.issueDate ?? today();
  const dueDate = data.dueDate ?? issueDate;

  const now = nowISO();

  await db
    .insert(invoices)
    .values({
      id: invoiceId,
      userId,
      customerId: data.customerId,
      invoiceNumber,
      status: 'draft',
      issueDate,
      dueDate,
      subtotal,
      gstAmount,
      totalAmount,
      createdAt: now,
    })
    .run();

  const insertedLines: InvoiceLine[] = [];
  for (let i = 0; i < calculatedLines.length; i++) {
    const li = calculatedLines[i];
    const lineId = randomUUID();
    const lineValues = {
      id: lineId,
      invoiceId,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPriceCents,
      amount: li.amount,
      gstAmount: li.gstAmount ?? null,
      taxCode: li.taxCode ?? null,
      createdAt: now,
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
      status: 'draft',
      issueDate,
      dueDate,
      subtotal,
      gstAmount,
      totalAmount,
      amountPaid: null,
      amountDue: null,
      termsAndConditions: data.termsAndConditions ?? null,
      notes: data.notes ?? null,
      createdAt: now,
      tenantId: null,
    },
    lines: insertedLines,
  };
}

// --------------------------------------------------------------------------
// Update Invoice (draft only)
// --------------------------------------------------------------------------

export async function updateInvoice(
  userId: string,
  invoiceId: string,
  data: UpdateInvoiceInput,
  getInvoiceFn: (userId: string, invoiceId: string) => Promise<InvoiceWithLines | null>,
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

  const updates: Record<string, unknown> = {};
  if (data.customerId !== undefined) updates.customerId = data.customerId;
  if (data.issueDate !== undefined) updates.issueDate = data.issueDate;
  if (data.dueDate !== undefined) updates.dueDate = data.dueDate;

  if (data.lineItems && data.lineItems.length > 0) {
    await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId)).run();

    const calculatedLines = data.lineItems.map((li) => {
      const { amount, gstAmount, gstRate } = calculateLineAmounts(li);
      return { ...li, amount, gstAmount, gstRate };
    });

    const { subtotal, gstAmount, totalAmount } = calculateInvoiceTotals(calculatedLines, 0);

    updates.subtotal = subtotal;
    updates.gstAmount = gstAmount;
    updates.totalAmount = totalAmount;

    const now = nowISO();
    for (let i = 0; i < calculatedLines.length; i++) {
      const li = calculatedLines[i];
      await db
        .insert(invoiceLines)
        .values({
          id: randomUUID(),
          invoiceId,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPriceCents,
          amount: li.amount,
          taxCode: li.taxCode ?? null,
          createdAt: now,
        })
        .run();
    }
  }

  await db.update(invoices).set(updates).where(eq(invoices.id, invoiceId)).run();

  return (await getInvoiceFn(userId, invoiceId))!;
}

// --------------------------------------------------------------------------
// Send Invoice (draft -> sent)
// --------------------------------------------------------------------------

export async function sendInvoice(userId: string, invoiceId: string): Promise<void> {
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

  const updates: Record<string, unknown> = { status: 'sent' };

  if (!invoice.issueDate) {
    updates.issueDate = today();
  }

  await db.update(invoices).set(updates).where(eq(invoices.id, invoiceId)).run();
}
