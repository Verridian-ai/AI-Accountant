/**
 * Bank reconciliation auto-match — delegates to parent service.
 */
import { BankReconciliationService } from '../bank-reconciliation.js';

const _svc = new BankReconciliationService();

export async function runAutoMatch(
  sessionId: string,
  userId: string,
): Promise<{ matched: number; suggested: number; unmatched: number }> {
  return _svc.autoMatch(sessionId, userId);
}
