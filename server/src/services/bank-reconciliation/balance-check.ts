/**
 * Bank reconciliation session management — self-contained implementation.
 * Uses rawQuery from data-access for database operations.
 */
import { db, transactions } from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';
import type { BankReconSession, BankReconMatch } from './types.js';
import { rawQuery } from './data-access.js';

export async function startSession(
  userId: string,
  accountId: string,
  periodStart: string,
  periodEnd: string,
  statementBalanceCents?: number,
): Promise<BankReconSession> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Count unmatched transactions for the account in date range
  const txRows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        gte(transactions.date, periodStart),
        lte(transactions.date, periodEnd),
      ),
    )
    .all();
  const totalTransactions = txRows.length;

  // Calculate ledger balance from journal entry lines for the account's period
  let ledgerBalanceCents: number | null = null;
  try {
    const balanceRow = (await db.get(sql`
      SELECT COALESCE(SUM(jel.debit - jel.credit), 0) as balance
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.entry_id
      WHERE je.user_id = ${userId}
        AND je.entry_date >= ${periodStart}
        AND je.entry_date <= ${periodEnd}
        AND je.status = 'posted'
    `)) as { balance: number };
    ledgerBalanceCents = balanceRow?.balance ?? 0;
  } catch {
    ledgerBalanceCents = 0;
  }

  const differenceCents =
    statementBalanceCents != null && ledgerBalanceCents != null
      ? statementBalanceCents - ledgerBalanceCents
      : null;

  const session: BankReconSession = {
    id,
    userId,
    accountId,
    periodStart,
    periodEnd,
    status: 'open',
    statementBalanceCents: statementBalanceCents ?? null,
    ledgerBalanceCents,
    differenceCents,
    totalTransactions,
    totalMatched: 0,
    autoMatched: 0,
    manualMatched: 0,
    totalUnmatched: totalTransactions,
    totalSuggested: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  await rawQuery.insertSession(session);
  return session;
}

export async function getSession(
  sessionId: string,
  userId: string,
): Promise<(BankReconSession & { matches: BankReconMatch[] }) | null> {
  const session = await rawQuery.getSession(sessionId, userId);
  if (!session) return null;
  const matches = await rawQuery.getMatchesBySession(sessionId);
  return { ...session, matches };
}

export async function listSessions(
  userId: string,
  filters?: { accountId?: string; status?: string },
): Promise<BankReconSession[]> {
  return rawQuery.listSessions(userId, filters);
}

export async function completeSession(
  sessionId: string,
  userId: string,
): Promise<BankReconSession | null> {
  const session = await rawQuery.getSession(sessionId, userId);
  if (!session) return null;

  const matches = await rawQuery.getMatchesBySession(sessionId);
  const confirmed = matches.filter((m) => m.status === 'confirmed');
  const pending = matches.filter((m) => m.status === 'pending');

  const totalMatched = confirmed.length;
  const autoCount = confirmed.filter((m) => m.matchType === 'auto').length;
  const manualCount = confirmed.filter((m) => m.matchType === 'manual').length;
  const now = new Date().toISOString();

  await rawQuery.updateSession(sessionId, userId, {
    status: 'completed',
    totalMatched,
    autoMatched: autoCount,
    manualMatched: manualCount,
    totalUnmatched: session.totalTransactions - totalMatched,
    totalSuggested: pending.length,
    completedAt: now,
  });

  return rawQuery.getSession(sessionId, userId) as Promise<BankReconSession>;
}

export async function abandonSession(sessionId: string, userId: string): Promise<void> {
  const session = await rawQuery.getSession(sessionId, userId);
  if (!session) return;

  // Undo all pending matches
  const matches = await rawQuery.getMatchesBySession(sessionId);
  for (const match of matches) {
    if (match.status === 'pending') {
      await rawQuery.updateMatch(match.id, { status: 'undone' });
    }
  }

  await rawQuery.updateSession(sessionId, userId, {
    status: 'abandoned',
  });
}
