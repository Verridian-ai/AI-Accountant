/**
 * BAS quarter utilities — self-contained implementations.
 */
import type { QuarterDates } from './types.js';

/**
 * Get quarter dates for Australian financial year
 */
export function getQuarterDates(financialYear: string, quarter: number): QuarterDates {
  const startYear = parseInt(financialYear.split('-')[0]);

  const quarterDates: Record<number, QuarterDates> = {
    1: {
      startDate: `${startYear}-07-01`,
      endDate: `${startYear}-09-30`,
      lodgementDue: `${startYear}-10-28`,
    },
    2: {
      startDate: `${startYear}-10-01`,
      endDate: `${startYear}-12-31`,
      lodgementDue: `${startYear + 1}-02-28`,
    },
    3: {
      startDate: `${startYear + 1}-01-01`,
      endDate: `${startYear + 1}-03-31`,
      lodgementDue: `${startYear + 1}-04-28`,
    },
    4: {
      startDate: `${startYear + 1}-04-01`,
      endDate: `${startYear + 1}-06-30`,
      lodgementDue: `${startYear + 1}-07-28`,
    },
  };

  return quarterDates[quarter] || { startDate: '', endDate: '', lodgementDue: '' };
}

/**
 * Get current Australian financial year
 */
export function getCurrentFinancialYear(): string {
  const today = new Date();
  const month = today.getMonth() + 1; // 1-12
  const year = today.getFullYear();

  if (month >= 7) {
    return `${year}-${(year + 1).toString().slice(2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(2)}`;
  }
}

/**
 * Get current BAS quarter
 */
export function getCurrentQuarter(): { financialYear: string; quarter: number } {
  const today = new Date();
  const month = today.getMonth() + 1;
  const financialYear = getCurrentFinancialYear();

  if (month >= 7 && month <= 9) return { financialYear, quarter: 1 };
  if (month >= 10 && month <= 12) return { financialYear, quarter: 2 };
  if (month >= 1 && month <= 3) return { financialYear, quarter: 3 };
  return { financialYear, quarter: 4 };
}

/**
 * Calculate GST from GST-inclusive amount
 */
export function calculateGstFromInclusive(amountCents: number, gstRate: number = 0.1): number {
  if (gstRate === 0) return 0;
  return Math.round((Math.abs(amountCents) * gstRate) / (1 + gstRate));
}
