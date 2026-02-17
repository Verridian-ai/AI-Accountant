/**
 * Purchase Order Workflow — Status transitions and goods receiving.
 *
 * Status flow: draft -> sent -> partially_received -> received -> matched -> closed
 * Cancellation: draft|sent -> cancelled (no goods received)
 *
 * Key controls:
 *   - Separation of duties: PO creator != goods receiver
 */

import { logger } from '../../lib/logger.js';
import { db, purchaseOrders, poLines, poReceipts, poReceiptLines, users } from '../../schema.js';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { type ReceiveGoodsInput } from './types.js';

/**
 * Send a PO to the supplier. Transition: draft -> sent.
 */
export async function sendPurchaseOrder(poId: string): Promise<any> {
  const po = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).get();

  if (!po) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  if (po.status !== 'draft') {
    throw new Error(`Cannot send PO: current status is '${po.status}', expected 'draft'`);
  }

  const now = new Date().toISOString();
  await db
    .update(purchaseOrders)
    .set({
      status: 'sent',
      issueDate: po.issueDate || now.split('T')[0],
      updatedAt: now,
    })
    .where(eq(purchaseOrders.id, poId))
    .run();

  logger.info(`[PurchaseOrderService] PO ${po.poNumber} sent`);

  return await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).get();
}

/**
 * Cancel a PO. Only draft or sent POs with no goods received.
 */
export async function cancelPurchaseOrder(poId: string): Promise<any> {
  const po = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).get();

  if (!po) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  if (po.status !== 'draft' && po.status !== 'sent') {
    throw new Error(
      `Cannot cancel PO in '${po.status}' status. Only draft or sent POs can be cancelled.`,
    );
  }

  const now = new Date().toISOString();
  await db
    .update(purchaseOrders)
    .set({ status: 'cancelled', updatedAt: now })
    .where(eq(purchaseOrders.id, poId))
    .run();

  logger.info(`[PurchaseOrderService] PO ${po.poNumber} cancelled`);

  return await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).get();
}

/**
 * Receive goods against a PO. Creates receipt record + updates line quantities.
 *
 * Enforces:
 *   - Cannot receive more than ordered quantity
 *   - Separation of duties: PO creator != goods receiver (single-user exception)
 *   - Updates PO status to 'partially_received' or 'received'
 */
export async function receiveGoods(poId: string, receipt: ReceiveGoodsInput): Promise<any> {
  const po = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).get();

  if (!po) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  if (po.status !== 'sent' && po.status !== 'partially_received') {
    throw new Error(
      `Cannot receive goods: PO status is '${po.status}'. Must be 'sent' or 'partially_received'.`,
    );
  }

  // --- Separation of duties check ---
  const receivedBy = receipt.receivedBy ?? null;
  if (receivedBy && receivedBy === po.userId) {
    const userCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .get();

    const totalUsers = Number(userCount?.count) || 0;

    if (totalUsers <= 1) {
      logger.warn(
        `[PurchaseOrderService] WARNING: Single-user mode — PO creator ${po.userId} is receiving goods against their own PO ${po.poNumber}`,
      );
    } else {
      throw new Error('Separation of duties: PO creator cannot receive goods against their own PO');
    }
  }

  if (!receipt.lines || receipt.lines.length === 0) {
    throw new Error('Receipt must have at least one line');
  }

  // Fetch existing PO lines for validation
  const existingLines = await db
    .select()
    .from(poLines)
    .where(eq(poLines.purchaseOrderId, poId))
    .all();

  const lineMap = new Map<string, any>();
  for (const l of existingLines) {
    lineMap.set(l.id, l);
  }

  // Validate all receipt lines
  for (const rl of receipt.lines) {
    const poLine = lineMap.get(rl.poLineId);
    if (!poLine) {
      throw new Error(`PO line not found: ${rl.poLineId}`);
    }
    if (rl.quantityReceived <= 0) {
      throw new Error(`Quantity received must be positive for line: ${poLine.description}`);
    }
    const currentReceived = Number(poLine.quantityReceived) || 0;
    const ordered = Number(poLine.quantity) || 0;
    if (currentReceived + rl.quantityReceived > ordered) {
      throw new Error(
        `Cannot receive ${rl.quantityReceived} for "${poLine.description}": ` +
          `already received ${currentReceived} of ${ordered} ordered`,
      );
    }
  }

  // Create receipt record
  const receiptId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(poReceipts)
    .values({
      id: receiptId,
      purchaseOrderId: poId,
      receiptDate: receipt.receiptDate,
      receivedBy: receivedBy,
      notes: receipt.notes ?? null,
      createdAt: now,
    })
    .run();

  // Insert receipt lines and update PO line quantities
  for (const rl of receipt.lines) {
    const receiptLineId = crypto.randomUUID();
    await db
      .insert(poReceiptLines)
      .values({
        id: receiptLineId,
        receiptId,
        poLineId: rl.poLineId,
        quantityReceived: rl.quantityReceived,
      })
      .run();

    const poLine = lineMap.get(rl.poLineId)!;
    const newReceived = (Number(poLine.quantityReceived) || 0) + rl.quantityReceived;
    await db
      .update(poLines)
      .set({ quantityReceived: newReceived })
      .where(eq(poLines.id, rl.poLineId))
      .run();
  }

  // Determine new PO status based on receiving completeness
  const updatedLines = await db
    .select()
    .from(poLines)
    .where(eq(poLines.purchaseOrderId, poId))
    .all();

  let allFullyReceived = true;
  let anyReceived = false;
  for (const ul of updatedLines) {
    const qty = Number(ul.quantity) || 0;
    const qtyRcv = Number(ul.quantityReceived) || 0;
    if (qtyRcv > 0) anyReceived = true;
    if (qtyRcv < qty) allFullyReceived = false;
  }

  const newStatus = allFullyReceived ? 'received' : anyReceived ? 'partially_received' : po.status;

  await db
    .update(purchaseOrders)
    .set({ status: newStatus, updatedAt: now })
    .where(eq(purchaseOrders.id, poId))
    .run();

  logger.info(
    `[PurchaseOrderService] Goods received for PO ${po.poNumber} -> status: ${newStatus}`,
  );

  return {
    id: receiptId,
    purchaseOrderId: poId,
    receiptDate: receipt.receiptDate,
    receivedBy,
    notes: receipt.notes ?? null,
    createdAt: now,
    lines: receipt.lines,
    newPOStatus: newStatus,
  };
}
