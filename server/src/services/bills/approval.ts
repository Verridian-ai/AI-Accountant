/**
 * Bill approval workflow — submit for approval, approve, void.
 *
 * Status transitions:
 *   draft -> awaiting_approval (submitForApproval)
 *   awaiting_approval -> approved (approveBill)
 *   draft | awaiting_approval -> void (voidBill)
 *
 * Enforces separation of duties: creator cannot approve their own bill
 * (exception: single-user mode allows self-approval with a warning).
 */

import { db, bills, billLines, billPayments, purchaseOrders, users } from '../../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';

/**
 * Submit a bill for approval.
 * Transition: draft -> awaiting_approval.
 * Validates all required fields are present.
 */
export async function submitForApproval(billId: string): Promise<any> {
  const bill = await db.select().from(bills).where(eq(bills.id, billId)).get();

  if (!bill) {
    throw new Error(`Bill not found: ${billId}`);
  }

  if (bill.status !== 'draft') {
    throw new Error(
      `Cannot submit bill for approval: current status is '${bill.status}', expected 'draft'`,
    );
  }

  // Validate required fields
  if (!bill.supplierId) throw new Error('Bill must have a supplier');
  if (!bill.issueDate) throw new Error('Bill must have an issue date');
  if (!bill.dueDate) throw new Error('Bill must have a due date');
  if (Number(bill.totalAmount) <= 0) {
    throw new Error('Bill total amount must be greater than zero');
  }

  // Check that line items exist
  const lineCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(billLines)
    .where(eq(billLines.billId, billId))
    .get();

  if (!lineCount || Number(lineCount.count) === 0) {
    throw new Error('Bill must have at least one line item');
  }

  const now = new Date().toISOString();
  await db
    .update(bills)
    .set({ status: 'awaiting_approval', updatedAt: now })
    .where(eq(bills.id, billId))
    .run();

  return await db.select().from(bills).where(eq(bills.id, billId)).get();
}

/**
 * Approve a bill.
 * Transition: awaiting_approval -> approved.
 * Enforces separation of duties: creator cannot approve their own bill.
 * Exception: single-user mode allows self-approval with a warning.
 */
export async function approveBill(billId: string, approvingUserId: string): Promise<any> {
  const bill = await db.select().from(bills).where(eq(bills.id, billId)).get();

  if (!bill) {
    throw new Error(`Bill not found: ${billId}`);
  }

  if (bill.status !== 'awaiting_approval') {
    throw new Error(
      `Cannot approve bill: current status is '${bill.status}', expected 'awaiting_approval'`,
    );
  }

  // --- Separation of duties check ---
  const billCreatorId = bill.userId;

  // Also check linked PO creator
  let poCreatorId: string | null = null;
  const linkedPO = await db
    .select({
      id: purchaseOrders.id,
      userId: purchaseOrders.userId,
    })
    .from(purchaseOrders)
    .where(
      and(eq(purchaseOrders.supplierId, bill.supplierId), eq(purchaseOrders.userId, bill.userId)),
    )
    .limit(1)
    .get();

  if (linkedPO) {
    poCreatorId = linkedPO.userId;
  }

  const isSelfApproval =
    approvingUserId === billCreatorId || (poCreatorId !== null && approvingUserId === poCreatorId);

  if (isSelfApproval) {
    // Check if single-user mode (only one user in system)
    const userCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .get();

    const totalUsers = Number(userCount?.count) || 0;

    if (totalUsers <= 1) {
      logger.warn(
        `[BillService] WARNING: Self-approval in single-user mode — bill ${billId} approved by creator ${approvingUserId}`,
      );
    } else {
      throw new Error('Separation of duties: the bill/PO creator cannot approve their own bill');
    }
  }

  const now = new Date().toISOString();
  const approvalNotes = bill.notes
    ? `${bill.notes}\n[Approved by ${approvingUserId} at ${now}]`
    : `[Approved by ${approvingUserId} at ${now}]`;

  await db
    .update(bills)
    .set({
      status: 'approved',
      notes: approvalNotes,
      updatedAt: now,
    })
    .where(eq(bills.id, billId))
    .run();

  logger.info(`[BillService] Bill ${billId} approved by ${approvingUserId} at ${now}`);

  return await db.select().from(bills).where(eq(bills.id, billId)).get();
}

/**
 * Void a bill.
 * Only draft or awaiting_approval bills can be voided.
 * Bills with any payments cannot be voided (must reverse payments first).
 */
export async function voidBill(billId: string): Promise<any> {
  const bill = await db.select().from(bills).where(eq(bills.id, billId)).get();

  if (!bill) {
    throw new Error(`Bill not found: ${billId}`);
  }

  if (bill.status !== 'draft' && bill.status !== 'awaiting_approval') {
    throw new Error(
      `Cannot void bill in '${bill.status}' status. Only draft or awaiting_approval bills can be voided.`,
    );
  }

  // Check for existing payments
  const paymentCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(billPayments)
    .where(eq(billPayments.billId, billId))
    .get();

  if (Number(paymentCount?.count) > 0) {
    throw new Error('Cannot void a bill with existing payments. Reverse payments first.');
  }

  const now = new Date().toISOString();
  await db.update(bills).set({ status: 'void', updatedAt: now }).where(eq(bills.id, billId)).run();

  return await db.select().from(bills).where(eq(bills.id, billId)).get();
}
