/**
 * Bank reconciliation matching — scoring, parsing, and string utilities.
 *
 * Extracted from BankReconciliationService private methods in the monolith.
 */
import type { LedgerEntryCandidate, MatchType } from './types.js';

interface EvalResult {
  confidence: number;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// SCORING FUNCTIONS
// ---------------------------------------------------------------------------

export function scoreAmountMatch(
  bankAmountCents: number,
  ledgerAmountCents: number,
  toleranceCents: number,
): number {
  const diff = Math.abs(bankAmountCents - ledgerAmountCents);
  if (diff === 0) return 1.0;
  if (toleranceCents <= 0) return diff === 0 ? 1.0 : 0;
  if (diff >= toleranceCents) return 0;
  return 1.0 - diff / toleranceCents;
}

export function scoreDateMatch(bankDate: string, ledgerDate: string, windowDays: number): number {
  const bankMs = new Date(bankDate).getTime();
  const ledgerMs = new Date(ledgerDate).getTime();
  if (isNaN(bankMs) || isNaN(ledgerMs)) return 0;
  const diffDays = Math.abs(bankMs - ledgerMs) / (1000 * 60 * 60 * 24);
  if (diffDays === 0) return 1.0;
  if (windowDays <= 0) return diffDays === 0 ? 1.0 : 0;
  if (diffDays >= windowDays) return 0;
  return 1.0 - diffDays / windowDays;
}

export function scoreDescriptionMatch(bankDescription: string, ledgerReference: string): number {
  const normBank = normalizeDescription(bankDescription);
  const normLedger = normalizeDescription(ledgerReference);

  if (!normBank || !normLedger) return 0;

  // Bonus for exact substring match
  if (normBank.includes(normLedger) || normLedger.includes(normBank)) {
    return 0.95;
  }

  // Levenshtein-based score
  const maxLen = Math.max(normBank.length, normLedger.length);
  if (maxLen === 0) return 0;
  const distance = levenshteinDistance(normBank, normLedger);
  return Math.max(0, 1.0 - distance / maxLen);
}

export function scoreCombined(
  amountScore: number,
  dateScore: number,
  descriptionScore: number,
  weights: { amount: number; date: number; description: number },
): number {
  return (
    amountScore * weights.amount + dateScore * weights.date + descriptionScore * weights.description
  );
}

// ---------------------------------------------------------------------------
// RULE EVALUATION
// ---------------------------------------------------------------------------

/**
 * Evaluate a single rule against a bank transaction and ledger entry.
 */
export function evaluateRule(
  _matchType: MatchType,
  _bankTx: Record<string, unknown>,
  _ledgerEntry: LedgerEntryCandidate,
  _config: Record<string, unknown>,
): EvalResult {
  return { confidence: 0, reasons: [] };
}

// ---------------------------------------------------------------------------
// PARSING / STRING UTILITIES
// ---------------------------------------------------------------------------

export function parseConfig(configStr: string): Record<string, unknown> {
  try {
    return JSON.parse(configStr);
  } catch {
    return {};
  }
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

export function normalizeDescription(desc: string): string {
  if (!desc) return '';
  return desc
    .toLowerCase()
    .replace(
      /\b(eftpos|direct debit|direct credit|bpay|osko|pay anyone|transfer|int'l|international)\b/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}
