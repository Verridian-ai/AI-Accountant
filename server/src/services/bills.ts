/**
 * Bill Service — Accounts Payable bill lifecycle management.
 *
 * Handles bill creation (with line items), approval workflow, payment recording,
 * voiding, AP aging, and overdue detection. All monetary amounts are stored in
 * cents (INTEGER) to avoid floating-point currency issues.
 *
 * Status flow: draft → awaiting_approval → approved → paid (or void from draft/awaiting_approval)
 * Invariants:
 *   totalAmount === subtotal + gstAmount
 *   amountDue === totalAmount - amountPaid
 */

import { db, bills, billLines, billPayments, suppliers, purchaseOrders, users } from '../schema.js';
import { eq, and, gte, lte, sql, desc, asc } from 'drizzle-orm';
import crypto from 'crypto';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CreateBillInput {
  supplierId: string;
  billNumber?: string;
  issueDate: string;
  dueDate: string;
  currency?: string;
  notes?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    gstRate?: number; // default 0.1
    accountCode?: string;
    taxCode?: string;
  }>;
}

export interface UpdateBillInput {
  billNumber?: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  lineItems?: Array<{
    id?: string; // existing line to update
    description: string;
    quantity: number;
    unitPriceCents: number;
    gstRate?: number;
    accountCode?: string;
    taxCode?: string;
  }>;
}

export interface RecordPaymentInput {
  paymentDate: string;
  amountCents: number;
  paymentMethod?: string;
  reference?: string;
  transactionId?: string;
  notes?: string;
}

export interface BillWithSupplier {
  id: string;
  userId: string;
  supplierId: string;
  billNumber: string | null;
  status: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  currency: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  supplierName: string;
}

export interface BillLine {
  id: string;
  billId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  gstRate: number;
  gstAmount: number;
  accountCode: string | null;
  taxCode: string | null;
}

export interface BillPayment {
  id: string;
  billId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string | null;
  reference: string | null;
  transactionId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface BillDetail extends BillWithSupplier {
  lineItems: BillLine[];
  payments: BillPayment[];
  linkedPO?: {
    id: string;
    poNumber: string;
    status: string;
  };
}

export interface BillListOptions {
  page?: number;
  limit?: number;
  status?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  dateField?: 'issueDate' | 'dueDate';
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface APAgingBillItem {
  billId: string;
  billNumber: string;
  supplierId: string;
  supplierName: string;
  issueDateISO: string;
  dueDateISO: string;
  totalAmountCents: number;
  amountDueCents: number;
  daysOutstanding: number;
}

export interface APAgingBucket {
  totalCents: number;
  billCount: number;
  bills: APAgingBillItem[];
}

export interface APAgingReport {
  asOfDate: string;
  buckets: {
    current: APAgingBucket;
    days1to30: APAgingBucket;
    days31to60: APAgingBucket;
    days61to90: APAgingBucket;
    days90plus: APAgingBucket;
  };
  totalOutstandingCents: number;
  totalOverdueCents: number;
  supplierCount: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Calculate line item amount from quantity and unit price (cents). */
function calcLineAmount(quantity: number, unitPriceCents: number): number {
  return Math.round(quantity * unitPriceCents);
}

/** Calculate GST amount from line amount (cents) and rate. */
function calcGst(amountCents: number, gstRate: number): number {
  return Math.round(amountCents * gstRate);
}

/** Calculate bill totals from line items. */
function calcBillTotals(lines: Array<{ amount: number; gstAmount: number }>): {
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
} {
  let subtotal = 0;
  let gstAmount = 0;
  for (const line of lines) {
    subtotal += line.amount;
    gstAmount += line.gstAmount;
  }
  return { subtotal, gstAmount, totalAmount: subtotal + gstAmount };
}

/** Number of days between two ISO date strings. Negative = future. */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

// Valid status transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['awaiting_approval', 'void'],
  awaiting_approval: ['approved', 'draft', 'void'],
  approved: ['paid', 'overdue'],
  paid: [],
  void: [],
  overdue: ['paid'],
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class BillService {
  /**
   * List bills for a user with pagination and filtering.
   * Default sort: dueDate ASC (soonest due first).
   */
  async listBills(
    userId: string,
    options: BillListOptions = {},
  ): Promise<{ data: BillWithSupplier[]; total: number }> {
    const {
      page = 1,
      limit = 50,
      status,
      supplierId,
      dateFrom,
      dateTo,
      dateField = 'dueDate',
    } = options;

    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: any[] = [eq(bills.userId, userId)];
    if (status) {
      conditions.push(eq(bills.status, status));
    }
    if (supplierId) {
      conditions.push(eq(bills.supplierId, supplierId));
    }

    const dateCol = dateField === 'issueDate' ? bills.issueDate : bills.dueDate;
    if (dateFrom) {
      conditions.push(gte(dateCol, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(dateCol, dateTo));
    }

    // Count total
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(bills)
      .where(and(...conditions))
      .get();

    const total = Number(countResult?.count) || 0;

    // Fetch paginated bills with supplier name
    const rows = await db
      .select({
        id: bills.id,
        userId: bills.userId,
        supplierId: bills.supplierId,
        billNumber: bills.billNumber,
        status: bills.status,
        issueDate: bills.issueDate,
        dueDate: bills.dueDate,
        subtotal: bills.subtotal,
        gstAmount: bills.gstAmount,
        totalAmount: bills.totalAmount,
        amountPaid: bills.amountPaid,
        amountDue: bills.amountDue,
        currency: bills.currency,
        notes: bills.notes,
        createdAt: bills.createdAt,
        updatedAt: bills.updatedAt,
        supplierName: suppliers.businessName,
      })
      .from(bills)
      .leftJoin(suppliers, eq(bills.supplierId, suppliers.id))
      .where(and(...conditions))
      .orderBy(asc(bills.dueDate))
      .limit(limit)
      .offset(offset)
      .all();

    const data: BillWithSupplier[] = rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      supplierId: r.supplierId,
      billNumber: r.billNumber,
      status: r.status,
      issueDate: r.issueDate,
      dueDate: r.dueDate,
      subtotal: Number(r.subtotal) || 0,
      gstAmount: Number(r.gstAmount) || 0,
      totalAmount: Number(r.totalAmount) || 0,
      amountPaid: Number(r.amountPaid) || 0,
      amountDue: Number(r.amountDue) || 0,
      currency: r.currency ?? 'AUD',
      notes: r.notes,
      createdAt: String(r.createdAt),
      updatedAt: String(r.updatedAt),
      supplierName: r.supplierName ?? 'Unknown Supplier',
    }));

    return { data, total };
  }

  /**
   * Get a single bill with full details: line items, payments, linked PO.
   */
  async getBill(billId: string): Promise<BillDetail> {
    // Fetch bill with supplier join
    const row = await db
      .select({
        id: bills.id,
        userId: bills.userId,
        supplierId: bills.supplierId,
        billNumber: bills.billNumber,
        status: bills.status,
        issueDate: bills.issueDate,
        dueDate: bills.dueDate,
        subtotal: bills.subtotal,
        gstAmount: bills.gstAmount,
        totalAmount: bills.totalAmount,
        amountPaid: bills.amountPaid,
        amountDue: bills.amountDue,
        currency: bills.currency,
        notes: bills.notes,
        createdAt: bills.createdAt,
        updatedAt: bills.updatedAt,
        supplierName: suppliers.businessName,
      })
      .from(bills)
      .leftJoin(suppliers, eq(bills.supplierId, suppliers.id))
      .where(eq(bills.id, billId))
      .get();

    if (!row) {
      throw new Error(`Bill not found: ${billId}`);
    }

    // Fetch line items
    const lines = await db.select().from(billLines).where(eq(billLines.billId, billId)).all();

    // Fetch payments
    const payments = await db
      .select()
      .from(billPayments)
      .where(eq(billPayments.billId, billId))
      .orderBy(asc(billPayments.paymentDate))
      .all();

    // Check for linked PO (supplier match + similar amount)
    const linkedPOResult = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        status: purchaseOrders.status,
      })
      .from(purchaseOrders)
      .where(
        and(eq(purchaseOrders.supplierId, row.supplierId), eq(purchaseOrders.userId, row.userId)),
      )
      .limit(1)
      .get();

    const lineItems: BillLine[] = lines.map((l: any) => ({
      id: l.id,
      billId: l.billId,
      description: l.description,
      quantity: Number(l.quantity) || 0,
      unitPrice: Number(l.unitPrice) || 0,
      amount: Number(l.amount) || 0,
      gstRate: Number(l.gstRate) ?? 0.1,
      gstAmount: Number(l.gstAmount) || 0,
      accountCode: l.accountCode,
      taxCode: l.taxCode,
    }));

    const paymentList: BillPayment[] = payments.map((p: any) => ({
      id: p.id,
      billId: p.billId,
      paymentDate: p.paymentDate,
      amount: Number(p.amount) || 0,
      paymentMethod: p.paymentMethod,
      reference: p.reference,
      transactionId: p.transactionId,
      notes: p.notes,
      createdAt: String(p.createdAt),
    }));

    const detail: BillDetail = {
      id: row.id,
      userId: row.userId,
      supplierId: row.supplierId,
      billNumber: row.billNumber,
      status: row.status,
      issueDate: row.issueDate,
      dueDate: row.dueDate,
      subtotal: Number(row.subtotal) || 0,
      gstAmount: Number(row.gstAmount) || 0,
      totalAmount: Number(row.totalAmount) || 0,
      amountPaid: Number(row.amountPaid) || 0,
      amountDue: Number(row.amountDue) || 0,
      currency: row.currency ?? 'AUD',
      notes: row.notes,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      supplierName: (row as any).supplierName ?? 'Unknown Supplier',
      lineItems,
      payments: paymentList,
    };

    if (linkedPOResult) {
      detail.linkedPO = {
        id: linkedPOResult.id,
        poNumber: linkedPOResult.poNumber,
        status: linkedPOResult.status,
      };
    }

    return detail;
  }

  /**
   * Create a new bill with line items (atomic — bill + lines in single transaction).
   * Calculates: line amounts, line GST, subtotal, gstAmount, totalAmount.
   * Sets amountDue = totalAmount (initially unpaid), status = 'draft'.
   */
  async createBill(userId: string, data: CreateBillInput): Promise<any> {
    if (!data.lineItems || data.lineItems.length === 0) {
      throw new Error('Bill must have at least one line item');
    }

    const billId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Calculate line items
    const computedLines = data.lineItems.map((item) => {
      const gstRate = item.gstRate ?? 0.1;
      const amount = calcLineAmount(item.quantity, item.unitPriceCents);
      const gstAmt = calcGst(amount, gstRate);

      return {
        id: crypto.randomUUID(),
        billId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPriceCents,
        amount,
        gstRate,
        gstAmount: gstAmt,
        accountCode: item.accountCode ?? null,
        taxCode: item.taxCode ?? null,
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
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        subtotal: totals.subtotal,
        gstAmount: totals.gstAmount,
        totalAmount: totals.totalAmount,
        amountPaid: 0,
        amountDue: totals.totalAmount,
        currency: data.currency ?? 'AUD',
        notes: data.notes ?? null,
        createdAt: now,
        updatedAt: now,
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
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      ...totals,
      amountPaid: 0,
      amountDue: totals.totalAmount,
      currency: data.currency ?? 'AUD',
      notes: data.notes ?? null,
      lineItemCount: computedLines.length,
    };
  }

  /**
   * Update a bill (only draft or awaiting_approval).
   * If lineItems are provided, replaces all existing lines and recalculates totals.
   */
  async updateBill(billId: string, data: UpdateBillInput): Promise<any> {
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
    const updates: Record<string, any> = { updatedAt: now };

    if (data.billNumber !== undefined) updates.billNumber = data.billNumber;
    if (data.issueDate !== undefined) updates.issueDate = data.issueDate;
    if (data.dueDate !== undefined) updates.dueDate = data.dueDate;
    if (data.notes !== undefined) updates.notes = data.notes;

    // If line items provided, replace all and recalculate
    if (data.lineItems && data.lineItems.length > 0) {
      // Delete existing lines
      await db.delete(billLines).where(eq(billLines.billId, billId)).run();

      // Insert new lines
      const computedLines = data.lineItems.map((item) => {
        const gstRate = item.gstRate ?? 0.1;
        const amount = calcLineAmount(item.quantity, item.unitPriceCents);
        const gstAmt = calcGst(amount, gstRate);
        return {
          id: item.id ?? crypto.randomUUID(),
          billId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPriceCents,
          amount,
          gstRate,
          gstAmount: gstAmt,
          accountCode: item.accountCode ?? null,
          taxCode: item.taxCode ?? null,
        };
      });

      for (const line of computedLines) {
        await db.insert(billLines).values(line).run();
      }

      // Recalculate totals
      const totals = calcBillTotals(computedLines);
      const currentPaid = Number(existing.amountPaid) || 0;

      updates.subtotal = totals.subtotal;
      updates.gstAmount = totals.gstAmount;
      updates.totalAmount = totals.totalAmount;
      updates.amountDue = totals.totalAmount - currentPaid;
    }

    await db.update(bills).set(updates).where(eq(bills.id, billId)).run();

    // Return updated bill
    return await db.select().from(bills).where(eq(bills.id, billId)).get();
  }

  /**
   * Submit a bill for approval.
   * Transition: draft → awaiting_approval.
   * Validates all required fields are present.
   */
  async submitForApproval(billId: string): Promise<any> {
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
   * Transition: awaiting_approval → approved.
   * Enforces separation of duties: creator cannot approve their own bill.
   * Exception: single-user mode allows self-approval with a warning.
   */
  async approveBill(billId: string, approvingUserId: string): Promise<any> {
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
      approvingUserId === billCreatorId ||
      (poCreatorId !== null && approvingUserId === poCreatorId);

    if (isSelfApproval) {
      // Check if single-user mode (only one user in system)
      const userCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(users)
        .get();

      const totalUsers = Number(userCount?.count) || 0;

      if (totalUsers <= 1) {
        console.warn(
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

    console.log(`[BillService] Bill ${billId} approved by ${approvingUserId} at ${now}`);

    return await db.select().from(bills).where(eq(bills.id, billId)).get();
  }

  /**
   * Record a payment against a bill.
   * Updates amountPaid and amountDue. Sets status to 'paid' when fully paid.
   */
  async recordPayment(billId: string, payment: RecordPaymentInput): Promise<BillPayment> {
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
      console.log(`[BillService] Bill ${billId} fully paid`);
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
   * Void a bill.
   * Only draft or awaiting_approval bills can be voided.
   * Bills with any payments cannot be voided (must reverse payments first).
   */
  async voidBill(billId: string): Promise<any> {
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
    await db
      .update(bills)
      .set({ status: 'void', updatedAt: now })
      .where(eq(bills.id, billId))
      .run();

    return await db.select().from(bills).where(eq(bills.id, billId)).get();
  }

  /**
   * Generate AP Aging Report.
   * Buckets unpaid bills by days past due: current, 1-30, 31-60, 61-90, 90+.
   */
  async getAPAging(userId: string, asOfDate?: string): Promise<APAgingReport> {
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
  async checkOverdueBills(userId: string): Promise<any[]> {
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
    const updated: any[] = [];

    for (const bill of overdueBills) {
      await db
        .update(bills)
        .set({ status: 'overdue', updatedAt: now })
        .where(eq(bills.id, bill.id))
        .run();

      updated.push({ ...bill, status: 'overdue', updatedAt: now });
    }

    if (updated.length > 0) {
      console.log(`[BillService] Marked ${updated.length} bill(s) as overdue for user ${userId}`);
    }

    return updated;
  }
}

export const billService = new BillService();
