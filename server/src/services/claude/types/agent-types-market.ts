/**
 * Claude Agent Framework — Market & Tax Strategy Agent I/O Types
 *
 * Extracted from agent-types.ts: MarketIntelligence and TaxStrategy input types.
 */

// Market Intelligence Agent I/O
export interface MarketIntelInput {
  query: string;
  context?: {
    userPortfolio?: Array<{ asset: string; type: string; value: number }>;
    businessType?: string;
    interestRateExposure?: { variableDebt: number; fixedDebt: number };
    timeHorizon?: 'short_term' | 'medium_term' | 'long_term';
  };
}

export interface MarketIntelOutput {
  briefing: string;
  keyIndicators: Array<{
    name: string;
    value: number;
    unit: string;
    trend: 'up' | 'down' | 'stable';
    significance: string;
  }>;
  marketSentiment: {
    overall: string;
    score: number;
    drivers: string[];
  };
  recommendations: Array<{
    action: string;
    rationale: string;
    urgency: 'immediate' | 'soon' | 'monitor';
    confidence: number;
  }>;
  warnings: string[];
  disclaimer: string;
}

// 3.9 TaxStrategyAgent
export interface TaxStrategyInput {
  userId: string;
  financialYear: string;
  entityType: 'sole_trader' | 'personal' | 'company' | 'trust' | 'smsf';
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number; // cents
    category?: string;
    gstCategory?: string;
  }>;
  businessIncome?: number; // cents
  businessExpenses?: number; // cents
  personalIncome?: number; // cents
}
