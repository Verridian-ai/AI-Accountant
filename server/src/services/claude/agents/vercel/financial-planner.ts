/**
 * Vercel AI SDK — Financial Planner Agent
 *
 * Drop-in replacement for FinancialPlannerAgent (legacy ClaudeAgent)
 * using the Vercel AI SDK with Zod structured output.
 */

import { VercelAgent } from '../../vercel-agent.js';
import { adaptLegacyTool } from '../../tool-adapter.js';
import { FinancialPlannerOutputSchema } from '../../schemas/planner-output.js';
import { cogneeTools } from '../../cognee-tools.js';
import type { FinancialPlannerInput, FinancialPlannerOutput } from '../../types.js';
import type { ToolSet } from 'ai';

/** Expected annual returns by risk profile */
const RISK_PROFILE_RETURNS: Record<string, number> = {
  conservative: 0.04,
  balanced: 0.06,
  growth: 0.08,
  aggressive: 0.1,
};

/** 50/30/20 budget rule variants by risk profile */
const BUDGET_RULES: Record<string, { needs: number; wants: number; savings: number }> = {
  conservative: { needs: 50, wants: 20, savings: 30 },
  balanced: { needs: 50, wants: 30, savings: 20 },
  growth: { needs: 50, wants: 25, savings: 25 },
  aggressive: { needs: 45, wants: 20, savings: 35 },
};

const SYSTEM_PROMPT = `You are an Australian financial planning advisor AI agent. Your role is to:

1. Analyze spending patterns from bank transactions
2. Project wealth growth based on current savings rate and investment returns
3. Compare debt repayment strategies (avalanche vs snowball)
4. Generate personalized monthly budgets
5. Provide actionable financial recommendations

Key rules:
- All amounts are in CENTS (integer). $1,000.00 = 100000 cents.
- Risk profiles: conservative (4% return), balanced (6%), growth (8%), aggressive (10%).
- Budget framework: Needs (essential), Wants (discretionary), Savings (investment/debt repayment).
- Debt strategies: Avalanche (highest interest first) vs Snowball (smallest balance first).
- Australian context: Superannuation, HECS-HELP, Medicare, Australian dollar.
- Be practical and specific — give dollar amounts, not just percentages.
- Consider Australian cost of living, median incomes, and living standards.

Return a JSON object matching the FinancialPlannerOutput schema with:
- spendingAnalysis: Breakdown of income vs expenses
- budgetRecommendation: Personalized monthly targets
- wealthProjection: 5-year projection based on savings rate
- debtStrategy: Optimal debt repayment plan (if debts provided)
- recommendations: Top 3-5 actionable tips`;

/**
 * Simulate debt payoff over time.
 * Returns total interest paid, months to payoff, and payoff order.
 */
function simulatePayoff(
  debts: Array<{
    name: string;
    balanceCents: number;
    interestRate: number;
    minimumPaymentCents: number;
  }>,
  extraPaymentCents: number,
): {
  totalInterestCents: number;
  months: number;
  order: Array<{ debtName: string; payoffMonth: number }>;
} {
  const balances = debts.map((d) => ({ ...d, remaining: d.balanceCents }));
  let totalInterestCents = 0;
  let month = 0;
  const maxMonths = 360;
  const order: Array<{ debtName: string; payoffMonth: number }> = [];

  while (balances.some((d) => d.remaining > 0) && month < maxMonths) {
    month++;

    for (const d of balances) {
      if (d.remaining <= 0) continue;
      const monthlyInterest = Math.round(d.remaining * (d.interestRate / 12));
      d.remaining += monthlyInterest;
      totalInterestCents += monthlyInterest;
    }

    let extraRemaining = extraPaymentCents;
    for (const d of balances) {
      if (d.remaining <= 0) continue;
      const payment = Math.min(d.minimumPaymentCents, d.remaining);
      d.remaining -= payment;
      if (d.remaining <= 0) {
        extraRemaining += d.minimumPaymentCents - payment;
        order.push({ debtName: d.name, payoffMonth: month });
      }
    }

    for (const d of balances) {
      if (d.remaining <= 0 || extraRemaining <= 0) continue;
      const payment = Math.min(extraRemaining, d.remaining);
      d.remaining -= payment;
      extraRemaining -= payment;
      if (d.remaining <= 0) {
        order.push({ debtName: d.name, payoffMonth: month });
      }
    }
  }

  const seen = new Set<string>();
  const uniqueOrder = order.filter((o) => {
    if (seen.has(o.debtName)) return false;
    seen.add(o.debtName);
    return true;
  });

  return { totalInterestCents, months: month, order: uniqueOrder };
}

export class VercelFinancialPlanner extends VercelAgent<
  FinancialPlannerInput,
  FinancialPlannerOutput
> {
  constructor() {
    super('financial_planner', SYSTEM_PROMPT, FinancialPlannerOutputSchema);
  }

  getTools(sessionId?: string): ToolSet {
    const tools: ToolSet = {};

    tools['analyze_spending_patterns'] = adaptLegacyTool(
      'analyze_spending_patterns',
      'Analyze transaction data to identify spending patterns, income sources, and category breakdowns.',
      {
        type: 'object',
        properties: {
          transactions: {
            type: 'array',
            description:
              'Array of transaction objects with id, date, description, amount, category',
          },
        },
        required: ['transactions'],
      },
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
    );

    tools['project_wealth'] = adaptLegacyTool(
      'project_wealth',
      'Project future net worth based on current savings rate, investment returns, and time horizon.',
      {
        type: 'object',
        properties: {
          currentSavingsCents: { type: 'number', description: 'Current savings in cents' },
          monthlySavingsCents: { type: 'number', description: 'Monthly savings in cents' },
          riskProfile: {
            type: 'string',
            description: 'Risk profile: conservative, balanced, growth, or aggressive',
          },
          yearsToProject: { type: 'number', description: 'Number of years to project' },
        },
        required: ['currentSavingsCents', 'monthlySavingsCents', 'riskProfile'],
      },
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
    );

    tools['compare_debt_strategies'] = adaptLegacyTool(
      'compare_debt_strategies',
      'Compare avalanche (highest interest first) vs snowball (smallest balance first) debt repayment strategies.',
      {
        type: 'object',
        properties: {
          debts: {
            type: 'array',
            description:
              'Array of debts with name, balanceCents, interestRate, minimumPaymentCents',
          },
          extraPaymentCents: {
            type: 'number',
            description: 'Extra monthly payment beyond minimums',
          },
        },
        required: ['debts'],
      },
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
    );

    tools['generate_budget'] = adaptLegacyTool(
      'generate_budget',
      'Generate a personalized monthly budget based on income and spending analysis.',
      {
        type: 'object',
        properties: {
          monthlyIncomeCents: { type: 'number', description: 'Monthly income in cents' },
          currentSpendingByCategory: {
            type: 'object',
            description: 'Current spending amounts by category',
          },
          riskProfile: {
            type: 'string',
            description: 'Risk profile: conservative, balanced, growth, or aggressive',
          },
        },
        required: ['monthlyIncomeCents', 'currentSpendingByCategory'],
      },
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
    );

    tools['search_financial_patterns'] = adaptLegacyTool(
      'search_financial_patterns',
      'Search knowledge graph for financial transaction patterns using DataPoint-structured entity matching. Finds similar spending patterns, income trends, and budget benchmarks.',
      {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query for financial patterns' },
          patternType: {
            type: 'string',
            description: 'Optional pattern type filter (e.g., "spending", "income", "savings")',
          },
        },
        required: ['query'],
      },
      async (input) => {
        const query = input.query as string;
        const patternType = input.patternType as string | undefined;
        const searchQuery = patternType ? `${query} type:${patternType}` : query;
        try {
          const results = await cogneeTools.searchWithDataPoint(
            searchQuery, 'FinancialTransaction', sessionId);
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Cognee search unavailable' };
        }
      },
    );

    tools['temporal_financial_search'] = adaptLegacyTool(
      'temporal_financial_search',
      'Search financial patterns from specific time periods for planning context. Useful for seasonal comparisons and historical benchmarking.',
      {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Financial pattern query' },
          timeRange: {
            type: 'object',
            description: 'Time range to search within',
          },
        },
        required: ['query', 'timeRange'],
      },
      async (input) => {
        const query = input.query as string;
        const timeRange = input.timeRange as { start: string; end: string };
        try {
          const results = await cogneeTools.temporalSearch(query, 'financial_insights', timeRange, sessionId);
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Temporal search unavailable' };
        }
      },
    );

    tools['cross_module_planning_context'] = adaptLegacyTool(
      'cross_module_planning_context',
      'Gather comprehensive planning context from all relevant modules including transactions, forecasting, tax, and analytics.',
      {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Planning context query' },
        },
        required: ['query'],
      },
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
    );

    tools['search_financial_context'] = adaptLegacyTool(
      'search_financial_context',
      'Search Cognee for financial advice, benchmarks, and context.',
      {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query for financial context' },
          userId: { type: 'string', description: 'Optional user ID for user-specific context' },
        },
        required: ['query'],
      },
      async (input) => {
        const query = input.query as string;
        const userId = input.userId as string | undefined;
        const dataset = userId ? `financial_user_${userId}` : 'financial_advice';
        try {
          const results = await cogneeTools.search(query, dataset, 'RAG_COMPLETION', sessionId);
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Cognee search unavailable' };
        }
      },
    );

    return tools;
  }

  buildPrompt(input: FinancialPlannerInput): string {
    const parts = [
      `Analyze the financial data for user ${input.userId}, financial year ${input.financialYear}.`,
      `Risk profile: ${input.riskProfile ?? 'balanced'}.`,
      input.goals && input.goals.length > 0 ? `Goals: ${input.goals.join(', ')}.` : '',
      input.debts && input.debts.length > 0 ? `Debts: ${JSON.stringify(input.debts)}.` : '',
      `Transactions (${input.transactions.length} total):`,
      JSON.stringify(input.transactions.slice(0, 200), null, 2),
    ].filter(Boolean);

    return parts.join('\n\n');
  }

  protected override buildFallbackOutput(
    _input: FinancialPlannerInput,
    _error: unknown,
  ): FinancialPlannerOutput {
    return {
      spendingAnalysis: {
        totalIncomeCents: 0,
        totalExpensesCents: 0,
        savingsRatePercent: 0,
        topCategories: [],
      },
      budgetRecommendation: {
        needs: 50,
        wants: 30,
        savings: 20,
        monthlyTargets: [],
      },
      wealthProjection: [],
      recommendations: ['Financial analysis unavailable — Vercel agent execution failed.'],
      summary: 'Fallback: Vercel financial planner agent execution failed.',
    };
  }
}
