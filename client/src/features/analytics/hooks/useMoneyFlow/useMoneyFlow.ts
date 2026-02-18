import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../../api/index.js';
import type { Transaction } from '../../../../api/index.js';
import type { MoneyFlowData, SankeyNode, SankeyLink, FlowSummary } from './types.js';
import {
  REVENUE_CATEGORIES,
  EXPENSE_CATEGORIES,
  SYSTEM_CATEGORIES,
  filterByPeriod,
  computeMonthlyTrends,
} from './transforms.js';

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
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load transaction data');
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
      return { nodes: [] as SankeyNode[], links: [] as SankeyLink[], summary: emptySummary };
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
