import { API_URL, getAuthHeaders } from './client';
import { ConsolidatedReport } from './types';

export async function fetchConsolidatedReport(period: string): Promise<ConsolidatedReport> {
  const res = await fetch(`${API_URL}/reports/consolidated/${period}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch consolidated report');
  return res.json();
}

export const reportsApi: any = {
  fetchBalanceSheet: async (..._args: any[]) => Promise.resolve({} as any),
  fetchCashFlow: async (..._args: any[]) => Promise.resolve({} as any),
  fetchKPIs: async (..._args: any[]) => Promise.resolve({} as any),
  comparePeriods: async (..._args: any[]) => Promise.resolve({} as any),
  fetchPnL: async (..._args: any[]) => Promise.resolve({} as any),
  fetchTrialBalance: async (..._args: any[]) => Promise.resolve({} as any),
};
