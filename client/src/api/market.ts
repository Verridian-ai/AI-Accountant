import { API_URL, getAuthHeaders } from './client';
import { SupportedBank, Transaction, Account, ConsolidatedReport } from './types';

export const multiBankApi = {
  fetchSupportedBanks: async (): Promise<SupportedBank[]> => {
    const res = await fetch(`${API_URL}/banks`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch supported banks');
    return res.json();
  },

  detectBank: async (
    pdfText: string,
  ): Promise<{
    detections: Array<{ bankId: string; bankName: string; confidence: number }>;
    bestMatch: { bankId: string; bankName: string; confidence: number } | null;
    confidence: 'high' | 'medium' | 'low' | 'none';
    recommendedAction: string;
  }> => {
    const res = await fetch(`${API_URL}/statements/detect-bank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ pdfText }),
    });
    if (!res.ok) throw new Error('Failed to detect bank');
    return res.json();
  },

  fetchConsolidatedSummary: async (): Promise<{
    accounts: Array<
      Account & {
        transactionCount: number;
        totalIncome: number;
        totalExpenses: number;
        netFlow: number;
      }
    >;
    totals: {
      totalAccounts: number;
      totalTransactions: number;
      totalIncome: number;
      totalExpenses: number;
      netWorth: number;
    };
  }> => {
    const res = await fetch(`${API_URL}/accounts/consolidated`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch consolidated summary');
    return res.json();
  },

  autoDetectTransfers: async (): Promise<{
    matchesFound: number;
    matches: Array<{
      sourceTransaction: Transaction;
      targetTransaction: Transaction;
      confidence: number;
      reasons: string[];
    }>;
  }> => {
    const res = await fetch(`${API_URL}/transfers/auto-detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Failed to auto-detect transfers');
    return res.json();
  },

  bulkLinkTransfers: async (
    pairs: Array<{
      sourceTransactionId: string;
      destinationTransactionId: string;
      confidence?: number;
    }>,
  ): Promise<{ success: boolean; created: number; linkIds: string[] }> => {
    const res = await fetch(`${API_URL}/transfers/bulk-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ pairs }),
    });
    if (!res.ok) throw new Error('Failed to bulk link transfers');
    return res.json();
  },

  fetchConsolidatedReport: async (period: string): Promise<ConsolidatedReport> => {
    const res = await fetch(`${API_URL}/reports/consolidated/${period}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch consolidated report');
    return res.json();
  },
};

const marketFetch = async (path: string, options?: RequestInit) => {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...((options?.headers as Record<string, string>) ?? {}) },
  });
  if (!res.ok) throw new Error(`Market API error: ${res.status}`);
  return res.json();
};

export const fetchEconomicSnapshot = () => marketFetch('/market/indicators/snapshot');

export const fetchIndicators = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return marketFetch(`/market/indicators${qs}`);
};

export const fetchIndicatorHistory = (code: string, months = 24) =>
  marketFetch(`/market/indicators/${code}/history?months=${months}`);

export const fetchCashRate = () => marketFetch('/market/indicators/cash-rate');

export const fetchCPI = () => marketFetch('/market/indicators/cpi');

export const fetchMarketPrices = (type?: string) =>
  marketFetch(`/market/prices${type ? `?type=${type}` : ''}`);

export const fetchPriceHistory = (symbol: string, days = 30) =>
  marketFetch(`/market/prices/${encodeURIComponent(symbol)}/history?days=${days}`);

export const searchSymbol = (query: string) =>
  marketFetch(`/market/prices/search/${encodeURIComponent(query)}`);

export const refreshMarketPrices = () => marketFetch('/market/prices/refresh', { method: 'POST' });

export const fetchSentiment = (topic: string) =>
  marketFetch(`/market/sentiment/${encodeURIComponent(topic)}`);

export const fetchBatchSentiment = (topics: string[]) =>
  marketFetch('/market/sentiment/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topics }),
  });

export const fetchSentimentHistory = (topic: string, days = 30) =>
  marketFetch(`/market/sentiment/${encodeURIComponent(topic)}/history?days=${days}`);

export const analyzeMarketImpact = (event: string, context?: string) =>
  marketFetch('/market/sentiment/impact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, context }),
  });

export const fetchEconomicCalendar = (from?: string, to?: string, importance?: string) => {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (importance) params.set('importance', importance);
  return marketFetch(`/market/calendar?${params.toString()}`);
};

export const createCalendarEvent = (event: Record<string, unknown>) =>
  marketFetch('/market/calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });

export const fetchMarketAlerts = (userId = 'default') =>
  marketFetch(`/market/alerts?userId=${userId}`);

export const createMarketAlert = (alert: Record<string, unknown>) =>
  marketFetch('/market/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(alert),
  });

export const refreshAllFeeds = () => marketFetch('/market/feeds/refresh', { method: 'POST' });
export const fetchMarketRates = fetchMarketPrices;
