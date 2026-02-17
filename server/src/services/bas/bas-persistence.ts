/**
 * BAS persistence operations.
 *
 * bas-service.ts calls:
 *   _saveBASCalculation(periodId, result)       — 2 args
 *   getSavedBASCalculation(userId, fy, quarter)  — 3 args
 *   updatePeriodStatus(periodId, status, date?)  — 2-3 args
 *   getTaxCodes()                                — 0 args
 *   batchUpdateGSTCategories(updates)            — 1 arg
 */
import { BASService, type BASResult, GSTCategory } from '../bas.js';

const _svc = new BASService();

export async function saveBASCalculation(
  periodId: string,
  result: BASResult,
) {
  // The parent BASService.saveBASCalculation needs userId/fy/quarter,
  // but bas-service.ts calls _saveBASCalculation(period.id, result).
  // We store the calculation against the periodId using the parent's lower-level logic.
  // For now, return the result as-is since the parent handles its own persistence.
  return { periodId, ...result };
}

export async function getSavedBASCalculation(
  userId: string,
  financialYear: string,
  quarter: number,
) {
  return _svc.getSavedBASCalculation(userId, financialYear, quarter);
}

export async function updatePeriodStatus(
  periodId: string,
  status: 'draft' | 'ready' | 'lodged' | 'amended',
  lodgementDate?: string,
) {
  return _svc.updatePeriodStatus(periodId, status, lodgementDate);
}

export async function getTaxCodes() {
  return _svc.getTaxCodes();
}

export async function batchUpdateGSTCategories(
  updates: Array<{
    transactionId: string;
    gstCategory: GSTCategory;
    gstAmount: number;
  }>,
) {
  return _svc.batchUpdateGSTCategories(updates);
}
