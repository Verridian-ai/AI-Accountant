import OpenAI from 'openai';
import { logger } from '../../lib/logger.js';
import type { DebtStrategy } from './types.js';

export async function analyzeDebtPayoff(
  client: OpenAI,
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    balance: number;
    interestRate: number;
    minimumPayment: number;
  }>,
  monthlyBudget: number,
  model?: string,
): Promise<{
  aggressive: DebtStrategy;
  moderate: DebtStrategy;
  minimum: DebtStrategy;
}> {
  logger.info(`[AI Debt] Analyzing debt payoff for ${accounts.length} accounts...`);
  const modelId = model || 'google/gemini-3-flash-preview';

  const prompt = `
You are a financial advisor calculating debt payoff strategies.

ACCOUNTS WITH DEBT:
${JSON.stringify(accounts, null, 2)}

AVAILABLE MONTHLY BUDGET FOR EXTRA PAYMENTS: ${monthlyBudget} cents

Calculate three strategies:

1. AGGRESSIVE: Pay off debt as fast as possible
   - Use debt avalanche (highest interest first) or snowball (smallest balance first)
   - Put all extra budget toward debt

2. MODERATE: Balanced approach
   - Pay more than minimums but keep some savings buffer
   - 70% of extra budget to debt, 30% to savings

3. MINIMUM: Pay only minimum payments
   - Just the required minimum payments
   - Maximum time, maximum interest

For each strategy, calculate:
- Total months to pay off all debt
- Total interest paid over life of debt
- Monthly payment breakdown per account
- Month-by-month projection (first 24 months)

Return JSON:
{
  "aggressive": {
    "total_months": integer,
    "total_interest_cents": integer,
    "total_paid_cents": integer,
    "monthly_payments": [{"account_id": "...", "payment_cents": ...}],
    "monthly_breakdown": [{"month": 1, "balances": {"account_id": balance_cents}, "interest_paid": cents}]
  },
  "moderate": { same structure },
  "minimum": { same structure }
}
`;

  try {
    const response = await client.chat.completions.create({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0].message.content;
    const parsed = JSON.parse(raw || '{}') as {
      aggressive?: {
        total_months?: number;
        total_interest_cents?: number;
        total_paid_cents?: number;
        monthly_payments?: Array<{ account_id: string; payment_cents: number }>;
        monthly_breakdown?: Array<{
          month: number;
          balances: Record<string, number>;
          interest_paid: number;
        }>;
      };
      moderate?: {
        total_months?: number;
        total_interest_cents?: number;
        total_paid_cents?: number;
        monthly_payments?: Array<{ account_id: string; payment_cents: number }>;
        monthly_breakdown?: Array<{
          month: number;
          balances: Record<string, number>;
          interest_paid: number;
        }>;
      };
      minimum?: {
        total_months?: number;
        total_interest_cents?: number;
        total_paid_cents?: number;
        monthly_payments?: Array<{ account_id: string; payment_cents: number }>;
        monthly_breakdown?: Array<{
          month: number;
          balances: Record<string, number>;
          interest_paid: number;
        }>;
      };
    };

    const mapStrategy = (s: NonNullable<typeof parsed.aggressive>): DebtStrategy => ({
      totalMonths: s?.total_months || 0,
      totalInterestCents: s?.total_interest_cents || 0,
      totalPaidCents: s?.total_paid_cents || 0,
      monthlyPayments: s?.monthly_payments || [],
      monthlyBreakdown: s?.monthly_breakdown || [],
    });

    return {
      aggressive: mapStrategy(parsed.aggressive ?? {}),
      moderate: mapStrategy(parsed.moderate ?? {}),
      minimum: mapStrategy(parsed.minimum ?? {}),
    };
  } catch (err) {
    logger.error({ err: err }, '[AI Debt Error]');
    const empty: DebtStrategy = {
      totalMonths: 0,
      totalInterestCents: 0,
      totalPaidCents: 0,
      monthlyPayments: [],
      monthlyBreakdown: [],
    };
    return { aggressive: empty, moderate: empty, minimum: empty };
  }
}
