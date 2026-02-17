/**
 * Ledger Module — Barrel Export
 */

export * from './types.js';
export { STANDARD_CHART_OF_ACCOUNTS } from './chart-of-accounts.js';
export { LedgerService } from './ledger-service.js';

import { LedgerService } from './ledger-service.js';

// Export singleton instance
export const ledgerService = new LedgerService();
