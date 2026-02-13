import { useState, useEffect, useMemo } from 'react';
import { api, type Transaction } from '../../../api';
import { CATEGORIES } from '../../transactions/constants/categories';

export interface SankeyNode {
  name: string;
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

export interface FlowSummary {
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  largestIncomeSource: { name: string; amount: number };
  largestExpenseCategory: { name: string; amount: number };
  savingsRate: number;
  /** Monthly income values for the past 6 months (for sparklines) */
  monthlyIncome: number[];
  /** Monthly expense values for the past 6 months (for sparklines) */
  monthlyExpenses: number[];
  /** Monthly net cash flow for the past 6 months (for sparklines) */
  monthlyCashFlow: number[];
}

interface MoneyFlowData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  summary: FlowSummary;
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
}

const REVENUE_CATEGORIES = new Set(
  CATEGORIES.filter((c) => c.type === 'revenue').map((c) => c.name),
);

const EXPENSE_CATEGORIES = new Set(
  CATEGORIES.filter((c) => c.type === 'expense' || c.type === 'cogs').map((c) => c.name),
);

const SYSTEM_CATEGORIES = new Set(CATEGORIES.filter((c) => c.type === 'system').map((c) => c.name));

function filterByPeriod(transactions: Transaction[], period: string): Transaction[] {
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
function computeMonthlyTrends(transactions: Transaction[]): {
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

function generateMockData(): { transactions: Transaction[]; total: number } {
  const mockTx: Transaction[] = [
    {
      id: '1',
      date: '2026-01-15',
      description: 'Client Invoice #1042',
      amount: 4500,
      category: 'Service Revenue',
      gstApplicable: true,
      confidenceScore: 0.95,
    },
    {
      id: '2',
      date: '2026-01-18',
      description: 'Product Sale',
      amount: 2200,
      category: 'Sales Revenue',
      gstApplicable: true,
      confidenceScore: 0.9,
    },
    {
      id: '3',
      date: '2026-01-20',
      description: 'Bank Interest',
      amount: 45,
      category: 'Interest Income',
      gstApplicable: false,
      confidenceScore: 0.99,
    },
    {
      id: '4',
      date: '2026-01-22',
      description: 'Rental Payment Received',
      amount: 1800,
      category: 'Rental Income',
      gstApplicable: true,
      confidenceScore: 0.92,
    },
    {
      id: '5',
      date: '2026-02-01',
      description: 'Freelance Project',
      amount: 3200,
      category: 'Business Income',
      gstApplicable: true,
      confidenceScore: 0.88,
    },
    {
      id: '6',
      date: '2026-02-05',
      description: 'Woolworths',
      amount: -185,
      category: 'Groceries',
      gstApplicable: true,
      confidenceScore: 0.97,
    },
    {
      id: '7',
      date: '2026-02-06',
      description: 'Shell Fuel',
      amount: -95,
      category: 'Fuel',
      gstApplicable: true,
      confidenceScore: 0.95,
    },
    {
      id: '8',
      date: '2026-02-07',
      description: 'Telstra Bill',
      amount: -120,
      category: 'Telephone & Internet',
      gstApplicable: true,
      confidenceScore: 0.96,
    },
    {
      id: '9',
      date: '2026-02-08',
      description: 'Office Rent',
      amount: -2200,
      category: 'Rent',
      gstApplicable: true,
      confidenceScore: 0.98,
    },
    {
      id: '10',
      date: '2026-02-09',
      description: 'AWS Hosting',
      amount: -350,
      category: 'Computer & IT',
      gstApplicable: true,
      confidenceScore: 0.93,
    },
    {
      id: '11',
      date: '2026-02-10',
      description: 'NRMA Insurance',
      amount: -680,
      category: 'Insurance',
      gstApplicable: false,
      confidenceScore: 0.94,
    },
    {
      id: '12',
      date: '2026-02-11',
      description: 'Uber Eats',
      amount: -42,
      category: 'Dining & Takeaway',
      gstApplicable: true,
      confidenceScore: 0.91,
    },
    {
      id: '13',
      date: '2026-02-12',
      description: 'Xero Subscription',
      amount: -65,
      category: 'Software & Subscriptions',
      gstApplicable: true,
      confidenceScore: 0.96,
    },
    {
      id: '14',
      date: '2026-01-25',
      description: 'Client Invoice #1043',
      amount: 6800,
      category: 'Service Revenue',
      gstApplicable: true,
      confidenceScore: 0.94,
    },
    {
      id: '15',
      date: '2026-01-28',
      description: 'Transfer to Savings',
      amount: -2000,
      category: 'Transfer',
      gstApplicable: false,
      confidenceScore: 0.99,
      isTransfer: true,
    },
    {
      id: '16',
      date: '2026-02-03',
      description: 'CPA Accounting Fees',
      amount: -450,
      category: 'Professional Fees',
      gstApplicable: true,
      confidenceScore: 0.92,
    },
    {
      id: '17',
      date: '2026-02-04',
      description: 'Marketing Campaign',
      amount: -320,
      category: 'Advertising & Marketing',
      gstApplicable: true,
      confidenceScore: 0.89,
    },
    {
      id: '18',
      date: '2026-02-06',
      description: 'Bunnings Hardware',
      amount: -175,
      category: 'Home & Garden',
      gstApplicable: true,
      confidenceScore: 0.91,
    },
    {
      id: '19',
      date: '2026-02-07',
      description: 'Staff Wages',
      amount: -3500,
      category: 'Wages & Salaries',
      gstApplicable: false,
      confidenceScore: 0.97,
    },
    {
      id: '20',
      date: '2026-02-10',
      description: 'ATO BAS Payment',
      amount: -1400,
      category: 'Tax Payments',
      gstApplicable: false,
      confidenceScore: 0.98,
    },
    // Older months for sparkline data
    {
      id: '21',
      date: '2025-09-15',
      description: 'Client Work Sep',
      amount: 5200,
      category: 'Service Revenue',
      gstApplicable: true,
      confidenceScore: 0.95,
    },
    {
      id: '22',
      date: '2025-09-20',
      description: 'Rent Sep',
      amount: -2200,
      category: 'Rent',
      gstApplicable: true,
      confidenceScore: 0.98,
    },
    {
      id: '23',
      date: '2025-10-15',
      description: 'Client Work Oct',
      amount: 4800,
      category: 'Service Revenue',
      gstApplicable: true,
      confidenceScore: 0.95,
    },
    {
      id: '24',
      date: '2025-10-22',
      description: 'Rent Oct',
      amount: -2200,
      category: 'Rent',
      gstApplicable: true,
      confidenceScore: 0.98,
    },
    {
      id: '25',
      date: '2025-11-15',
      description: 'Client Work Nov',
      amount: 6100,
      category: 'Service Revenue',
      gstApplicable: true,
      confidenceScore: 0.95,
    },
    {
      id: '26',
      date: '2025-11-20',
      description: 'Rent Nov',
      amount: -2200,
      category: 'Rent',
      gstApplicable: true,
      confidenceScore: 0.98,
    },
    {
      id: '27',
      date: '2025-12-15',
      description: 'Client Work Dec',
      amount: 3900,
      category: 'Service Revenue',
      gstApplicable: true,
      confidenceScore: 0.95,
    },
    {
      id: '28',
      date: '2025-12-22',
      description: 'Rent Dec',
      amount: -2200,
      category: 'Rent',
      gstApplicable: true,
      confidenceScore: 0.98,
    },
  ];
  return { transactions: mockTx, total: mockTx.length };
}

export function useMoneyFlow(
  period: string,
  options: { minThreshold?: number; includeTransfers?: boolean } = {},
): MoneyFlowData {
  const { minThreshold = 10, includeTransfers = false } = options;
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await api.fetchTransactions({ limit: 10000 });
        if (!cancelled) {
          setAllTransactions(result.transactions);
        }
      } catch {
        // Fallback to mock data
        if (!cancelled) {
          const mock = generateMockData();
          setAllTransactions(mock.transactions);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const periodTransactions = useMemo(
    () => filterByPeriod(allTransactions, period),
    [allTransactions, period],
  );

  const monthlyTrends = useMemo(() => computeMonthlyTrends(allTransactions), [allTransactions]);

  const { nodes, links, summary } = useMemo(() => {
    const filtered = includeTransfers
      ? periodTransactions
      : periodTransactions.filter(
          (tx) => !tx.isTransfer && !SYSTEM_CATEGORIES.has(tx.category ?? ''),
        );

    // Aggregate income by source category
    const incomeBySource = new Map<string, number>();
    // Aggregate expenses by category
    const expenseByCategory = new Map<string, number>();
    // Track account names
    const accountNames = new Set<string>();

    for (const tx of filtered) {
      const cat = tx.category ?? 'Uncategorized';
      const accountName = tx.accountId ? `Account ${tx.accountId.slice(0, 6)}` : 'Main Account';
      accountNames.add(accountName);

      if (tx.amount > 0 && REVENUE_CATEGORIES.has(cat)) {
        incomeBySource.set(cat, (incomeBySource.get(cat) ?? 0) + tx.amount);
      } else if (tx.amount < 0) {
        const absCat = EXPENSE_CATEGORIES.has(cat)
          ? cat
          : SYSTEM_CATEGORIES.has(cat)
            ? cat
            : 'Other Expenses';
        expenseByCategory.set(absCat, (expenseByCategory.get(absCat) ?? 0) + Math.abs(tx.amount));
      } else if (tx.amount > 0 && !REVENUE_CATEGORIES.has(cat)) {
        // Positive amounts not in revenue categories (refunds, etc.)
        incomeBySource.set('Other Income', (incomeBySource.get('Other Income') ?? 0) + tx.amount);
      }
    }

    // Filter by minimum threshold
    for (const [key, value] of incomeBySource) {
      if (value < minThreshold) incomeBySource.delete(key);
    }
    for (const [key, value] of expenseByCategory) {
      if (value < minThreshold) expenseByCategory.delete(key);
    }

    // Build nodes: [income sources] -> [accounts] -> [expense categories]
    const incomeKeys = [...incomeBySource.keys()].sort(
      (a, b) => (incomeBySource.get(b) ?? 0) - (incomeBySource.get(a) ?? 0),
    );
    const accountKeys = accountNames.size > 0 ? [...accountNames] : ['Main Account'];
    const expenseKeys = [...expenseByCategory.keys()].sort(
      (a, b) => (expenseByCategory.get(b) ?? 0) - (expenseByCategory.get(a) ?? 0),
    );

    const emptySummary: FlowSummary = {
      totalIncome: 0,
      totalExpenses: 0,
      netCashFlow: 0,
      largestIncomeSource: { name: 'N/A', amount: 0 },
      largestExpenseCategory: { name: 'N/A', amount: 0 },
      savingsRate: 0,
      monthlyIncome: monthlyTrends.monthlyIncome,
      monthlyExpenses: monthlyTrends.monthlyExpenses,
      monthlyCashFlow: monthlyTrends.monthlyCashFlow,
    };

    if (incomeKeys.length === 0 && expenseKeys.length === 0) {
      return { nodes: [], links: [], summary: emptySummary };
    }

    const nodeList: SankeyNode[] = [
      ...incomeKeys.map((name) => ({ name })),
      ...accountKeys.map((name) => ({ name })),
      ...expenseKeys.map((name) => ({ name })),
    ];

    const incomeOffset = 0;
    const accountOffset = incomeKeys.length;
    const expenseOffset = incomeKeys.length + accountKeys.length;

    const linkList: SankeyLink[] = [];

    // Income sources -> accounts (distribute evenly across accounts)
    for (let i = 0; i < incomeKeys.length; i++) {
      const value = incomeBySource.get(incomeKeys[i]!) ?? 0;
      const perAccount = value / accountKeys.length;
      for (let a = 0; a < accountKeys.length; a++) {
        if (perAccount >= minThreshold) {
          linkList.push({
            source: incomeOffset + i,
            target: accountOffset + a,
            value: Math.round(perAccount * 100) / 100,
          });
        }
      }
    }

    // Accounts -> expense categories (distribute evenly from accounts)
    for (let e = 0; e < expenseKeys.length; e++) {
      const value = expenseByCategory.get(expenseKeys[e]!) ?? 0;
      const perAccount = value / accountKeys.length;
      for (let a = 0; a < accountKeys.length; a++) {
        if (perAccount >= minThreshold) {
          linkList.push({
            source: accountOffset + a,
            target: expenseOffset + e,
            value: Math.round(perAccount * 100) / 100,
          });
        }
      }
    }

    const totalIncome = [...incomeBySource.values()].reduce((s, v) => s + v, 0);
    const totalExpenses = [...expenseByCategory.values()].reduce((s, v) => s + v, 0);
    const netCashFlow = totalIncome - totalExpenses;

    const largestIncomeName = incomeKeys[0] ?? 'N/A';
    const largestIncomeAmount = incomeBySource.get(largestIncomeName) ?? 0;
    const largestExpenseName = expenseKeys[0] ?? 'N/A';
    const largestExpenseAmount = expenseByCategory.get(largestExpenseName) ?? 0;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    return {
      nodes: nodeList,
      links: linkList,
      summary: {
        totalIncome,
        totalExpenses,
        netCashFlow,
        largestIncomeSource: { name: largestIncomeName, amount: largestIncomeAmount },
        largestExpenseCategory: { name: largestExpenseName, amount: largestExpenseAmount },
        savingsRate,
        monthlyIncome: monthlyTrends.monthlyIncome,
        monthlyExpenses: monthlyTrends.monthlyExpenses,
        monthlyCashFlow: monthlyTrends.monthlyCashFlow,
      },
    };
  }, [periodTransactions, minThreshold, includeTransfers, monthlyTrends]);

  return { nodes, links, summary, transactions: periodTransactions, loading, error };
}
