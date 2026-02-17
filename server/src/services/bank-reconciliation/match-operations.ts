/**
 * Bank reconciliation match operations — confirm, reject, undo, manual match.
 * Delegates to the parent BankReconciliationService.
 */
import { BankReconciliationService } from '../bank-reconciliation.js';

const _svc = new BankReconciliationService();

export async function confirmMatch(matchId: string, userId: string) {
  return _svc.confirmMatch(matchId, userId);
}

export async function rejectMatch(matchId: string, userId: string) {
  return _svc.rejectMatch(matchId, userId);
}

export async function undoMatch(matchId: string, userId: string) {
  return _svc.undoMatch(matchId, userId);
}

export async function createManualMatch(
  sessionId: string,
  bankTransactionId: string,
  ledgerEntryId: string,
  userId: string,
) {
  return _svc.createManualMatch(sessionId, bankTransactionId, ledgerEntryId, userId);
}
