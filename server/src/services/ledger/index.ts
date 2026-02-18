/**
 * Ledger Module — Barrel Export
 */

export * from './types.js';
export { STANDARD_CHART_OF_ACCOUNTS } from './chart-of-accounts.js';
export { LedgerService } from './ledger-service.js';
export {
  initializeChartOfAccounts,
  getChartOfAccountsList,
  findAccountByCode,
} from './ledger-chart-ops.js';
export { createJournalEntry, postJournalEntry, reverseJournalEntry } from './ledger-journal-ops.js';
export { mapTransactionToJournal, mapTransferToJournal } from './ledger-transaction-mapping.js';
export { calculateAccountBalances, generateTrialBalance } from './ledger-calculations.js';
export { generateEntryNumber, mapCategoryToAccount } from './ledger-helpers.js';

import { LedgerService } from './ledger-service.js';

// Export singleton instance
export const ledgerService = new LedgerService();
