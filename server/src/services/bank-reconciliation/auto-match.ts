/**
 * Bank reconciliation auto-match — delegates to parent service.
 */
import { BankReconciliationService } from '../bank-reconciliation.js';
import type { LedgerEntryCandidate } from './types.js';
import {
  scoreAmountMatch,
  scoreDateMatch,
  scoreDescriptionMatch,
  scoreCombined,
} from './matching.js';

const _svc = new BankReconciliationService();

export async function runAutoMatch(
  sessionId: string,
  userId: string,
): Promise<{ matched: number; suggested: number; unmatched: number }> {
  return _svc.autoMatch(sessionId, userId);
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
