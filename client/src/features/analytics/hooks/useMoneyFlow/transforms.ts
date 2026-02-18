import type { Transaction } from '../../../../api/index.js';
import { CATEGORIES } from '../../../transactions/constants/categories.js';

export const REVENUE_CATEGORIES = new Set(
  CATEGORIES.filter((c) => c.type === 'revenue').map((c) => c.name),
);

export const EXPENSE_CATEGORIES = new Set(
  CATEGORIES.filter((c) => c.type === 'expense' || c.type === 'cogs').map((c) => c.name),
);

export const SYSTEM_CATEGORIES = new Set(
  CATEGORIES.filter((c) => c.type === 'system').map((c) => c.name),
);

export function filterByPeriod(transactions: Transaction[], period: string): Transaction[] {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), qMonth, 1);
      break;
    }
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'fy': {
      // Australian FY: Jul 1 - Jun 30
      const fyStart =
        now.getMonth() >= 6
          ? new Date(now.getFullYear(), 6, 1)
          : new Date(now.getFullYear() - 1, 6, 1);
      startDate = fyStart;
      break;
    }
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    return txDate >= startDate && txDate <= now;
  });
}

/**
 * Compute monthly aggregates for the last 6 months (for sparkline trends).
 */
export function computeMonthlyTrends(transactions: Transaction[]): {
  monthlyIncome: number[];
  monthlyExpenses: number[];
  monthlyCashFlow: number[];
} {
  const now = new Date();
  const months: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.getFullYear() * 100 + d.getMonth());
  }

  const incomeByMonth = new Map<number, number>();
  const expenseByMonth = new Map<number, number>();
  for (const key of months) {
    incomeByMonth.set(key, 0);
    expenseByMonth.set(key, 0);
  }

  for (const tx of transactions) {
    const d = new Date(tx.date);
    const key = d.getFullYear() * 100 + d.getMonth();
    if (!incomeByMonth.has(key)) continue;

    const cat = tx.category ?? 'Uncategorized';
    if (tx.amount > 0 && (REVENUE_CATEGORIES.has(cat) || !EXPENSE_CATEGORIES.has(cat))) {
      incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + tx.amount);
    } else if (tx.amount < 0) {
      expenseByMonth.set(key, (expenseByMonth.get(key) ?? 0) + Math.abs(tx.amount));
    }
  }

  const monthlyIncome = months.map((k) => Math.round((incomeByMonth.get(k) ?? 0) * 100) / 100);
  const monthlyExpenses = months.map((k) => Math.round((expenseByMonth.get(k) ?? 0) * 100) / 100);
  const monthlyCashFlow = months.map(
    (k) => Math.round(((incomeByMonth.get(k) ?? 0) - (expenseByMonth.get(k) ?? 0)) * 100) / 100,
  );

  return { monthlyIncome, monthlyExpenses, monthlyCashFlow };
}
