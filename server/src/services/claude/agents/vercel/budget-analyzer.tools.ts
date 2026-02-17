/**
 * Vercel Budget Analyzer — Tool Handler Implementations
 *
 * Contains the handler functions for spending analysis, recurring detection,
 * monthly averages, anomaly finding, balance projection, and savings rate.
 */

import { adaptLegacyTool } from '../../tool-adapter.js';
import { buildBudgetAnalysisTools } from './budget-analyzer.analysis-tools.js';
import type { ToolSet } from 'ai';

export function buildBudgetAnalyzerTools(): ToolSet {
  const tools: ToolSet = {};

  tools['analyze_spending_by_category'] = adaptLegacyTool(
    'analyze_spending_by_category',
    'Get spending totals per category with month-over-month trends.',
    {
      type: 'object',
      properties: {
        transactions: {
          type: 'array',
          description: 'Array of transaction objects with date, amount, and optional category',
          items: { type: 'object' },
        },
        period: {
          type: 'object',
          description: 'Optional date range filter',
          properties: {
            start: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
            end: { type: 'string', description: 'End date (YYYY-MM-DD)' },
          },
        },
      },
      required: ['transactions'],
    },
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
  );

  tools['identify_recurring'] = adaptLegacyTool(
    'identify_recurring',
    'Detect subscriptions and regular payments by pattern matching.',
    {
      type: 'object',
      properties: {
        transactions: {
          type: 'array',
          description: 'Array of transaction objects with date, description, and amount',
          items: { type: 'object' },
        },
      },
      required: ['transactions'],
    },
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
          .replace(/\d{1,2}[/-]\d{1,2}[/-]?\d{0,4}/g, '')
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
          const avgAmount =
            occurrences.reduce((s, o) => s + Math.abs(o.amount), 0) / occurrences.length;
          const sorted = occurrences.map((o) => o.date).sort();
          const gaps: number[] = [];
          for (let i = 1; i < sorted.length; i++) {
            const d1 = new Date(sorted[i - 1]);
            const d2 = new Date(sorted[i]);
            gaps.push(Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
          }
          const avgGap = gaps.length > 0 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 30;

          let frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual' =
            'monthly';
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
  );

  tools['calculate_monthly_averages'] = adaptLegacyTool(
    'calculate_monthly_averages',
    'Calculate average income and expense per month.',
    {
      type: 'object',
      properties: {
        transactions: {
          type: 'array',
          description: 'Array of transaction objects with date and amount',
          items: { type: 'object' },
        },
        months: { type: 'number', description: 'Number of months to analyze' },
      },
      required: ['transactions'],
    },
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
  );

  // Merge in analysis tools (anomalies, projections, savings rate, Cognee search)
  const analysisTools = buildBudgetAnalysisTools();
  Object.assign(tools, analysisTools);

  return tools;
}
