/**
 * Bank reconciliation match operations — confirm, reject, undo, manual match.
 * Self-contained implementation using rawQuery from data-access.
 */
import crypto from 'crypto';
import type { BankReconMatch } from './types.js';
import { rawQuery } from './data-access.js';

export async function confirmMatch(
  matchId: string,
  userId: string,
): Promise<BankReconMatch | null> {
  const match = await rawQuery.getMatch(matchId);
  if (!match) return null;

  const now = new Date().toISOString();
  await rawQuery.updateMatch(matchId, {
    status: 'confirmed',
    confirmedBy: userId,
    confirmedAt: now,
  });

  // Update session stats
  const session = await rawQuery.getSession(match.sessionId, userId);
  if (session) {
    await rawQuery.updateSession(match.sessionId, userId, {
      totalMatched: session.totalMatched + 1,
      totalUnmatched: Math.max(0, session.totalUnmatched - 1),
      totalSuggested: Math.max(0, session.totalSuggested - (match.status === 'pending' ? 1 : 0)),
    });
  }

  return rawQuery.getMatch(matchId) as Promise<BankReconMatch>;
}

export async function rejectMatch(matchId: string, userId: string): Promise<void> {
  const match = await rawQuery.getMatch(matchId);
  if (!match) return;

  await rawQuery.updateMatch(matchId, { status: 'rejected' });

  // Update session suggested count if it was pending
  if (match.status === 'pending') {
    const session = await rawQuery.getSession(match.sessionId, userId);
    if (session) {
      await rawQuery.updateSession(match.sessionId, userId, {
        totalSuggested: Math.max(0, session.totalSuggested - 1),
      });
    }
  }
}

export async function undoMatch(matchId: string, userId: string): Promise<void> {
  const match = await rawQuery.getMatch(matchId);
  if (!match) return;

  await rawQuery.updateMatch(matchId, {
    status: 'undone',
    confirmedBy: undefined,
    confirmedAt: undefined,
  });

  // Decrement session match counts
  if (match.status === 'confirmed') {
    const session = await rawQuery.getSession(match.sessionId, userId);
    if (session) {
      await rawQuery.updateSession(match.sessionId, userId, {
        totalMatched: Math.max(0, session.totalMatched - 1),
        totalUnmatched: session.totalUnmatched + 1,
      });
    }
  }
}

export async function createManualMatch(
  sessionId: string,
  bankTransactionId: string,
  ledgerEntryId: string,
  userId: string,
): Promise<BankReconMatch> {
  const now = new Date().toISOString();

  const match: BankReconMatch = {
    id: crypto.randomUUID(),
    sessionId,
    bankTransactionId,
    ledgerEntryId,
    matchType: 'manual',
    matchRuleId: null,
    confidence: 1.0,
    matchReasons: JSON.stringify(['manual_match']),
    status: 'confirmed',
    confirmedBy: userId,
    confirmedAt: now,
    createdAt: now,
  };

  await rawQuery.insertMatch(match);

  // Update session stats
  const session = await rawQuery.getSession(sessionId, userId);
  if (session) {
    await rawQuery.updateSession(sessionId, userId, {
      totalMatched: session.totalMatched + 1,
      manualMatched: session.manualMatched + 1,
      totalUnmatched: Math.max(0, session.totalUnmatched - 1),
    });
  }

  return match;
}
