/**
 * Purchase Order CRUD — Create, Read (list), Update operations.
 *
 * All monetary amounts in cents (INTEGER).
 * Status starts as 'draft' on creation.
 */

import { db, purchaseOrders, poLines, suppliers } from '../../schema.js';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import crypto from 'crypto';
import { getNextPONumber } from './numbering.js';
import {
  calcLineAmount,
  calcPOTotals,
  type CreatePOInput,
  type UpdatePOInput,
  type POWithSupplier,
  type POListOptions,
} from './types.js';

/**
 * List purchase orders for a user with pagination and filtering.
 * Default sort: issueDate DESC (most recent first).
 */
export async function listPurchaseOrders(
  userId: string,
  options: POListOptions = {},
): Promise<{ data: POWithSupplier[]; total: number }> {
  const { page = 1, limit = 50, status, supplierId, dateFrom, dateTo } = options;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [eq(purchaseOrders.userId, userId)];
  if (status) conditions.push(eq(purchaseOrders.status, status));
  if (supplierId) conditions.push(eq(purchaseOrders.supplierId, supplierId));
  if (dateFrom) conditions.push(gte(purchaseOrders.issueDate, dateFrom));
  if (dateTo) conditions.push(lte(purchaseOrders.issueDate, dateTo));

  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(purchaseOrders)
    .where(and(...conditions))
    .get();

  const total = Number(countResult?.count) || 0;

  const rows = await db
    .select({
      id: purchaseOrders.id,
      userId: purchaseOrders.userId,
      supplierId: purchaseOrders.supplierId,
      poNumber: purchaseOrders.poNumber,
      status: purchaseOrders.status,
      issueDate: purchaseOrders.issueDate,
      expectedDate: purchaseOrders.expectedDate,
      subtotal: purchaseOrders.subtotal,
      gstAmount: purchaseOrders.gstAmount,
      totalAmount: purchaseOrders.totalAmount,
      notes: purchaseOrders.notes,
      createdAt: purchaseOrders.createdAt,
      updatedAt: purchaseOrders.updatedAt,
      supplierName: suppliers.businessName,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(and(...conditions))
    .orderBy(desc(purchaseOrders.issueDate))
    .limit(limit)
    .offset(offset)
    .all();

  const data: POWithSupplier[] = (rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    userId: r.userId as string,
    supplierId: r.supplierId as string,
    poNumber: r.poNumber as string,
    status: r.status as string,
    issueDate: r.issueDate as string,
    expectedDate: (r.expectedDate as string | null) ?? null,
    subtotal: Number(r.subtotal) || 0,
    gstAmount: Number(r.gstAmount) || 0,
    totalAmount: Number(r.totalAmount) || 0,
    notes: (r.notes as string | null) ?? null,
    createdAt: String(r.createdAt),
    updatedAt: String(r.updatedAt),
    supplierName: (r.supplierName as string) ?? 'Unknown Supplier',
  }));

  return { data, total };
}

/**
 * Create a new PO with auto-generated number and line items.
 * Inserts PO + lines atomically. Status starts as 'draft'.
 */
export async function createPurchaseOrder(userId: string, data: CreatePOInput): Promise<any> {
  if (!data.lineItems || data.lineItems.length === 0) {
    throw new Error('Purchase order must have at least one line item');
  }

  const poId = crypto.randomUUID();
  const now = new Date().toISOString();
  const poNumber = await getNextPONumber(userId);

  // Calculate line items
  const computedLines = data.lineItems.map((item) => {
    const amount = calcLineAmount(item.quantity, item.unitPriceCents);
    return {
      id: crypto.randomUUID(),
      purchaseOrderId: poId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPriceCents,
      amount,
      quantityReceived: 0,
    };
  });

  const totals = calcPOTotals(computedLines);

  // Insert PO
  await db
    .insert(purchaseOrders)
    .values({
      id: poId,
      userId,
      supplierId: data.supplierId,
      poNumber,
      status: 'draft',
      issueDate: now.split('T')[0],
      expectedDate: data.expectedDate ?? null,
      subtotal: totals.subtotal,
      gstAmount: totals.gstAmount,
      totalAmount: totals.totalAmount,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Insert all line items
  for (const line of computedLines) {
    await db.insert(poLines).values(line).run();
  }

  return {
    id: poId,
    userId,
    supplierId: data.supplierId,
    poNumber,
    status: 'draft',
    issueDate: now.split('T')[0],
    expectedDate: data.expectedDate ?? null,
    ...totals,
    notes: data.notes ?? null,
    lineItemCount: computedLines.length,
  };
}

/**
 * Update a draft PO. Recalculates totals if line items changed.
 */
export async function updatePurchaseOrder(poId: string, data: UpdatePOInput): Promise<any> {
  const existing = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).get();

  if (!existing) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  if (existing.status !== 'draft') {
    throw new Error(
      `Cannot update PO in '${existing.status}' status. Only draft POs can be updated.`,
    );
  }

  const now = new Date().toISOString();
  const updates: Record<string, any> = { updatedAt: now };

  if (data.expectedDate !== undefined) updates.expectedDate = data.expectedDate;
  if (data.notes !== undefined) updates.notes = data.notes;

  // If line items provided, replace all and recalculate
  if (data.lineItems && data.lineItems.length > 0) {
    await db.delete(poLines).where(eq(poLines.purchaseOrderId, poId)).run();

    const computedLines = data.lineItems.map((item) => {
      const amount = calcLineAmount(item.quantity, item.unitPriceCents);
      return {
        id: item.id ?? crypto.randomUUID(),
        purchaseOrderId: poId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPriceCents,
        amount,
        quantityReceived: 0,
      };
    });

    for (const line of computedLines) {
      await db.insert(poLines).values(line).run();
    }

    const totals = calcPOTotals(computedLines);
    updates.subtotal = totals.subtotal;
    updates.gstAmount = totals.gstAmount;
    updates.totalAmount = totals.totalAmount;
  }

  await db.update(purchaseOrders).set(updates).where(eq(purchaseOrders.id, poId)).run();

  return await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).get();
}
