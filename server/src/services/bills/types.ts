/**
 * Bill types — re-exported from parent monolith ../bills.ts.
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

/** Number of days between two ISO date strings. Negative = future. */
export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}
