/**
 * Payment Runs — Batch payment processing for approved bills.
 *
 * Creates payment runs, processes them atomically via BillService,
 * and retrieves run details with linked bill/supplier information.
 *
 * Status flow: draft -> processing -> completed
 * If any payment fails, the run stays in 'processing' for manual review.
 */

import { logger } from '../../lib/logger.js';
import {
  db,
  bills,
  suppliers,
  supplierPaymentRuns,
  supplierPaymentRunItems,
} from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { billService } from '../bills.js';
import { type CreatePaymentRunInput, type PaymentRunDetail } from './types.js';

/**
 * Create a batch payment run for multiple approved bills.
 * Calculates total, generates bank reference, sets status = 'draft'.
 */
export async function createPaymentRun(userId: string, data: CreatePaymentRunInput): Promise<any> {
  if (!data.billIds || data.billIds.length === 0) {
    throw new Error('Payment run must include at least one bill');
  }

  // Validate all bills are approved and belong to user
  let totalAmount = 0;
  const billDetails: Array<{ id: string; amountDue: number }> = [];

  for (const bId of data.billIds) {
    const bill = await db
      .select()
      .from(bills)
      .where(and(eq(bills.id, bId), eq(bills.userId, userId)))
      .get();

    if (!bill) {
      throw new Error(`Bill not found or not owned by user: ${bId}`);
    }

    if (bill.status !== 'approved' && bill.status !== 'overdue') {
      throw new Error(
        `Bill ${bill.billNumber ?? bId} is in '${bill.status}' status. Only approved or overdue bills can be included in a payment run.`,
      );
    }

    const amountDue = Number(bill.amountDue) || 0;
    if (amountDue <= 0) {
      throw new Error(`Bill ${bill.billNumber ?? bId} has no amount due`);
    }

    totalAmount += amountDue;
    billDetails.push({ id: bId, amountDue });
  }

  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  const bankReference =
    data.bankReference ??
    `PAY-${now.split('T')[0].replace(/-/g, '')}-${runId.slice(0, 6).toUpperCase()}`;

  // Insert payment run
  await db
    .insert(supplierPaymentRuns)
    .values({
      id: runId,
      userId,
      paymentDate: data.paymentDate,
      status: 'draft',
      totalAmount,
      bankReference,
      createdAt: now,
    })
    .run();

  // Insert run items
  for (const bd of billDetails) {
    await db
      .insert(supplierPaymentRunItems)
      .values({
        id: crypto.randomUUID(),
        paymentRunId: runId,
        billId: bd.id,
        amount: bd.amountDue,
      })
      .run();
  }

  logger.info(
    `[PurchaseOrderService] Payment run ${runId} created: ${billDetails.length} bills, total ${totalAmount} cents`,
  );

  return {
    id: runId,
    userId,
    paymentDate: data.paymentDate,
    status: 'draft',
    totalAmount,
    bankReference,
    billCount: billDetails.length,
    createdAt: now,
  };
}

/**
 * Process a payment run: records payment for each bill atomically.
 * Transition: draft -> processing -> completed.
 * Uses BillService.recordPayment() for each bill.
 * If any payment fails, the run stays in 'processing' for manual review.
 */
export async function processPaymentRun(paymentRunId: string): Promise<any> {
  const run = await db
    .select()
    .from(supplierPaymentRuns)
    .where(eq(supplierPaymentRuns.id, paymentRunId))
    .get();

  if (!run) {
    throw new Error(`Payment run not found: ${paymentRunId}`);
  }

  if (run.status !== 'draft') {
    throw new Error(`Cannot process payment run: status is '${run.status}', expected 'draft'`);
  }

  // Mark as processing
  const now = new Date().toISOString();
  await db
    .update(supplierPaymentRuns)
    .set({ status: 'processing' })
    .where(eq(supplierPaymentRuns.id, paymentRunId))
    .run();

  // Fetch run items
  const items = await db
    .select()
    .from(supplierPaymentRunItems)
    .where(eq(supplierPaymentRunItems.paymentRunId, paymentRunId))
    .all();

  // Process each bill payment
  const errors: string[] = [];
  for (const item of items) {
    try {
      await billService.recordPayment(item.billId, {
        paymentDate: run.paymentDate,
        amountCents: Number(item.amount) || 0,
        paymentMethod: 'bank_transfer',
        reference: run.bankReference ?? undefined,
        notes: `Payment run ${paymentRunId}`,
      });
    } catch (err: unknown) {
      errors.push(
        `Bill ${item.billId}: ${err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err)}`,
      );
    }
  }

  // If any errors, keep as processing for manual review
  const finalStatus = errors.length === 0 ? 'completed' : 'processing';
  await db
    .update(supplierPaymentRuns)
    .set({ status: finalStatus })
    .where(eq(supplierPaymentRuns.id, paymentRunId))
    .run();

  if (errors.length > 0) {
    logger.error(
      { err: errors },
      `[PurchaseOrderService] Payment run ${paymentRunId} had ${errors.length} error(s):`,
    );
  } else {
    logger.info(
      `[PurchaseOrderService] Payment run ${paymentRunId} completed: ${items.length} bills paid`,
    );
  }

  return {
    id: paymentRunId,
    status: finalStatus,
    processedAt: now,
    totalBills: items.length,
    successCount: items.length - errors.length,
    errorCount: errors.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Get a payment run with all items and linked bill/supplier details.
 */
export async function getPaymentRun(paymentRunId: string): Promise<PaymentRunDetail> {
  const run = await db
    .select()
    .from(supplierPaymentRuns)
    .where(eq(supplierPaymentRuns.id, paymentRunId))
    .get();

  if (!run) {
    throw new Error(`Payment run not found: ${paymentRunId}`);
  }

  // Fetch items with bill + supplier details via JOIN
  const itemRows = await db
    .select({
      id: supplierPaymentRunItems.id,
      paymentRunId: supplierPaymentRunItems.paymentRunId,
      billId: supplierPaymentRunItems.billId,
      amount: supplierPaymentRunItems.amount,
      billNumber: bills.billNumber,
      supplierName: suppliers.businessName,
    })
    .from(supplierPaymentRunItems)
    .leftJoin(bills, eq(supplierPaymentRunItems.billId, bills.id))
    .leftJoin(suppliers, eq(bills.supplierId, suppliers.id))
    .where(eq(supplierPaymentRunItems.paymentRunId, paymentRunId))
    .all();

  const items = (itemRows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    paymentRunId: r.paymentRunId as string,
    billId: r.billId as string,
    amount: Number(r.amount) || 0,
    billNumber: (r.billNumber as string) ?? '',
    supplierName: (r.supplierName as string) ?? 'Unknown Supplier',
    amountCents: Number(r.amount) || 0,
  }));

  return {
    id: run.id,
    userId: run.userId,
    paymentDate: run.paymentDate,
    status: run.status,
    totalAmount: Number(run.totalAmount) || 0,
    bankReference: run.bankReference ?? null,
    createdAt: String(run.createdAt),
    items,
  };
}
