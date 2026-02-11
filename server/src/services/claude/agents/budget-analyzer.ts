/**
 * BudgetAnalyzer Agent
 *
 * Analyzes spending patterns, projects future balances,
 * identifies savings opportunities, and generates financial insights.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools } from '../cognee-tools.js';
import type { BudgetAnalyzerInput, BudgetAnalyzerOutput } from '../types.js';

export class BudgetAnalyzerAgent extends ClaudeAgent<
  BudgetAnalyzerInput,
  BudgetAnalyzerOutput
> {
  protected systemPrompt = `You are a personal finance analyst specializing in Australian household and small business budgeting. Analyze transaction history to identify spending patterns, recurring expenses, unusual transactions, and savings opportunities. Provide actionable insights with specific dollar amounts and timeframes. Consider seasonal patterns, inflation, and the Australian cost of living.

Your workflow:
1. Use analyze_spending_by_category to get spending breakdown
2. Use identify_recurring to find subscriptions and regular payments
3. Use calculate_monthly_averages for trend analysis
4. Use find_anomalies to flag unusual transactions
5. Optionally use project_balance for future projections
6. Use calculate_savings_rate to benchmark savings
7. Compile insights and return structured results

Return a JSON object matching the BudgetAnalyzerOutput schema.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'analyze_spending_by_category',
      description: 'Get spending totals per category with month-over-month trends.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: {
            type: 'array',
            items: { type: 'object' },
          },
          period: {
            type: 'object',
            properties: {
              start: { type: 'string' },
              end: { type: 'string' },
            },
          },
        },
        required: ['transactions'],
      },
    },
    {
      name: 'identify_recurring',
      description: 'Detect subscriptions and regular payments by pattern matching.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: {
            type: 'array',
            items: { type: 'object' },
          },
        },
        required: ['transactions'],
      },
    },
    {
      name: 'calculate_monthly_averages',
      description: 'Calculate average income and expense per month.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: {
            type: 'array',
            items: { type: 'object' },
          },
          months: { type: 'number', description: 'Number of months to analyze' },
        },
        required: ['transactions'],
      },
    },
    {
      name: 'project_balance',
      description: 'Project future account balance based on historical patterns.',
      input_schema: {
        type: 'object' as const,
        properties: {
          currentBalance: { type: 'number' },
          transactions: { type: 'array', items: { type: 'object' } },
          months: { type: 'number', description: 'Months to project' },
        },
        required: ['currentBalance', 'transactions', 'months'],
      },
    },
    {
      name: 'find_anomalies',
      description: 'Find unusually large or unusual transactions.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: { type: 'array', items: { type: 'object' } },
          stdDevThreshold: { type: 'number', description: 'Standard deviation threshold (default 2)' },
        },
        required: ['transactions'],
      },
    },
    {
      name: 'search_financial_context',
      description: 'Search Cognee for historical financial context.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    },
    {
      name: 'calculate_savings_rate',
      description: 'Calculate savings rate and compare to Australian benchmarks.',
      input_schema: {
        type: 'object' as const,
        properties: {
          income: { type: 'number', description: 'Total income in cents' },
          expenses: { type: 'number', description: 'Total expenses in cents' },
        },
        required: ['income', 'expenses'],
      },
    },
  ];

  protected toolHandlers = new Map<
    string,
    (input: Record<string, unknown>) => Promise<unknown>
  >([
    [
      'analyze_spending_by_category',
      async (input) => {
        const transactions = input.transactions as Array<{
          date: string;
          amount: number;
          category?: string;
        }>;

        const byCategory = new Map<string, { total: number; count: number }>();
        let grandTotal = 0;

        for (const tx of transactions) {
          if (tx.amount < 0) {
            const cat = tx.category || 'Uncategorized';
            const abs = Math.abs(tx.amount);
            const existing = byCategory.get(cat) || { total: 0, count: 0 };
            existing.total += abs;
            existing.count++;
            byCategory.set(cat, existing);
            grandTotal += abs;
          }
        }

        const breakdown = Array.from(byCategory.entries())
          .map(([category, data]) => ({
            category,
            total: data.total,
            count: data.count,
            percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
          }))
          .sort((a, b) => b.total - a.total);

        return { breakdown, grandTotal };
      },
    ],
    [
      'identify_recurring',
      async (input) => {
        const transactions = input.transactions as Array<{
          date: string;
          description: string;
          amount: number;
        }>;

        // Group by normalized description + similar amount
        const groups = new Map<string, Array<{ date: string; amount: number }>>();

        for (const tx of transactions) {
          // Normalize: lowercase, remove numbers/dates, trim
          const key = tx.description
            .toLowerCase()
            .replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]?\d{0,4}/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 30);

          const existing = groups.get(key) || [];
          existing.push({ date: tx.date, amount: tx.amount });
          groups.set(key, existing);
        }

        // Filter for recurring (3+ occurrences)
        const recurring = Array.from(groups.entries())
          .filter(([, occurrences]) => occurrences.length >= 3)
          .map(([description, occurrences]) => {
            const avgAmount = occurrences.reduce((s, o) => s + Math.abs(o.amount), 0) / occurrences.length;
            const sorted = occurrences.map((o) => o.date).sort();
            const gaps: number[] = [];
            for (let i = 1; i < sorted.length; i++) {
              const d1 = new Date(sorted[i - 1]);
              const d2 = new Date(sorted[i]);
              gaps.push(
                Math.round(
                  (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)
                )
              );
            }
            const avgGap = gaps.length > 0
              ? gaps.reduce((s, g) => s + g, 0) / gaps.length
              : 30;

            let frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual' = 'monthly';
            if (avgGap <= 10) frequency = 'weekly';
            else if (avgGap <= 20) frequency = 'fortnightly';
            else if (avgGap <= 45) frequency = 'monthly';
            else if (avgGap <= 120) frequency = 'quarterly';
            else frequency = 'annual';

            return {
              description,
              amount: Math.round(avgAmount),
              frequency,
              occurrences: occurrences.length,
              lastDate: sorted[sorted.length - 1],
            };
          });

        return recurring;
      },
    ],
    [
      'calculate_monthly_averages',
      async (input) => {
        const transactions = input.transactions as Array<{
          date: string;
          amount: number;
        }>;

        const byMonth = new Map<string, { income: number; expenses: number }>();

        for (const tx of transactions) {
          const month = tx.date.substring(0, 7); // YYYY-MM
          const existing = byMonth.get(month) || { income: 0, expenses: 0 };
          if (tx.amount > 0) {
            existing.income += tx.amount;
          } else {
            existing.expenses += Math.abs(tx.amount);
          }
          byMonth.set(month, existing);
        }

        const months = Array.from(byMonth.entries())
          .map(([month, data]) => ({
            month,
            income: data.income,
            expenses: data.expenses,
            net: data.income - data.expenses,
          }))
          .sort((a, b) => a.month.localeCompare(b.month));

        const totalIncome = months.reduce((s, m) => s + m.income, 0);
        const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);
        const numMonths = months.length || 1;

        return {
          months,
          averageMonthlyIncome: Math.round(totalIncome / numMonths),
          averageMonthlyExpenses: Math.round(totalExpenses / numMonths),
          averageMonthlyNet: Math.round((totalIncome - totalExpenses) / numMonths),
        };
      },
    ],
    [
      'project_balance',
      async (input) => {
        const currentBalance = input.currentBalance as number;
        const transactions = input.transactions as Array<{
          date: string;
          amount: number;
        }>;
        const months = (input.months as number) || 6;

        // Calculate average monthly net change
        const byMonth = new Map<string, number>();
        for (const tx of transactions) {
          const month = tx.date.substring(0, 7);
          byMonth.set(month, (byMonth.get(month) || 0) + tx.amount);
        }
        const monthlyNets = Array.from(byMonth.values());
        const avgMonthlyNet =
          monthlyNets.length > 0
            ? monthlyNets.reduce((s, n) => s + n, 0) / monthlyNets.length
            : 0;

        const projections = [];
        let balance = currentBalance;
        const now = new Date();
        for (let i = 1; i <= months; i++) {
          const futureDate = new Date(now);
          futureDate.setMonth(futureDate.getMonth() + i);
          balance += avgMonthlyNet;
          projections.push({
            month: futureDate.toISOString().substring(0, 7),
            projectedBalance: Math.round(balance),
            confidence: Math.max(0.3, 1 - i * 0.1),
          });
        }

        return projections;
      },
    ],
    [
      'find_anomalies',
      async (input) => {
        const transactions = input.transactions as Array<{
          id: number;
          date: string;
          description: string;
          amount: number;
        }>;
        const threshold = (input.stdDevThreshold as number) || 2;

        const amounts = transactions.map((t) => Math.abs(t.amount));
        const mean = amounts.reduce((s, a) => s + a, 0) / (amounts.length || 1);
        const variance =
          amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) /
          (amounts.length || 1);
        const stdDev = Math.sqrt(variance);

        return transactions.filter(
          (tx) => Math.abs(Math.abs(tx.amount) - mean) > threshold * stdDev
        );
      },
    ],
    [
      'search_financial_context',
      async (input) => {
        const query = input.query as string;
        return cogneeTools.search(query, 'financial_insights');
      },
    ],
    [
      'calculate_savings_rate',
      async (input) => {
        const income = input.income as number;
        const expenses = input.expenses as number;

        if (income <= 0) {
          return { rate: 0, comparison: 'No income recorded' };
        }

        const savings = income - expenses;
        const rate = (savings / income) * 100;

        // Australian benchmark: ~3.2% savings rate (ABS)
        let comparison: string;
        if (rate > 20) comparison = 'Excellent — well above the Australian average of ~3.2%';
        else if (rate > 10) comparison = 'Good — above the Australian average of ~3.2%';
        else if (rate > 3.2) comparison = 'Slightly above the Australian average savings rate';
        else if (rate > 0) comparison = 'Below the Australian average savings rate of ~3.2%';
        else comparison = 'Negative savings — spending exceeds income';

        return { rate: Math.round(rate * 100) / 100, comparison };
      },
    ],
  ]);

  constructor() {
    super('budget_analyzer');
  }
}
