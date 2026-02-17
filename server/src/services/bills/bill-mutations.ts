/**
 * Bill mutations — re-exported from parent BillService.
 */
import { BillService, type CreateBillInput, type UpdateBillInput } from '../bills.js';

const _svc = new BillService();

export async function createBill(userId: string, data: CreateBillInput) {
  return _svc.createBill(userId, data);
}

export async function updateBill(billId: string, data: UpdateBillInput) {
  return _svc.updateBill(billId, data);
}
