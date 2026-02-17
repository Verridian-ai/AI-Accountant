/**
 * Bill payment tracking — record payments, AP aging report, overdue detection.
 *
 * All monetary amounts are stored in cents (INTEGER).
 * AP Aging buckets: current, 1-30, 31-60, 61-90, 90+ days.
 */

import { db, bills, billPayments, suppliers } from '../../schema.js';
import { eq, and, sql, asc } from 'drizzle-orm';
import crypto from 'crypto';
import { logger } from '../../lib/logger.js';
import {
  type RecordPaymentInput,
  type BillPayment,
  type APAgingReport,
  type APAgingBillItem,
  daysBetween,
} from './types.js';

/**
 * Record a payment against a bill.
 * Updates amountPaid and amountDue. Sets status to 'paid' when fully paid.
 */
export async function recordPayment(
  billId: string,
  payment: RecordPaymentInput,
): Promise<BillPayment> {
  const bill = await db.select().from(bills).where(eq(bills.id, billId)).get();

  if (!bill) {
    throw new Error(`Bill not found: ${billId}`);
  }

  if (bill.status !== 'approved' && bill.status !== 'overdue') {
    throw new Error(
      `Cannot record payment: bill status is '${bill.status}'. Bill must be approved or overdue.`,
    );
  }

  if (payment.amountCents <= 0) {
    throw new Error('Payment amount must be positive');
  }

  const currentDue = Number(bill.amountDue) || 0;
  if (payment.amountCents > currentDue) {
    throw new Error(`Payment amount (${payment.amountCents}) exceeds amount due (${currentDue})`);
  }

  const paymentId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Insert payment record
  await db
    .insert(billPayments)
    .values({
      id: paymentId,
      billId,
      paymentDate: payment.paymentDate,
      amount: payment.amountCents,
      paymentMethod: payment.paymentMethod ?? null,
      reference: payment.reference ?? null,
      transactionId: payment.transactionId ?? null,
      notes: payment.notes ?? null,
      createdAt: now,
    })
    .run();

  // Update bill totals
  const newAmountPaid = (Number(bill.amountPaid) || 0) + payment.amountCents;
  const newAmountDue = (Number(bill.totalAmount) || 0) - newAmountPaid;
  const newStatus = newAmountDue <= 0 ? 'paid' : bill.status;

  await db
    .update(bills)
    .set({
      amountPaid: newAmountPaid,
      amountDue: Math.max(0, newAmountDue),
      status: newStatus,
      updatedAt: now,
    })
    .where(eq(bills.id, billId))
    .run();

  if (newStatus === 'paid') {
    logger.info(`[BillService] Bill ${billId} fully paid`);
  }

  return {
    id: paymentId,
    billId,
    paymentDate: payment.paymentDate,
    amount: payment.amountCents,
    paymentMethod: payment.paymentMethod ?? null,
    reference: payment.reference ?? null,
    transactionId: payment.transactionId ?? null,
    notes: payment.notes ?? null,
    createdAt: now,
  };
}

/**
 * Generate AP Aging Report.
 * Buckets unpaid bills by days past due: current, 1-30, 31-60, 61-90, 90+.
 */
export async function getAPAging(userId: string, asOfDate?: string): Promise<APAgingReport> {
  const referenceDate = asOfDate ?? new Date().toISOString().split('T')[0];

  // Fetch all unpaid bills (approved or overdue) with supplier names
  const unpaidBills = await db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      supplierId: bills.supplierId,
      issueDate: bills.issueDate,
      dueDate: bills.dueDate,
      totalAmount: bills.totalAmount,
      amountDue: bills.amountDue,
      status: bills.status,
      supplierName: suppliers.businessName,
    })
    .from(bills)
    .leftJoin(suppliers, eq(bills.supplierId, suppliers.id))
    .where(
      and(
        eq(bills.userId, userId),
        sql`${bills.status} IN ('approved', 'overdue')`,
        sql`${bills.amountDue} > 0`,
      ),
    )
    .orderBy(asc(bills.dueDate))
    .all();

  // Initialize buckets
  const buckets: APAgingReport['buckets'] = {
    current: { totalCents: 0, billCount: 0, bills: [] },
    days1to30: { totalCents: 0, billCount: 0, bills: [] },
    days31to60: { totalCents: 0, billCount: 0, bills: [] },
    days61to90: { totalCents: 0, billCount: 0, bills: [] },
    days90plus: { totalCents: 0, billCount: 0, bills: [] },
  };

  let totalOutstandingCents = 0;
  let totalOverdueCents = 0;
  const supplierIds = new Set<string>();

  for (const bill of unpaidBills) {
    const dueCents = Number(bill.amountDue) || 0;
    const daysOutstanding = daysBetween(referenceDate, bill.dueDate);

    const item: APAgingBillItem = {
      billId: bill.id,
      billNumber: bill.billNumber ?? '',
      supplierId: bill.supplierId,
      supplierName: (bill as any).supplierName ?? 'Unknown',
      issueDateISO: bill.issueDate,
      dueDateISO: bill.dueDate,
      totalAmountCents: Number(bill.totalAmount) || 0,
      amountDueCents: dueCents,
      daysOutstanding: Math.max(0, daysOutstanding),
    };

    totalOutstandingCents += dueCents;
    supplierIds.add(bill.supplierId);

    if (daysOutstanding <= 0) {
      // Not yet due
      buckets.current.totalCents += dueCents;
      buckets.current.billCount++;
      buckets.current.bills.push(item);
    } else if (daysOutstanding <= 30) {
      buckets.days1to30.totalCents += dueCents;
      buckets.days1to30.billCount++;
      buckets.days1to30.bills.push(item);
      totalOverdueCents += dueCents;
    } else if (daysOutstanding <= 60) {
      buckets.days31to60.totalCents += dueCents;
      buckets.days31to60.billCount++;
      buckets.days31to60.bills.push(item);
      totalOverdueCents += dueCents;
    } else if (daysOutstanding <= 90) {
      buckets.days61to90.totalCents += dueCents;
      buckets.days61to90.billCount++;
      buckets.days61to90.bills.push(item);
      totalOverdueCents += dueCents;
    } else {
      buckets.days90plus.totalCents += dueCents;
      buckets.days90plus.billCount++;
      buckets.days90plus.bills.push(item);
      totalOverdueCents += dueCents;
    }
  }

  return {
    asOfDate: referenceDate,
    buckets,
    totalOutstandingCents,
    totalOverdueCents,
    supplierCount: supplierIds.size,
  };
}

/**
 * Check for overdue bills and update their status.
 * Finds all approved bills past their due date and marks them 'overdue'.
 * Returns list of newly overdue bills.
 */
export async function checkOverdueBills(
  userId: string,
): Promise<Array<typeof bills.$inferSelect & { status: 'overdue'; updatedAt: string }>> {
  const today = new Date().toISOString().split('T')[0];

  // Find approved bills past due date
  const overdueBills = await db
    .select()
    .from(bills)
    .where(
      and(
        eq(bills.userId, userId),
        eq(bills.status, 'approved'),
        sql`${bills.dueDate} < ${today}`,
        sql`${bills.amountDue} > 0`,
      ),
    )
    .all();

  const now = new Date().toISOString();
  const updated: Array<typeof bills.$inferSelect & { status: 'overdue'; updatedAt: string }> = [];

  for (const bill of overdueBills) {
    await db
      .update(bills)
      .set({ status: 'overdue', updatedAt: now })
      .where(eq(bills.id, bill.id))
      .run();

    updated.push({ ...bill, status: 'overdue', updatedAt: now });
  }

  if (updated.length > 0) {
    logger.info(`[BillService] Marked ${updated.length} bill(s) as overdue for user ${userId}`);
  }

  return updated;
}
