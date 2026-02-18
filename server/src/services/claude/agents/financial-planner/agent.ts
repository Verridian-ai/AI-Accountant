/**
 * Financial Planner Agent
 *
 * Australian financial planning advisor using Claude. Analyzes spending
 * patterns, projects wealth growth, compares debt strategies, and
 * generates personalized budgets. Supports 4 risk profiles.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../../base-agent.js';
import type { FinancialPlannerInput, FinancialPlannerOutput } from '../../types.js';
import { financialPlannerTools } from './tools.js';
import { buildFinancialPlannerHandlers } from './handlers.js';

export class FinancialPlannerAgent extends ClaudeAgent<
  FinancialPlannerInput,
  FinancialPlannerOutput
> {
  protected systemPrompt = `You are an Australian financial planning advisor AI agent. Your role is to:

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

  protected tools: Anthropic.Tool[] = financialPlannerTools;

  protected toolHandlers = buildFinancialPlannerHandlers();

  constructor() {
    super('financial_planner');
  }
}
