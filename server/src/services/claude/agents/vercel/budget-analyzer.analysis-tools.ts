/**
 * Vercel Budget Analyzer — Analysis Tool Implementations
 *
 * Extracted from budget-analyzer.tools.ts: anomaly detection, balance projection,
 * savings rate calculation, and Cognee financial context search.
 */

import { adaptLegacyTool } from '../../tool-adapter.js';
import { cogneeTools } from '../../cognee-tools.js';
import type { ToolSet } from 'ai';

/**
 * Build the analysis-focused tools for the budget analyzer.
 * Merged into the main tool set by buildBudgetAnalyzerTools().
 */
export function buildBudgetAnalysisTools(): ToolSet {
  const tools: ToolSet = {};

  tools['find_anomalies'] = adaptLegacyTool(
    'find_anomalies',
    'Find unusually large or unusual transactions.',
    {
      type: 'object',
      properties: {
        transactions: {
          type: 'array',
          description: 'Array of transaction objects with id, date, description, and amount',
          items: { type: 'object' },
        },
        stdDevThreshold: {
          type: 'number',
          description: 'Standard deviation threshold (default 2)',
        },
      },
      required: ['transactions'],
    },
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
        amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / (amounts.length || 1);
      const stdDev = Math.sqrt(variance);

      return transactions.filter(
        (tx) => Math.abs(Math.abs(tx.amount) - mean) > threshold * stdDev,
      );
    },
  );

  tools['project_balance'] = adaptLegacyTool(
    'project_balance',
    'Project future account balance based on historical patterns.',
    {
      type: 'object',
      properties: {
        currentBalance: { type: 'number', description: 'Current account balance in cents' },
        transactions: {
          type: 'array',
          description: 'Array of transaction objects with date and amount',
          items: { type: 'object' },
        },
        months: { type: 'number', description: 'Months to project' },
      },
      required: ['currentBalance', 'transactions', 'months'],
    },
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
        monthlyNets.length > 0 ? monthlyNets.reduce((s, n) => s + n, 0) / monthlyNets.length : 0;

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
  );

  tools['calculate_savings_rate'] = adaptLegacyTool(
    'calculate_savings_rate',
    'Calculate savings rate and compare to Australian benchmarks.',
    {
      type: 'object',
      properties: {
        income: { type: 'number', description: 'Total income in cents' },
        expenses: { type: 'number', description: 'Total expenses in cents' },
      },
      required: ['income', 'expenses'],
    },
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
      if (rate > 20) comparison = 'Excellent -- well above the Australian average of ~3.2%';
      else if (rate > 10) comparison = 'Good -- above the Australian average of ~3.2%';
      else if (rate > 3.2) comparison = 'Slightly above the Australian average savings rate';
      else if (rate > 0) comparison = 'Below the Australian average savings rate of ~3.2%';
      else comparison = 'Negative savings -- spending exceeds income';

      return { rate: Math.round(rate * 100) / 100, comparison };
    },
  );

  tools['search_financial_context'] = adaptLegacyTool(
    'search_financial_context',
    'Search Cognee for historical financial context and insights.',
    {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for financial context' },
      },
      required: ['query'],
    },
    async (input) => {
      const query = input.query as string;
      try {
        return await cogneeTools.search(query, 'financial_insights');
      } catch {
        return { found: false, results: [], error: 'Cognee search unavailable' };
      }
    },
  );

  return tools;
}
