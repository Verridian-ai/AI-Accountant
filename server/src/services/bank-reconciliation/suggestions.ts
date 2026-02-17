/**
 * Bank reconciliation match suggestions.
 *
 * Called as: suggestMatches(sessionId, bankTransactionId)
 * Returns suggested ledger matches for a single bank transaction.
 */

export async function suggestMatches(
  _sessionId: string,
  _bankTransactionId: string,
): Promise<Array<{ ledgerEntryId: string; confidence: number; matchReasons: string[] }>> {
  // Full suggestion logic lives in the parent BankReconciliationService.
  // This stub returns an empty array; reconciliation.ts delegates here.
  return [];
}
