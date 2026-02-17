/**
 * Invoicing Service — Payment & Credit Note Operations
 *
 * Record payments, void invoices, and create credit notes.
 */

import { db } from '../../schema.js';
import { invoices, invoiceLines, invoicePayments } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type {
  InvoiceLine,
  RecordPaymentInput,
  CreateCreditNoteInput,
  InvoiceWithLines,
  InvoicePayment,
} from './types.js';
import { today, nowISO, calculateLineAmounts, calculateInvoiceTotals } from './helpers.js';

// --------------------------------------------------------------------------
// Void Invoice (NOT allowed if paid)
// --------------------------------------------------------------------------

export async function voidInvoice(userId: string, invoiceId: string): Promise<InvoiceWithLines> {
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

export async function recordPayment(
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

  const newAmountPaid = (invoice.amountPaid ?? 0) + data.amountCents;
  const newAmountDue = (invoice.totalAmount ?? 0) - newAmountPaid;

  const invoiceUpdates: Record<string, unknown> = {
    amountPaid: newAmountPaid,
    amountDue: newAmountDue,
    updatedAt: now,
  };

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

export async function createCreditNote(
  userId: string,
  data: CreateCreditNoteInput,
): Promise<InvoiceWithLines> {
  const invoiceId = randomUUID();
  const { getNextInvoiceNumber } = await import('./invoice-mutations.js');
  const invoiceNumber = await getNextInvoiceNumber(userId);

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
      amountDue: 0,
      currency: 'AUD',
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

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
      createdAt: now,
      updatedAt: now,
    },
    lines: insertedLines,
  };
}
