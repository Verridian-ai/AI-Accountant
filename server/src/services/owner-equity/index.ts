/**
 * Owner Equity Service — Barrel Export
 *
 * Wraps standalone functions into the OwnerEquityService class
 * to preserve the original public API.
 */

export type { DetectedEquityEvent, EquityEventParams, EquitySummary } from './types.js';

export {
  CONTRIBUTION_THRESHOLD_CENTS,
  PERSONAL_EXPENSE_CATEGORIES,
  ATM_PATTERNS,
} from './types.js';

import { scanForContributions, scanForDrawings } from './scanner.js';
import { createEquityEvent, confirmEquityEvent, getEquitySummary } from './owner-equity-service.js';

export class OwnerEquityService {
  async scanForContributions(...args: Parameters<typeof scanForContributions>) {
    return scanForContributions(...args);
  }

  async scanForDrawings(...args: Parameters<typeof scanForDrawings>) {
    return scanForDrawings(...args);
  }

  async createEquityEvent(...args: Parameters<typeof createEquityEvent>) {
    return createEquityEvent(...args);
  }

  async confirmEquityEvent(...args: Parameters<typeof confirmEquityEvent>) {
    return confirmEquityEvent(...args);
  }

  async getEquitySummary(...args: Parameters<typeof getEquitySummary>) {
    return getEquitySummary(...args);
  }
}

export const ownerEquityService = new OwnerEquityService();
