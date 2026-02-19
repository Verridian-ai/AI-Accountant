/**
 * Bill mutations — self-contained create/update implementation.
 */
import { db, bills, billLines } from '../../schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import type { CreateBillInput, UpdateBillInput } from './types.js';
import { calcLineAmount, calcBillTotals } from './types.js';

/**
 * Create a new bill with line items.
 * Calculates: line amounts, line GST, subtotal, gstAmount, totalAmount.
 * Sets amountDue = totalAmount (initially unpaid), status = 'draft'.
 */
export async function createBill(userId: string, data: CreateBillInput) {
  if (!data.lineItems || data.lineItems.length === 0) {
    throw new Error('Bill must have at least one line item');
  }

  const billId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Calculate line items
  const computedLines = data.lineItems.map((item) => {
    const amount = calcLineAmount(item.quantity, item.unitPriceCents);
    return {
      id: crypto.randomUUID(),
      billId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPriceCents,
      amount,
      taxCode: item.taxCode ?? null,
      createdAt: now,
    };
  });

  // Calculate totals
  const totals = calcBillTotals(computedLines);

  // Insert bill
  await db
    .insert(bills)
    .values({
      id: billId,
      userId,
      supplierId: data.supplierId,
      billNumber: data.billNumber ?? null,
      status: 'draft',
      billDate: data.issueDate,
      dueDate: data.dueDate,
      subtotal: totals.subtotal,
      gstAmount: totals.gstAmount,
      totalAmount: totals.totalAmount,
      createdAt: now,
    })
    .run();

  // Insert all line items
  for (const line of computedLines) {
    await db.insert(billLines).values(line).run();
  }

  return {
    id: billId,
    userId,
    supplierId: data.supplierId,
    billNumber: data.billNumber ?? null,
    status: 'draft',
    billDate: data.issueDate,
    issueDate: data.issueDate,
    dueDate: data.dueDate,
    ...totals,
    amountDue: totals.totalAmount,
    lineItemCount: computedLines.length,
  };
}

/**
 * Update a bill (only draft or awaiting_approval).
 * If lineItems are provided, replaces all existing lines and recalculates totals.
 */
export async function updateBill(billId: string, data: UpdateBillInput) {
  const existing = await db.select().from(bills).where(eq(bills.id, billId)).get();

  if (!existing) {
    throw new Error(`Bill not found: ${billId}`);
  }

  if (existing.status !== 'draft' && existing.status !== 'awaiting_approval') {
    throw new Error(
      `Cannot update bill in '${existing.status}' status. Only draft or awaiting_approval bills can be updated.`,
    );
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {};

  if (data.billNumber !== undefined) updates.billNumber = data.billNumber;
  if (data.issueDate !== undefined) updates.billDate = data.issueDate;
  if (data.dueDate !== undefined) updates.dueDate = data.dueDate;

  // If line items provided, replace all and recalculate
  if (data.lineItems && data.lineItems.length > 0) {
    // Delete existing lines
    await db.delete(billLines).where(eq(billLines.billId, billId)).run();

    // Insert new lines
    const computedLines = data.lineItems.map((item) => {
      const amount = calcLineAmount(item.quantity, item.unitPriceCents);
      return {
        id: item.id ?? crypto.randomUUID(),
        billId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPriceCents,
        amount,
        taxCode: item.taxCode ?? null,
        createdAt: now,
      };
    });

    for (const line of computedLines) {
      await db.insert(billLines).values(line).run();
    }

    // Recalculate totals
    const totals = calcBillTotals(computedLines);
    updates.subtotal = totals.subtotal;
    updates.gstAmount = totals.gstAmount;
    updates.totalAmount = totals.totalAmount;
  }

  await db.update(bills).set(updates).where(eq(bills.id, billId)).run();

  // Return updated bill
  return await db.select().from(bills).where(eq(bills.id, billId)).get();
}
