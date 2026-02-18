/**
 * Financial Planner Agent — Tool Handler Implementations
 *
 * Handler functions for spending analysis, wealth projection,
 * debt strategy comparison, budget generation, and Cognee search.
 */

import { cogneeTools } from '../../cognee-tools.js';
import { RISK_PROFILE_RETURNS, BUDGET_RULES } from './constants.js';
import { simulatePayoff } from './helpers.js';

export function buildFinancialPlannerHandlers(): Map<
  string,
  (input: Record<string, unknown>) => Promise<unknown>
> {
  return new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'analyze_spending_patterns',
      async (input) => {
        const txns = input.transactions as Array<{
          id: string;
          date: string;
          description: string;
          amount: number;
          category?: string;
        }>;

        let totalIncomeCents = 0;
        let totalExpensesCents = 0;
        const categoryTotals: Record<string, number> = {};
        const monthlyTotals: Record<string, { income: number; expenses: number }> = {};

        for (const tx of txns) {
          const cat = tx.category ?? 'Uncategorised';
          categoryTotals[cat] = (categoryTotals[cat] ?? 0) + Math.abs(tx.amount);

          const month = tx.date?.slice(0, 7) ?? 'unknown';
          if (!monthlyTotals[month]) monthlyTotals[month] = { income: 0, expenses: 0 };

          if (tx.amount > 0) {
            totalIncomeCents += tx.amount;
            monthlyTotals[month].income += tx.amount;
          } else {
            totalExpensesCents += Math.abs(tx.amount);
            monthlyTotals[month].expenses += Math.abs(tx.amount);
          }
        }

        const months = Object.keys(monthlyTotals).length || 1;
        const avgMonthlyIncomeCents = Math.round(totalIncomeCents / months);
        const avgMonthlyExpensesCents = Math.round(totalExpensesCents / months);

        const topCategories = Object.entries(categoryTotals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([category, totalCents]) => ({
            category,
            totalCents,
            percentOfIncome:
              totalIncomeCents > 0 ? Math.round((totalCents / totalIncomeCents) * 10000) / 100 : 0,
          }));

        const savingsRatePercent =
          totalIncomeCents > 0
            ? Math.round(((totalIncomeCents - totalExpensesCents) / totalIncomeCents) * 10000) / 100
            : 0;

        return {
          totalIncomeCents,
          totalExpensesCents,
          avgMonthlyIncomeCents,
          avgMonthlyExpensesCents,
          savingsRatePercent,
          topCategories,
          monthlyTotals,
          transactionsAnalyzed: txns.length,
        };
      },
    ],
    [
      'project_wealth',
      async (input) => {
        const currentSavingsCents = input.currentSavingsCents as number;
        const monthlySavingsCents = input.monthlySavingsCents as number;
        const riskProfile = (input.riskProfile as string) ?? 'balanced';
        const years = (input.yearsToProject as number) ?? 5;

        const annualReturn = RISK_PROFILE_RETURNS[riskProfile] ?? 0.06;
        const monthlyReturn = annualReturn / 12;

        const projections: Array<{
          year: number;
          projectedNetWorthCents: number;
          assumptions: string;
        }> = [];

        let balance = currentSavingsCents;
        for (let y = 1; y <= years; y++) {
          for (let m = 0; m < 12; m++) {
            balance = Math.round(balance * (1 + monthlyReturn)) + monthlySavingsCents;
          }
          projections.push({
            year: y,
            projectedNetWorthCents: balance,
            assumptions: `${riskProfile} profile @ ${(annualReturn * 100).toFixed(1)}% p.a., $${(monthlySavingsCents / 100).toFixed(0)}/mo savings`,
          });
        }

        return { projections };
      },
    ],
    [
      'compare_debt_strategies',
      async (input) => {
        const debts = input.debts as Array<{
          name: string;
          balanceCents: number;
          interestRate: number;
          minimumPaymentCents: number;
        }>;
        const extraCents = (input.extraPaymentCents as number) ?? 0;

        const avalancheOrder = [...debts].sort((a, b) => b.interestRate - a.interestRate);
        const avalancheResult = simulatePayoff(avalancheOrder, extraCents);

        const snowballOrder = [...debts].sort((a, b) => a.balanceCents - b.balanceCents);
        const snowballResult = simulatePayoff(snowballOrder, extraCents);

        return {
          avalanche: {
            method: 'avalanche',
            totalInterestPaidCents: avalancheResult.totalInterestCents,
            payoffMonths: avalancheResult.months,
            order: avalancheResult.order,
          },
          snowball: {
            method: 'snowball',
            totalInterestPaidCents: snowballResult.totalInterestCents,
            payoffMonths: snowballResult.months,
            order: snowballResult.order,
          },
          recommendation:
            avalancheResult.totalInterestCents <= snowballResult.totalInterestCents
              ? 'avalanche'
              : 'snowball',
          interestSavedCents: Math.abs(
            snowballResult.totalInterestCents - avalancheResult.totalInterestCents,
          ),
        };
      },
    ],
    [
      'generate_budget',
      async (input) => {
        const monthlyIncomeCents = input.monthlyIncomeCents as number;
        const spending = input.currentSpendingByCategory as Record<string, number>;
        const riskProfile = (input.riskProfile as string) ?? 'balanced';

        const rule = BUDGET_RULES[riskProfile] ?? BUDGET_RULES.balanced;

        const needsBudgetCents = Math.round(monthlyIncomeCents * (rule.needs / 100));
        const wantsBudgetCents = Math.round(monthlyIncomeCents * (rule.wants / 100));
        const savingsBudgetCents = Math.round(monthlyIncomeCents * (rule.savings / 100));

        const needsCategories = new Set([
          'Rent & Lease',
          'Utilities',
          'Insurance',
          'Groceries',
          'Communication & Internet',
          'Motor Vehicle Expenses',
          'Medical & Health',
        ]);

        const monthlyTargets: Array<{
          category: string;
          currentCents: number;
          recommendedCents: number;
        }> = [];

        for (const [category, current] of Object.entries(spending)) {
          const isNeed = needsCategories.has(category);
          const recommended = isNeed ? current : Math.round(current * 0.8);
          monthlyTargets.push({
            category,
            currentCents: Math.abs(current),
            recommendedCents: Math.abs(recommended),
          });
        }

        return {
          needs: rule.needs,
          wants: rule.wants,
          savings: rule.savings,
          needsBudgetCents,
          wantsBudgetCents,
          savingsBudgetCents,
          monthlyTargets,
        };
      },
    ],
    [
      'search_financial_patterns',
      async (input) => {
        const query = input.query as string;
        const patternType = input.patternType as string | undefined;
        const searchQuery = patternType ? `${query} type:${patternType}` : query;
        try {
          const results = await cogneeTools.searchWithDataPoint(
            searchQuery,
            'FinancialTransaction',
          );
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Cognee search unavailable' };
        }
      },
    ],
    [
      'temporal_financial_search',
      async (input) => {
        const query = input.query as string;
        const timeRange = input.timeRange as { start: string; end: string };
        try {
          const results = await cogneeTools.temporalSearch(query, 'financial_insights', timeRange);
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Temporal search unavailable' };
        }
      },
    ],
    [
      'cross_module_planning_context',
      async (input) => {
        const query = input.query as string;
        try {
          const results = await cogneeTools.crossModuleSearch(query, [
            'transactions',
            'forecasting',
            'tax',
            'analytics',
          ]);
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Cross-module search unavailable' };
        }
      },
    ],
    [
      'search_financial_context',
      async (input) => {
        const query = input.query as string;
        const userId = input.userId as string | undefined;
        const dataset = userId ? `financial_user_${userId}` : 'financial_advice';
        try {
          const results = await cogneeTools.search(query, dataset, 'RAG_COMPLETION');
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Cognee search unavailable' };
        }
      },
    ],
  ]);
}
