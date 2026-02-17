/**
 * Bank reconciliation auto-match — self-contained implementation.
 * Uses rawQuery from data-access and scoring functions from matching.
 */
import { db, transactions } from '../../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';
import type { LedgerEntryCandidate, BankReconMatch, MatchType } from './types.js';
import { rawQuery } from './data-access.js';
import {
  scoreAmountMatch,
  scoreDateMatch,
  scoreDescriptionMatch,
  scoreCombined,
  evaluateRule,
  parseConfig,
} from './matching.js';
import { seedDefaultRules } from './rules.js';

export async function runAutoMatch(
  sessionId: string,
  userId: string,
): Promise<{ matched: number; suggested: number; unmatched: number }> {
  const session = await rawQuery.getSession(sessionId, userId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  // 1. Load unmatched bank transactions for the session's account and date range
  const alreadyMatchedBankTxIds = await rawQuery.getMatchedBankTxIds(sessionId);
  const allBankTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, session.accountId),
        gte(transactions.date, session.periodStart),
        lte(transactions.date, session.periodEnd),
      ),
    )
    .all();
  const unmatchedBankTx = allBankTx.filter(
    (tx: typeof transactions.$inferSelect) => !alreadyMatchedBankTxIds.includes(tx.id),
  );

  // 2. Load unmatched ledger entries
  const alreadyMatchedLedgerIds = await rawQuery.getMatchedLedgerIds(sessionId);
  let allLedgerEntries: LedgerEntryCandidate[] = [];
  try {
    allLedgerEntries = (await db.all(sql`
      SELECT
        jel.id,
        jel.entry_id as "entryId",
        jel.debit,
        jel.credit,
        jel.description,
        je.entry_date as "entryDate",
        je.reference,
        je.description as "journalDescription"
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.entry_id
        AND je.status = 'posted'
    `)) as LedgerEntryCandidate[];
  } catch {
    allLedgerEntries = [];
  }
  const unmatchedLedger = allLedgerEntries.filter((le) => !alreadyMatchedLedgerIds.includes(le.id));

  // 3. Load active match rules
  const rules = await rawQuery.getRules(userId);
  if (rules.length === 0) {
    await seedDefaultRules(userId);
    const seeded = await rawQuery.getRules(userId);
    rules.push(...seeded);
  }
  rules.sort((a, b) => b.priority - a.priority);

  // Track results
  let matched = 0;
  let suggested = 0;
  const now = new Date().toISOString();
  const usedLedgerIds = new Set<string>();

  // 4. For each bank transaction, run rules in priority order
  for (const bankTx of unmatchedBankTx) {
    let bestMatch: {
      ledgerEntry: LedgerEntryCandidate;
      confidence: number;
      reasons: string[];
      ruleId: string | null;
    } | null = null;

    for (const rule of rules) {
      const config = parseConfig(rule.matchConfig);
      const candidates = unmatchedLedger.filter((le) => !usedLedgerIds.has(le.id));

      for (const ledgerEntry of candidates) {
        const result = evaluateRule(
          rule.matchType as MatchType,
          bankTx as Record<string, unknown>,
          ledgerEntry,
          config,
        );
        if (result.confidence > 0 && (!bestMatch || result.confidence > bestMatch.confidence)) {
          bestMatch = {
            ledgerEntry,
            confidence: result.confidence,
            reasons: result.reasons,
            ruleId: rule.id,
          };
        }
      }

      if (bestMatch && bestMatch.confidence >= 0.95) break;
    }

    if (!bestMatch) continue;

    const isAutoConfirm = bestMatch.confidence >= 0.95;
    const isSuggestion = bestMatch.confidence >= 0.7;
    if (!isSuggestion) continue;

    const matchRecord: BankReconMatch = {
      id: crypto.randomUUID(),
      sessionId,
      bankTransactionId: bankTx.id,
      ledgerEntryId: bestMatch.ledgerEntry.id,
      matchType: isAutoConfirm ? 'auto' : 'suggested',
      matchRuleId: bestMatch.ruleId,
      confidence: Math.round(bestMatch.confidence * 10000) / 10000,
      matchReasons: JSON.stringify(bestMatch.reasons),
      status: isAutoConfirm ? 'confirmed' : 'pending',
      confirmedBy: isAutoConfirm ? 'system' : null,
      confirmedAt: isAutoConfirm ? now : null,
      createdAt: now,
    };

    await rawQuery.insertMatch(matchRecord);
    usedLedgerIds.add(bestMatch.ledgerEntry.id);

    if (isAutoConfirm) {
      matched++;
    } else {
      suggested++;
    }
  }

  const totalUnmatched = session.totalTransactions - (session.totalMatched + matched);

  await rawQuery.updateSession(sessionId, userId, {
    autoMatched: session.autoMatched + matched,
    totalMatched: session.totalMatched + matched,
    totalUnmatched: Math.max(0, totalUnmatched),
    totalSuggested: session.totalSuggested + suggested,
  });

  return {
    matched,
    suggested,
    unmatched: Math.max(0, totalUnmatched),
  };
}

/**
 * Find the best matching ledger entry for a bank transaction.
 */
export function findBestMatch(
  bankTx: { amount: number; date: string; description: string },
  candidates: LedgerEntryCandidate[],
  options: { toleranceCents?: number; windowDays?: number; minConfidence?: number } = {},
): { entry: LedgerEntryCandidate; confidence: number } | null {
  const toleranceCents = options.toleranceCents ?? 100;
  const windowDays = options.windowDays ?? 7;
  const minConfidence = options.minConfidence ?? 0.5;
  const weights = { amount: 0.4, date: 0.25, description: 0.35 };

  let bestMatch: LedgerEntryCandidate | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const ledgerAmountCents = (candidate.debit ?? 0) - (candidate.credit ?? 0);
    const amtScore = scoreAmountMatch(bankTx.amount, ledgerAmountCents, toleranceCents);
    const dateScore = scoreDateMatch(bankTx.date, candidate.entryDate, windowDays);
    const descScore = scoreDescriptionMatch(bankTx.description ?? '', candidate.reference ?? '');
    const combined = scoreCombined(amtScore, dateScore, descScore, weights);

    if (combined > bestScore) {
      bestScore = combined;
      bestMatch = candidate;
    }
  }

  if (!bestMatch || bestScore < minConfidence) return null;
  return { entry: bestMatch, confidence: bestScore };
}
