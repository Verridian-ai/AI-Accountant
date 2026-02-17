/**
 * Bank reconciliation rule evaluation — stub delegates to parent service methods.
 */
import type { LedgerEntryCandidate, MatchType } from './types.js';

interface EvalResult {
  confidence: number;
  reasons: string[];
}

/**
 * Evaluate a single rule against a bank transaction and ledger entry.
 * This is the sub-module entry point expected by reconciliation.ts.
 */
export function evaluateRule(
  _matchType: MatchType,
  _bankTx: Record<string, unknown>,
  _ledgerEntry: LedgerEntryCandidate,
  _config: Record<string, unknown>,
): EvalResult {
  // Actual logic lives in the BankReconciliationService.evaluateRule() method
  // in the parent monolith. This stub is invoked by reconciliation.ts which
  // delegates to the service anyway. Return zero-confidence default.
  return { confidence: 0, reasons: [] };
}
