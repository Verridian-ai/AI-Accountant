export interface CategoryBreakdownItem {
  category: string;
  total: number;
  percentage: number;
  color: string;
  transactionCount: number;
}

export interface RecurringPayment {
  id: string;
  merchantPattern: string;
  typicalAmount: number;
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual';
  lastOccurrence: string;
  nextExpected: string;
  isActive: boolean;
  category?: string;
  annualCost: number;
  isMissed: boolean;
  amountChanged: boolean;
}

export interface SpendingTrend {
  month: string;
  categories: { [category: string]: number };
  total: number;
}

export interface Budget {
  id: string;
  category: string;
  periodType: 'monthly' | 'quarterly' | 'annual';
  periodStart: string;
  amountCents: number;
  actualCents: number;
  variance: number;
  utilizationPercent: number;
}

export interface Anomaly {
  id: string;
  transactionId?: number;
  type: 'amount' | 'frequency' | 'duplicate' | 'new_merchant' | 'round_number' | 'time';
  severity: 'info' | 'warning' | 'critical';
  description: string;
  isDismissed: boolean;
  createdAt: string;
}

export interface CashFlowForecast {
  month: string;
  projectedBalance: number;
  confidence: number;
  upperBound: number;
  lowerBound: number;
}
