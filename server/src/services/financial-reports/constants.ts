/**
 * Financial Reports Module — Category Classification Constants and Helpers
 */

import type { CategoryGroup, CategoryVariance, ReportData } from './types.js';

// Revenue categories (positive amounts = income)
export const REVENUE_CATEGORIES = [
  'Sales Revenue',
  'Service Revenue',
  'Interest Income',
  'Other Income',
  'Export Revenue',
  'Business Income',
  'Rental Income',
  // Legacy names that may appear in older transaction data
  'Salary/Wages',
  'Business Revenue',
  'Investment Income',
  'Government Payments',
];

// Cost of Goods Sold categories
export const COGS_CATEGORIES = ['Cost of Goods Sold', 'Direct Labour', 'Freight Costs', 'Materials'];

// System/transfer categories excluded from P&L
export const SYSTEM_CATEGORIES = [
  'Transfer',
  'Cash Withdrawal',
  'Loan Repayment',
  'Mortgage',
  'Refund',
  'Uncategorized',
];

// Investing-related categories for cash flow classification
export const INVESTING_CATEGORIES = ['Depreciation'];

// Financing-related categories for cash flow classification
export const FINANCING_CATEGORIES = ['Loan Repayment', 'Mortgage'];

/** Safe division avoiding divide-by-zero */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/** Calculate previous period dates given current period */
export function getPriorPeriod(periodStart: string, periodEnd: string): { start: string; end: string } {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const durationMs = end.getTime() - start.getTime();

  const priorEnd = new Date(start.getTime() - 1); // day before current start
  const priorStart = new Date(priorEnd.getTime() - durationMs);

  return {
    start: priorStart.toISOString().split('T')[0],
    end: priorEnd.toISOString().split('T')[0],
  };
}

/**
 * Calculate per-category variances between two report datasets.
 */
export function calculateVariances(
  currentData: ReportData,
  priorData: ReportData,
  reportType: string,
): CategoryVariance[] {
  const variances: CategoryVariance[] = [];

  if (reportType === 'profit_and_loss' && 'revenue' in currentData && 'revenue' in priorData) {
    const allCurrentGroups: CategoryGroup[] = [
      ...(currentData.revenue || []),
      ...(currentData.costOfGoodsSold || []),
      ...(currentData.expenses || []),
    ];
    const allPriorGroups: CategoryGroup[] = [
      ...(priorData.revenue || []),
      ...(priorData.costOfGoodsSold || []),
      ...(priorData.expenses || []),
    ];

    const priorMap = new Map<string, number>();
    for (const g of allPriorGroups) {
      priorMap.set(g.category, g.amount);
    }

    const seen = new Set<string>();

    for (const g of allCurrentGroups) {
      seen.add(g.category);
      const priorAmount = priorMap.get(g.category) ?? 0;
      variances.push(buildVariance(g.category, g.amount, priorAmount));
    }

    for (const g of allPriorGroups) {
      if (!seen.has(g.category)) {
        variances.push(buildVariance(g.category, 0, g.amount));
      }
    }
  } else if (reportType === 'cash_flow' && 'operating' in currentData && 'operating' in priorData) {
    const sections = ['operating', 'investing', 'financing'] as const;
    for (const section of sections) {
      const currentSection = currentData[section];
      const priorSection = priorData[section];
      const currentTotal = currentSection?.total ?? 0;
      const priorTotal = priorSection?.total ?? 0;
      variances.push(buildVariance(section, currentTotal, priorTotal));
    }
  } else {
    const keys = [
      'totalAssets',
      'totalLiabilities',
      'totalEquity',
      'totalDebits',
      'totalCredits',
    ] as const;
    const currentRec = currentData as unknown as Record<string, number | undefined>;
    const priorRec = priorData as unknown as Record<string, number | undefined>;
    for (const key of keys) {
      if (currentRec[key] !== undefined && priorRec[key] !== undefined) {
        variances.push(buildVariance(key, currentRec[key]!, priorRec[key]!));
      }
    }
  }

  return variances;
}

export function buildVariance(
  category: string,
  currentAmount: number,
  priorAmount: number,
): CategoryVariance {
  const varianceAmount = currentAmount - priorAmount;
  const variancePercent = safeDivide(varianceAmount, priorAmount) * 100;
  let direction: 'increase' | 'decrease' | 'unchanged' = 'unchanged';
  if (varianceAmount > 0) direction = 'increase';
  else if (varianceAmount < 0) direction = 'decrease';

  return {
    category,
    currentAmount,
    priorAmount,
    varianceAmount,
    variancePercent,
    direction,
  };
}
