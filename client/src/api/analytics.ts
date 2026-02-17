import { API_URL, getAuthHeaders } from './client';

export const analyticsApi = {
  // Transfer matching endpoints
  fetchTransferMatches: async (): Promise<any[]> => {
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

  fetchMoneyFlow: async (period: string): Promise<any[]> => {
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
  ): Promise<any> => {
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
  fetchCategoryBreakdown: async (period: string): Promise<any[]> => {
    const res = await fetch(
      `${API_URL}/analytics/category-breakdown?period=${encodeURIComponent(period)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to fetch category breakdown');
    return res.json();
  },

  fetchRecurringPayments: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/analytics/recurring-payments`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch recurring payments');
    return res.json();
  },

  fetchSpendingTrends: async (months: number): Promise<any[]> => {
    const res = await fetch(`${API_URL}/analytics/spending-trends?months=${months}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch spending trends');
    return res.json();
  },

  fetchBudgets: async (period: string): Promise<any[]> => {
    const res = await fetch(`${API_URL}/analytics/budgets?period=${encodeURIComponent(period)}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch budgets');
    return res.json();
  },

  saveBudget: async (budget: Partial<any>): Promise<void> => {
    const res = await fetch(`${API_URL}/analytics/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(budget),
    });
    if (!res.ok) throw new Error('Failed to save budget');
  },

  fetchBudgetVsActual: async (period: string): Promise<any[]> => {
    const res = await fetch(
      `${API_URL}/analytics/budget-vs-actual?period=${encodeURIComponent(period)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to fetch budget vs actual');
    return res.json();
  },

  fetchAnomalies: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/analytics/anomalies`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch anomalies');
    return res.json();
  },

  dismissAnomaly: async (id: string, reason?: string): Promise<void> => {
    const res = await fetch(`${API_URL}/analytics/anomalies/${id}/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error('Failed to dismiss anomaly');
  },

  fetchCashFlowForecast: async (months: number): Promise<any[]> => {
    const res = await fetch(`${API_URL}/analytics/cash-flow-forecast?months=${months}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch cash flow forecast');
    return res.json();
  },

  fetchBillAlerts: async (..._args: any[]) => Promise.resolve([] as any[]),
  projectRevenue: async (..._args: any[]) => Promise.resolve({} as any),
  projectExpenses: async (..._args: any[]) => Promise.resolve({} as any),
  calculateWealthProjection: async (..._args: any[]) => Promise.resolve({} as any),
};
