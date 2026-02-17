/**
 * Bill types — re-exported from parent monolith ../bills.ts + local additions.
 */
export type {
  CreateBillInput,
  UpdateBillInput,
  RecordPaymentInput,
  BillWithSupplier,
  BillLine,
  BillPayment,
  BillDetail,
  BillListOptions,
  APAgingBillItem,
  APAgingReport,
} from '../bills.js';

// Re-export APAgingBucket which is defined in the monolith but needs explicit export here
export type { APAgingBucket } from '../bills.js';

// ---------------------------------------------------------------------------
// CALCULATION HELPERS
// ---------------------------------------------------------------------------

/** Calculate line item amount from quantity and unit price (cents). */
export function calcLineAmount(quantity: number, unitPriceCents: number): number {
  return Math.round(quantity * unitPriceCents);
}

/** Calculate GST amount from line amount (cents) and rate. */
export function calcGst(amountCents: number, gstRate: number): number {
  return Math.round(amountCents * gstRate);
}

/** Calculate bill totals from line items. */
export function calcBillTotals(lines: Array<{ amount: number; gstAmount: number }>): {
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
export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}
