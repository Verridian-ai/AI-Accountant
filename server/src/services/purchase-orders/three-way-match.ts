/**
 * Three-Way Matching — PO <-> Receipt(s) <-> Bill.
 *
 * Uses a SQL JOIN to fetch PO lines with aggregated receipt quantities
 * and matching bill lines in a single efficient query, then compares:
 *   1. Quantity match: receipt totals vs PO ordered quantities
 *   2. Price match: bill unit prices vs PO unit prices (within tolerance)
 *   3. Total match: bill total vs PO total (within tolerance)
 *
 * Tolerance: configurable 2% default, 5% hard cap.
 */

import { logger } from '../../lib/logger.js';
import { db, purchaseOrders, poLines, poReceiptLines, bills, billLines } from '../../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { isWithinTolerance, variancePercent, type ThreeWayMatchResult } from './types.js';

/**
 * Three-way matching: PO <-> Receipt(s) <-> Bill.
 */
export async function threeWayMatch(poId: string, billId: string): Promise<ThreeWayMatchResult> {
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

  logger.info(
    `[PurchaseOrderService] Three-way match PO ${po.poNumber} <-> Bill ${bill.billNumber}: ${matchStatus} (${discrepancies.length} discrepancies)`,
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
