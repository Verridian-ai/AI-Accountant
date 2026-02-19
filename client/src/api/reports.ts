import { API_URL, getAuthHeaders } from './client';
import { ConsolidatedReport } from './types';

export async function fetchConsolidatedReport(period: string): Promise<ConsolidatedReport> {
  const res = await fetch(`${API_URL}/reports/consolidated/${period}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch consolidated report');
  return res.json();
}

export const reportsApi = {
  fetchPnL: async (start: string, end: string, accountId?: string) => {
    const params = new URLSearchParams({ start, end });
    if (accountId) params.set('accountId', accountId);
    const res = await fetch(`${API_URL}/reports/pnl?${params}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch P&L report');
    return res.json();
  },

  fetchBalanceSheet: async (asAt: string) => {
    const params = new URLSearchParams({ asAt });
    const res = await fetch(`${API_URL}/reports/balance-sheet?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch balance sheet');
    return res.json();
  },

  fetchCashFlow: async (start: string, end: string) => {
    const params = new URLSearchParams({ start, end });
    const res = await fetch(`${API_URL}/reports/cash-flow?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch cash flow');
    return res.json();
  },

  fetchTrialBalance: async (asAt: string) => {
    const params = new URLSearchParams({ asAt });
    const res = await fetch(`${API_URL}/reports/trial-balance?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch trial balance');
    return res.json();
  },

  fetchKPIs: async (period: string) => {
    const res = await fetch(`${API_URL}/reports/kpis?period=${encodeURIComponent(period)}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch KPIs');
    return res.json();
  },

  comparePeriods: async (
    currentStart: string,
    currentEnd: string,
    priorStart: string,
    priorEnd: string,
    type: string = 'profit_and_loss',
  ) => {
    const params = new URLSearchParams({ currentStart, currentEnd, priorStart, priorEnd, type });
    const res = await fetch(`${API_URL}/reports/compare?${params}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to compare periods');
    return res.json();
  },
};
