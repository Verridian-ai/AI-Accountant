/**
 * Bills Service — Barrel Export
 *
 * Re-exports all types, helpers, and provides BillService facade class
 * that delegates to split sub-modules.
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
  APAgingBucket,
  APAgingReport,
} from './types.js';

export { calcLineAmount, calcGst, calcBillTotals, daysBetween } from './types.js';

import { listBills, getBill, createBill, updateBill } from './bill-crud.js';
import { submitForApproval, approveBill, voidBill } from './approval.js';
import { recordPayment, getAPAging, checkOverdueBills } from './payment-tracking.js';
import type {
  CreateBillInput,
  UpdateBillInput,
  RecordPaymentInput,
  BillDetail,
  BillListOptions,
  APAgingReport,
} from './types.js';

export class BillService {
  listBills(userId: string, options: BillListOptions = {}) {
    return listBills(userId, options);
  }

  getBill(billId: string): Promise<BillDetail> {
    return getBill(billId);
  }

  createBill(userId: string, data: CreateBillInput) {
    return createBill(userId, data);
  }

  updateBill(billId: string, data: UpdateBillInput) {
    return updateBill(billId, data);
  }

  submitForApproval(billId: string) {
    return submitForApproval(billId);
  }

  approveBill(billId: string, approvingUserId: string) {
    return approveBill(billId, approvingUserId);
  }

  recordPayment(billId: string, payment: RecordPaymentInput) {
    return recordPayment(billId, payment);
  }

  voidBill(billId: string) {
    return voidBill(billId);
  }

  getAPAging(userId: string, asOfDate?: string): Promise<APAgingReport> {
    return getAPAging(userId, asOfDate);
  }

  checkOverdueBills(userId: string) {
    return checkOverdueBills(userId);
  }
}

export const billService = new BillService();
