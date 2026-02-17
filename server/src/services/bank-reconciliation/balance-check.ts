/**
 * Bank reconciliation session management — delegates to parent service.
 */
import type { BankReconSession } from './types.js';
import { BankReconciliationService } from '../bank-reconciliation.js';

const _svc = new BankReconciliationService();

export async function startSession(
  userId: string,
  accountId: string,
  periodStart: string,
  periodEnd: string,
  statementBalanceCents?: number,
): Promise<BankReconSession> {
  return _svc.startSession(userId, accountId, periodStart, periodEnd, statementBalanceCents);
}

export async function getSession(
  sessionId: string,
  userId: string,
) {
  return _svc.getSession(sessionId, userId);
}

export async function listSessions(
  userId: string,
  filters?: { accountId?: string; status?: string },
): Promise<BankReconSession[]> {
  return _svc.listSessions(userId, filters);
}

export async function completeSession(
  sessionId: string,
  userId: string,
): Promise<BankReconSession | null> {
  return _svc.completeSession(sessionId, userId);
}

export async function abandonSession(
  sessionId: string,
  userId: string,
): Promise<void> {
  return _svc.abandonSession(sessionId, userId);
}
