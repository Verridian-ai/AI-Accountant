export interface AIModelResponse {
  content: string;
  usage?: number;
}

export interface VisionParseResult {
  transactions: Array<{
    date: string;
    description: string;
    amount_cents: number;
    balance_cents?: number;
  }>;
}

export type VisionModel = 'gpt-5.2-vision' | 'gemini-3.0-pro';
export type ReasoningModel = 'o1' | 'o3-mini' | 'gemini-3.0-thinking';

export interface DebtStrategy {
  totalMonths: number;
  totalInterestCents: number;
  totalPaidCents: number;
  monthlyPayments: Array<{ account_id: string; payment_cents: number }>;
  monthlyBreakdown: Array<{
    month: number;
    balances: Record<string, number>;
    interest_paid: number;
  }>;
}
