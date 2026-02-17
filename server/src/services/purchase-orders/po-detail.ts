/**
 * Purchase Order Detail Retrieval — Full PO with line items, receipts,
 * linked bills, and receiving progress.
 */

import {
  db,
  purchaseOrders,
  poLines,
  poReceipts,
  poReceiptLines,
  suppliers,
  bills,
} from '../../schema.js';
import { eq, and, asc } from 'drizzle-orm';
import { type POLineWithProgress, type POReceiptDetail, type PODetail } from './types.js';

/**
 * Get a single PO with full details: line items, receipts, linked bills,
 * and overall receiving progress.
 */
export async function getPurchaseOrder(poId: string): Promise<PODetail> {
  const row = await db
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
    .where(eq(purchaseOrders.id, poId))
    .get();

  if (!row) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  // Fetch line items
  const lines = await db.select().from(poLines).where(eq(poLines.purchaseOrderId, poId)).all();

  const lineItems: POLineWithProgress[] = lines.map((l: any) => {
    const qty = Number(l.quantity) || 0;
    const qtyReceived = Number(l.quantityReceived) || 0;
    return {
      id: l.id,
      purchaseOrderId: l.purchaseOrderId,
      description: l.description,
      quantity: qty,
      unitPrice: Number(l.unitPrice) || 0,
      amount: Number(l.amount) || 0,
      quantityReceived: qtyReceived,
      receivingProgress: qty > 0 ? Math.round((qtyReceived / qty) * 100) : 0,
    };
  });

  // Fetch receipts with their lines
  const receiptRows = await db
    .select()
    .from(poReceipts)
    .where(eq(poReceipts.purchaseOrderId, poId))
    .orderBy(asc(poReceipts.receiptDate))
    .all();

  const receipts: POReceiptDetail[] = [];
  for (const receipt of receiptRows) {
    const rLines = await db
      .select()
      .from(poReceiptLines)
      .where(eq(poReceiptLines.receiptId, receipt.id))
      .all();

    receipts.push({
      id: receipt.id,
      purchaseOrderId: receipt.purchaseOrderId,
      receiptDate: receipt.receiptDate,
      receivedBy: receipt.receivedBy ?? null,
      notes: receipt.notes ?? null,
      createdAt: String(receipt.createdAt),
      lines: rLines.map((rl: any) => ({
        id: rl.id,
        receiptId: rl.receiptId,
        poLineId: rl.poLineId,
        quantityReceived: Number(rl.quantityReceived) || 0,
      })),
    });
  }

  // Find linked bills (same supplier + user)
  const linkedBillRows = await db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      totalAmount: bills.totalAmount,
      status: bills.status,
    })
    .from(bills)
    .where(
      and(eq(bills.supplierId, (row as any).supplierId), eq(bills.userId, (row as any).userId)),
    )
    .all();

  const linkedBills = linkedBillRows.map((b: any) => ({
    id: b.id,
    billNumber: b.billNumber ?? '',
    totalCents: Number(b.totalAmount) || 0,
    status: b.status,
  }));

  // Calculate overall receiving progress
  let totalOrdered = 0;
  let totalReceived = 0;
  for (const li of lineItems) {
    totalOrdered += li.quantity;
    totalReceived += li.quantityReceived;
  }
  const overallReceivingPercent =
    totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

  return {
    id: (row as any).id,
    userId: (row as any).userId,
    supplierId: (row as any).supplierId,
    poNumber: (row as any).poNumber,
    status: (row as any).status,
    issueDate: (row as any).issueDate,
    expectedDate: (row as any).expectedDate ?? null,
    subtotal: Number((row as any).subtotal) || 0,
    gstAmount: Number((row as any).gstAmount) || 0,
    totalAmount: Number((row as any).totalAmount) || 0,
    notes: (row as any).notes ?? null,
    createdAt: String((row as any).createdAt),
    updatedAt: String((row as any).updatedAt),
    supplierName: (row as any).supplierName ?? 'Unknown Supplier',
    lineItems,
    receipts,
    linkedBills,
    overallReceivingPercent,
  };
}
