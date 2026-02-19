/**
 * Bill CRUD operations — list and get (amounts in cents/INTEGER).
 */

import { db, bills, billLines, billPayments, suppliers, purchaseOrders } from '../../schema.js';
import { eq, and, gte, lte, sql, asc, type SQL } from 'drizzle-orm';
import type {
  BillWithSupplier,
  BillLine,
  BillPayment,
  BillDetail,
  BillListOptions,
} from './types.js';
import { selectMany } from '../../db/typed-queries.js';

// Re-export mutations for backward compatibility
export { createBill, updateBill } from './bill-mutations.js';

/**
 * List bills for a user with pagination and filtering.
 * Default sort: dueDate ASC (soonest due first).
 */
export async function listBills(
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
  const conditions: SQL<unknown>[] = [eq(bills.userId, userId)];
  if (status) {
    conditions.push(eq(bills.status, status));
  }
  if (supplierId) {
    conditions.push(eq(bills.supplierId, supplierId));
  }

  const dateCol = dateField === 'issueDate' ? bills.billDate : bills.dueDate;
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
      billDate: bills.billDate,
      dueDate: bills.dueDate,
      subtotal: bills.subtotal,
      gstAmount: bills.gstAmount,
      totalAmount: bills.totalAmount,
      createdAt: bills.createdAt,
      tenantId: bills.tenantId,
      supplierName: suppliers.name,
    })
    .from(bills)
    .leftJoin(suppliers, eq(bills.supplierId, suppliers.id))
    .where(and(...conditions))
    .orderBy(asc(bills.dueDate))
    .limit(limit)
    .offset(offset)
    .all();

  type BillRow = typeof bills.$inferSelect & { supplierName: string | null };

  const data: BillWithSupplier[] = (rows as BillRow[]).map((r) => ({
    id: r.id,
    userId: r.userId,
    supplierId: r.supplierId,
    billNumber: r.billNumber,
    status: r.status,
    billDate: r.billDate,
    issueDate: r.issueDate ?? null,
    dueDate: r.dueDate,
    subtotal: Number(r.subtotal) || 0,
    gstAmount: Number(r.gstAmount) || 0,
    totalAmount: Number(r.totalAmount) || 0,
    amountDue: r.amountDue ?? null,
    createdAt: String(r.createdAt),
    supplierName: r.supplierName ?? 'Unknown Supplier',
  }));

  return { data, total };
}

/**
 * Get a single bill with full details: line items, payments, linked PO.
 */
export async function getBill(billId: string): Promise<BillDetail> {
  // Define type for the JOIN query result
  type BillWithSupplierRow = typeof bills.$inferSelect & { supplierName: string | null };

  // Fetch bill with supplier join
  const row: BillWithSupplierRow | undefined = await db
    .select({
      id: bills.id,
      userId: bills.userId,
      supplierId: bills.supplierId,
      billNumber: bills.billNumber,
      status: bills.status,
      billDate: bills.billDate,
      dueDate: bills.dueDate,
      subtotal: bills.subtotal,
      gstAmount: bills.gstAmount,
      totalAmount: bills.totalAmount,
      createdAt: bills.createdAt,
      tenantId: bills.tenantId,
      supplierName: suppliers.name,
    })
    .from(bills)
    .leftJoin(suppliers, eq(bills.supplierId, suppliers.id))
    .where(eq(bills.id, billId))
    .get();

  if (!row) {
    throw new Error(`Bill not found: ${billId}`);
  }

  // Fetch line items
  const lines = await selectMany(db, billLines, eq(billLines.billId, billId));

  // Fetch payments
  const payments: Array<typeof billPayments.$inferSelect> = await db
    .select()
    .from(billPayments)
    .where(eq(billPayments.billId, billId))
    .orderBy(asc(billPayments.paymentDate))
    .all();

  // Check for linked PO (supplier match + similar amount)
  type LinkedPOResult = { id: string; poNumber: string; status: string } | undefined;
  const linkedPOResult: LinkedPOResult = await db
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

  const lineItems: BillLine[] = lines.map((l) => ({
    id: l.id,
    billId: l.billId,
    description: l.description,
    quantity: Number(l.quantity) || 0,
    unitPrice: Number(l.unitPrice) || 0,
    amount: Number(l.amount) || 0,
    taxCode: l.taxCode,
  }));

  const paymentList: BillPayment[] = payments.map((p) => ({
    id: p.id,
    billId: p.billId,
    paymentDate: p.paymentDate,
    amount: Number(p.amount) || 0,
    paymentMethod: p.paymentMethod,
    reference: p.reference,
    transactionId: p.transactionId ?? null,
    notes: p.notes ?? null,
    createdAt: String(p.createdAt),
  }));

  const detail: BillDetail = {
    id: row.id,
    userId: row.userId,
    supplierId: row.supplierId,
    billNumber: row.billNumber,
    status: row.status,
    billDate: row.billDate,
    issueDate: row.issueDate ?? null,
    dueDate: row.dueDate,
    subtotal: Number(row.subtotal) || 0,
    gstAmount: Number(row.gstAmount) || 0,
    totalAmount: Number(row.totalAmount) || 0,
    amountDue: row.amountDue ?? null,
    createdAt: String(row.createdAt),
    supplierName: row.supplierName ?? 'Unknown Supplier',
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
