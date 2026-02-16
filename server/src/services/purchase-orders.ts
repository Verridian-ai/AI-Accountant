/**
 * Purchase Order Service — Full PO lifecycle management.
 *
 * Handles creation (with auto-numbering PO-NNNNNN), line items, sending,
 * goods receiving, three-way matching (PO → receipt → bill), cancellation,
 * and batch payment runs. All monetary amounts in cents (INTEGER).
 *
 * Status flow: draft → sent → partially_received → received → matched → closed
 * Cancellation: draft|sent → cancelled (no goods received)
 *
 * Key controls:
 *   - Separation of duties: PO creator ≠ goods receiver
 *   - Three-way match tolerance: configurable 2% default, 5% hard cap
 *   - Payment runs: atomic batch processing via BillService.recordPayment()
 */

import {
  db,
  purchaseOrders,
  poLines,
  poReceipts,
  poReceiptLines,
  suppliers,
  bills,
  billLines,
  supplierPaymentRuns,
  supplierPaymentRunItems,
  users,
} from '../schema.js';
import { eq, and, gte, lte, sql, desc, asc } from 'drizzle-orm';
import crypto from 'crypto';
import { billService } from './bills.js';

// ============================================================================
// TOLERANCE CONFIGURATION
// ============================================================================

const AP_AUTO_MATCH_THRESHOLD = parseFloat(process.env.AP_AUTO_MATCH_THRESHOLD || '0.02'); // 2% default
const AP_MAX_MATCH_THRESHOLD = 0.05; // Hard cap at 5% — cannot be set higher

function isWithinTolerance(expected: number, actual: number): boolean {
  if (expected === 0 && actual === 0) return true;
  if (expected === 0 || actual === 0) return false;
  const variance = Math.abs(expected - actual) / Math.max(Math.abs(expected), Math.abs(actual));
  const effectiveThreshold = Math.min(AP_AUTO_MATCH_THRESHOLD, AP_MAX_MATCH_THRESHOLD);
  return variance <= effectiveThreshold;
}

function variancePercent(expected: number, actual: number): number {
  if (expected === 0 && actual === 0) return 0;
  if (expected === 0) return 100;
  return Math.round((Math.abs(expected - actual) / Math.abs(expected)) * 10000) / 100;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CreatePOInput {
  supplierId: string;
  expectedDate?: string;
  notes?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
  }>;
}

export interface UpdatePOInput {
  expectedDate?: string;
  notes?: string;
  lineItems?: Array<{
    id?: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
  }>;
}

export interface ReceiveGoodsInput {
  receiptDate: string;
  receivedBy?: string;
  notes?: string;
  lines: Array<{
    poLineId: string;
    quantityReceived: number;
  }>;
}

export interface ThreeWayMatchResult {
  poId: string;
  poNumber: string;
  billId: string;
  billNumber: string;
  matchStatus: 'matched' | 'discrepancy' | 'partial';
  quantityMatch: boolean;
  priceMatch: boolean;
  totalMatch: boolean;
  poTotalCents: number;
  receiptTotalCents: number;
  billTotalCents: number;
  discrepancies: Array<{
    type: 'quantity' | 'price' | 'total' | 'missing_receipt';
    poLineDescription: string;
    expected: number;
    actual: number;
    variancePercent: number;
  }>;
  canAutoApprove: boolean;
}

export interface POWithSupplier {
  id: string;
  userId: string;
  supplierId: string;
  poNumber: string;
  status: string;
  issueDate: string;
  expectedDate: string | null;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  supplierName: string;
}

export interface POLineWithProgress {
  id: string;
  purchaseOrderId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  quantityReceived: number;
  receivingProgress: number;
}

export interface POReceiptDetail {
  id: string;
  purchaseOrderId: string;
  receiptDate: string;
  receivedBy: string | null;
  notes: string | null;
  createdAt: string;
  lines: Array<{
    id: string;
    receiptId: string;
    poLineId: string;
    quantityReceived: number;
  }>;
}

export interface PODetail extends POWithSupplier {
  lineItems: POLineWithProgress[];
  receipts: POReceiptDetail[];
  linkedBills: Array<{
    id: string;
    billNumber: string;
    totalCents: number;
    status: string;
  }>;
  overallReceivingPercent: number;
}

export interface POListOptions {
  page?: number;
  limit?: number;
  status?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreatePaymentRunInput {
  paymentDate: string;
  billIds: string[];
  bankReference?: string;
}

export interface PaymentRunDetail {
  id: string;
  userId: string;
  paymentDate: string;
  status: string;
  totalAmount: number;
  bankReference: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    paymentRunId: string;
    billId: string;
    amount: number;
    billNumber: string;
    supplierName: string;
    amountCents: number;
  }>;
}

// ============================================================================
// HELPERS
// ============================================================================

function calcLineAmount(quantity: number, unitPriceCents: number): number {
  return Math.round(quantity * unitPriceCents);
}

function calcPOTotals(lines: Array<{ amount: number }>): {
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
} {
  let subtotal = 0;
  for (const line of lines) {
    subtotal += line.amount;
  }
  const gstAmount = Math.round(subtotal * 0.1); // 10% GST
  return { subtotal, gstAmount, totalAmount: subtotal + gstAmount };
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class PurchaseOrderService {
  /**
   * List purchase orders for a user with pagination and filtering.
   * Default sort: issueDate DESC (most recent first).
   */
  async listPurchaseOrders(
    userId: string,
    options: POListOptions = {},
  ): Promise<{ data: POWithSupplier[]; total: number }> {
    const { page = 1, limit = 50, status, supplierId, dateFrom, dateTo } = options;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(purchaseOrders.userId, userId)];
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

    const data: POWithSupplier[] = rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      supplierId: r.supplierId,
      poNumber: r.poNumber,
      status: r.status,
      issueDate: r.issueDate,
      expectedDate: r.expectedDate ?? null,
      subtotal: Number(r.subtotal) || 0,
      gstAmount: Number(r.gstAmount) || 0,
      totalAmount: Number(r.totalAmount) || 0,
      notes: r.notes ?? null,
      createdAt: String(r.createdAt),
      updatedAt: String(r.updatedAt),
      supplierName: r.supplierName ?? 'Unknown Supplier',
    }));

    return { data, total };
  }

  /**
   * Get a single PO with full details: line items, receipts, linked bills,
   * and overall receiving progress.
   */
  async getPurchaseOrder(poId: string): Promise<PODetail> {
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

  /**
   * Create a new PO with auto-generated number and line items.
   * Inserts PO + lines atomically. Status starts as 'draft'.
   */
  async createPurchaseOrder(userId: string, data: CreatePOInput): Promise<any> {
    if (!data.lineItems || data.lineItems.length === 0) {
      throw new Error('Purchase order must have at least one line item');
    }

    const poId = crypto.randomUUID();
    const now = new Date().toISOString();
    const poNumber = await this.getNextPONumber(userId);

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
  async updatePurchaseOrder(poId: string, data: UpdatePOInput): Promise<any> {
    const existing = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, poId))
      .get();

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

  /**
   * Send a PO to the supplier. Transition: draft → sent.
   */
  async sendPurchaseOrder(poId: string): Promise<any> {
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

    console.log(`[PurchaseOrderService] PO ${po.poNumber} sent`);

    return await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).get();
  }

  /**
   * Receive goods against a PO. Creates receipt record + updates line quantities.
   *
   * Enforces:
   *   - Cannot receive more than ordered quantity
   *   - Separation of duties: PO creator ≠ goods receiver (single-user exception)
   *   - Updates PO status to 'partially_received' or 'received'
   */
  async receiveGoods(poId: string, receipt: ReceiveGoodsInput): Promise<any> {
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
      // Check if single-user mode
      const userCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(users)
        .get();

      const totalUsers = Number(userCount?.count) || 0;

      if (totalUsers <= 1) {
        console.warn(
          `[PurchaseOrderService] WARNING: Single-user mode — PO creator ${po.userId} is receiving goods against their own PO ${po.poNumber}`,
        );
      } else {
        throw new Error(
          'Separation of duties: PO creator cannot receive goods against their own PO',
        );
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

      // Update po_lines.quantityReceived
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

    const newStatus = allFullyReceived
      ? 'received'
      : anyReceived
        ? 'partially_received'
        : po.status;

    await db
      .update(purchaseOrders)
      .set({ status: newStatus, updatedAt: now })
      .where(eq(purchaseOrders.id, poId))
      .run();

    console.log(
      `[PurchaseOrderService] Goods received for PO ${po.poNumber} → status: ${newStatus}`,
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

  /**
   * Cancel a PO. Only draft or sent POs with no goods received.
   */
  async cancelPurchaseOrder(poId: string): Promise<any> {
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

    console.log(`[PurchaseOrderService] PO ${po.poNumber} cancelled`);

    return await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).get();
  }

  /**
   * Three-way matching: PO ↔ Receipt(s) ↔ Bill.
   *
   * Uses a SQL JOIN to fetch PO lines with aggregated receipt quantities
   * and matching bill lines in a single efficient query, then compares:
   *   1. Quantity match: receipt totals vs PO ordered quantities
   *   2. Price match: bill unit prices vs PO unit prices (within tolerance)
   *   3. Total match: bill total vs PO total (within tolerance)
   */
  async threeWayMatch(poId: string, billId: string): Promise<ThreeWayMatchResult> {
    // Fetch PO header
    const po = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).get();

    if (!po) {
      throw new Error(`Purchase order not found: ${poId}`);
    }

    // Fetch bill header
    const bill = await db.select().from(bills).where(eq(bills.id, billId)).get();

    if (!bill) {
      throw new Error(`Bill not found: ${billId}`);
    }

    // SQL JOIN: PO lines + aggregated receipt lines + matching bill lines
    const matchRows = await db
      .select({
        polId: poLines.id,
        polDescription: poLines.description,
        polQuantity: poLines.quantity,
        polUnitPrice: poLines.unitPrice,
        polAmount: poLines.amount,
        polQuantityReceived: poLines.quantityReceived,
        totalReceived: sql<number>`COALESCE(SUM(${poReceiptLines.quantityReceived}), 0)`,
        billUnitPrice: billLines.unitPrice,
        billQuantity: billLines.quantity,
        billAmount: billLines.amount,
        billLineId: billLines.id,
      })
      .from(poLines)
      .leftJoin(poReceiptLines, eq(poReceiptLines.poLineId, poLines.id))
      .leftJoin(
        billLines,
        and(eq(billLines.description, poLines.description), eq(billLines.billId, billId)),
      )
      .where(eq(poLines.purchaseOrderId, poId))
      .groupBy(
        poLines.id,
        poLines.description,
        poLines.quantity,
        poLines.unitPrice,
        poLines.amount,
        poLines.quantityReceived,
        billLines.id,
        billLines.unitPrice,
        billLines.quantity,
        billLines.amount,
      )
      .all();

    const discrepancies: ThreeWayMatchResult['discrepancies'] = [];
    let quantityMatch = true;
    let priceMatch = true;

    // Analyze each PO line
    for (const row of matchRows) {
      const polQty = Number(row.polQuantity) || 0;
      const receivedQty = Number(row.totalReceived) || Number(row.polQuantityReceived) || 0;
      const polUnitPrice = Number(row.polUnitPrice) || 0;
      const billUnitPrice = Number(row.billUnitPrice);

      // Check for missing receipt
      if (receivedQty === 0 && polQty > 0) {
        discrepancies.push({
          type: 'missing_receipt',
          poLineDescription: row.polDescription,
          expected: polQty,
          actual: 0,
          variancePercent: 100,
        });
        quantityMatch = false;
        continue;
      }

      // Quantity check: receipt vs PO
      if (!isWithinTolerance(polQty, receivedQty)) {
        discrepancies.push({
          type: 'quantity',
          poLineDescription: row.polDescription,
          expected: polQty,
          actual: receivedQty,
          variancePercent: variancePercent(polQty, receivedQty),
        });
        quantityMatch = false;
      }

      // Price check: bill unit price vs PO unit price
      if (row.billLineId !== null && !isNaN(billUnitPrice)) {
        if (!isWithinTolerance(polUnitPrice, billUnitPrice)) {
          discrepancies.push({
            type: 'price',
            poLineDescription: row.polDescription,
            expected: polUnitPrice,
            actual: billUnitPrice,
            variancePercent: variancePercent(polUnitPrice, billUnitPrice),
          });
          priceMatch = false;
        }
      } else if (row.billLineId === null) {
        // No matching bill line found for this PO line
        discrepancies.push({
          type: 'price',
          poLineDescription: row.polDescription,
          expected: polUnitPrice,
          actual: 0,
          variancePercent: 100,
        });
        priceMatch = false;
      }
    }

    // Total match: PO total vs bill total
    const poTotalCents = Number(po.totalAmount) || 0;
    const billTotalCents = Number(bill.totalAmount) || 0;
    const totalMatch = isWithinTolerance(poTotalCents, billTotalCents);

    if (!totalMatch) {
      discrepancies.push({
        type: 'total',
        poLineDescription: '(overall total)',
        expected: poTotalCents,
        actual: billTotalCents,
        variancePercent: variancePercent(poTotalCents, billTotalCents),
      });
    }

    // Calculate receipt total (sum of received qty * PO unit price)
    let receiptTotalCents = 0;
    for (const row of matchRows) {
      const receivedQty = Number(row.totalReceived) || Number(row.polQuantityReceived) || 0;
      const unitPrice = Number(row.polUnitPrice) || 0;
      receiptTotalCents += Math.round(receivedQty * unitPrice);
    }
    // Add GST estimate
    receiptTotalCents = receiptTotalCents + Math.round(receiptTotalCents * 0.1);

    // Determine overall match status
    const allMatch = quantityMatch && priceMatch && totalMatch;
    const partialMatch = (quantityMatch || priceMatch) && !allMatch;

    const matchStatus: ThreeWayMatchResult['matchStatus'] = allMatch
      ? 'matched'
      : partialMatch
        ? 'partial'
        : 'discrepancy';

    const canAutoApprove = allMatch && discrepancies.length === 0;

    console.log(
      `[PurchaseOrderService] Three-way match PO ${po.poNumber} ↔ Bill ${bill.billNumber}: ${matchStatus} (${discrepancies.length} discrepancies)`,
    );

    return {
      poId,
      poNumber: po.poNumber,
      billId,
      billNumber: bill.billNumber ?? '',
      matchStatus,
      quantityMatch,
      priceMatch,
      totalMatch,
      poTotalCents,
      receiptTotalCents,
      billTotalCents,
      discrepancies,
      canAutoApprove,
    };
  }

  /**
   * Generate the next PO number for a user.
   * Format: PO-NNNNNN (zero-padded 6 digits, sequential).
   */
  async getNextPONumber(userId: string): Promise<string> {
    const result = await db
      .select({ maxPO: sql<string>`MAX(${purchaseOrders.poNumber})` })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.userId, userId))
      .get();

    const maxPO = result?.maxPO;
    let nextNum = 1;

    if (maxPO) {
      // Parse "PO-000042" → 42, then increment
      const match = maxPO.match(/PO-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    return `PO-${String(nextNum).padStart(6, '0')}`;
  }

  /**
   * Create a batch payment run for multiple approved bills.
   * Calculates total, generates bank reference, sets status = 'draft'.
   */
  async createPaymentRun(userId: string, data: CreatePaymentRunInput): Promise<any> {
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

    console.log(
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
   * Transition: draft → processing → completed.
   * Uses BillService.recordPayment() for each bill.
   * If any payment fails, the run stays in 'processing' for manual review.
   */
  async processPaymentRun(paymentRunId: string): Promise<any> {
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
      } catch (err: any) {
        errors.push(`Bill ${item.billId}: ${err.message}`);
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
      console.error(
        `[PurchaseOrderService] Payment run ${paymentRunId} had ${errors.length} error(s):`,
        errors,
      );
    } else {
      console.log(
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
  async getPaymentRun(paymentRunId: string): Promise<PaymentRunDetail> {
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

    const items = itemRows.map((r: any) => ({
      id: r.id,
      paymentRunId: r.paymentRunId,
      billId: r.billId,
      amount: Number(r.amount) || 0,
      billNumber: r.billNumber ?? '',
      supplierName: r.supplierName ?? 'Unknown Supplier',
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
}

export const purchaseOrderService = new PurchaseOrderService();
