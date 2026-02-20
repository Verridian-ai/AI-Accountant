import { API_URL, getAuthHeaders } from './client';

// ─── Response types (mirroring server route return shapes) ───────────────────

export interface TransferMatch {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  transferDate: string;
  confidence: number;
  isUserConfirmed: boolean;
}

export interface MoneyFlowEntry {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  transferDate: string;
}

export interface NetPosition {
  accountAId: string;
  accountBId: string;
  netAmount: number;
  transferCount: number;
}

export interface CategoryBreakdownItem {
  name: string;
  value: number;
}

export interface SpendingTrendEntry {
  month: string;
  categories: Record<string, number>;
  total: number;
}

export interface RecurringPayment {
  id: string;
  merchantPattern: string;
  typicalAmount: number;
  frequency: 'weekly' | 'fortnightly' | 'monthly';
}

export interface BudgetVsActualItem {
  id: string;
  category: string;
  actualCents: number;
}

export interface AnomalyAlert {
  id: string;
  userId: string;
  detectorType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  title: string;
  description: string;
  transactionId: string | null;
  detectedAt: string;
  resolvedAt: string | null;
}

export interface CashFlowForecast {
  id: string;
  userId: string;
  forecastType: 'linear' | 'seasonal' | 'ml_weighted';
  startDate: string;
  endDate: string;
  granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  status: string;
  createdAt: string;
}

// ─── API client ──────────────────────────────────────────────────────────────

export const analyticsApi = {
  // Transfer matching endpoints
  fetchTransferMatches: async (): Promise<TransferMatch[]> => {
    const res = await fetch(`${API_URL}/transfers/matches`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch transfer matches');
    return res.json();
  },

  confirmTransfer: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/transfers/matches/${id}/confirm`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to confirm transfer');
  },

  rejectTransfer: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/transfers/matches/${id}/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to reject transfer');
  },

  fetchMoneyFlow: async (period: string): Promise<MoneyFlowEntry[]> => {
    const res = await fetch(`${API_URL}/transfers/flow/${encodeURIComponent(period)}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch money flow');
    return res.json();
  },

  fetchNetPosition: async (
    accountAId: number,
    accountBId: number,
    dateRange?: { start: string; end: string },
  ): Promise<NetPosition> => {
    const params = new URLSearchParams({
      accountA: accountAId.toString(),
      accountB: accountBId.toString(),
    });
    if (dateRange) {
      params.set('start', dateRange.start);
      params.set('end', dateRange.end);
    }
    const res = await fetch(`${API_URL}/transfers/net-position?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch net position');
    return res.json();
  },

  // Analytics endpoints
  fetchCategoryBreakdown: async (period: string): Promise<CategoryBreakdownItem[]> => {
    const res = await fetch(
      `${API_URL}/analytics/category-breakdown?period=${encodeURIComponent(period)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to fetch category breakdown');
    const data = (await res.json()) as { categories: CategoryBreakdownItem[]; total: number };
    return data.categories;
  },

  fetchRecurringPayments: async (): Promise<RecurringPayment[]> => {
    const res = await fetch(`${API_URL}/analytics/recurring-payments`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch recurring payments');
    return res.json();
  },

  fetchSpendingTrends: async (months: number): Promise<SpendingTrendEntry[]> => {
    const res = await fetch(`${API_URL}/analytics/spending-trends?months=${months}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch spending trends');
    return res.json();
  },

  fetchBudgets: async (period: string): Promise<BudgetVsActualItem[]> => {
    const res = await fetch(`${API_URL}/analytics/budgets?period=${encodeURIComponent(period)}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch budgets');
    return res.json();
  },

  saveBudget: async (budget: Record<string, unknown>): Promise<void> => {
    const res = await fetch(`${API_URL}/analytics/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(budget),
    });
    if (!res.ok) throw new Error('Failed to save budget');
  },

  fetchBudgetVsActual: async (period: string): Promise<BudgetVsActualItem[]> => {
    const res = await fetch(
      `${API_URL}/analytics/budget-vs-actual?period=${encodeURIComponent(period)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to fetch budget vs actual');
    return res.json();
  },

  fetchAnomalies: async (): Promise<AnomalyAlert[]> => {
    const res = await fetch(`${API_URL}/analytics/anomalies`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch anomalies');
    const data = (await res.json()) as { data: AnomalyAlert[] };
    return data.data;
  },

  dismissAnomaly: async (id: string, reason?: string): Promise<void> => {
    const res = await fetch(`${API_URL}/analytics/anomalies/${id}/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error('Failed to dismiss anomaly');
  },

  fetchCashFlowForecast: async (months: number): Promise<CashFlowForecast[]> => {
    const res = await fetch(`${API_URL}/analytics/cash-flow-forecast?months=${months}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch cash flow forecast');
    const data = (await res.json()) as { data: CashFlowForecast[] };
    return data.data;
  },

  // TODO: server endpoint doesn't exist yet — GET /api/analytics/bill-alerts
  // The bills route only supports CRUD, not alert/due-date queries
  fetchBillAlerts: async (_params?: { days?: number }): Promise<Record<string, unknown>[]> =>
    Promise.resolve([]),

  // TODO: server endpoint doesn't exist yet — GET /api/analytics/revenue-projection
  projectRevenue: async (_params?: { months?: number }): Promise<Record<string, unknown>> =>
    Promise.resolve({}),

  // TODO: server endpoint doesn't exist yet — GET /api/analytics/expense-projection
  projectExpenses: async (_params?: { months?: number }): Promise<Record<string, unknown>> =>
    Promise.resolve({}),

  // TODO: server endpoint doesn't exist yet — GET /api/analytics/wealth-projection
  calculateWealthProjection: async (_params?: {
    years?: number;
    annualSavings?: number;
    returnRate?: number;
  }): Promise<Record<string, unknown>> => Promise.resolve({}),
};
