import { API_URL, getAuthHeaders } from './client';
import {
  BASQuarter,
  BASCalculation,
  TaxCalculationResult,
  TaxBracket,
  Deduction,
  CGTAsset,
  CGTEvent,
  DepreciableAsset,
  TaxSummary,
} from './types';

export interface AvailableQuarter {
  financialYear: string;
  quarter: number;
}

export const basApi = {
  fetchQuarters: async (): Promise<AvailableQuarter[]> => {
    const res = await fetch(`${API_URL}/bas/quarters`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch quarters');
    return res.json();
  },

  calculateBAS: async (
    quarter: string,
    method: 'accrual' | 'cash' = 'accrual',
  ): Promise<BASCalculation> => {
    const res = await fetch(`${API_URL}/bas/${quarter}/calculate?method=${method}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to calculate BAS');
    return res.json();
  },

  saveBAS: async (
    quarter: string,
    data: Partial<BASCalculation>,
  ): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/bas/${quarter}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save BAS');
    return res.json();
  },

  fetchHistory: async (): Promise<BASQuarter[]> => {
    const res = await fetch(`${API_URL}/bas/history`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch BAS history');
    return res.json();
  },

  fetchTaxCodes: async (): Promise<Array<{ code: string; description: string; rate: number }>> => {
    const res = await fetch(`${API_URL}/bas/tax-codes`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch tax codes');
    return res.json();
  },

  categorizeGST: async (
    updates: Array<{ transactionId: string; gstCategory: string; gstAmount: number }>,
  ): Promise<{ success: boolean; updated: number }> => {
    const res = await fetch(`${API_URL}/transactions/categorize-gst`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ updates }),
    });
    if (!res.ok) throw new Error('Failed to categorize GST');
    return res.json();
  },
};

export const taxApi = {
  calculateTax: async (
    year: string,
    grossIncome: number,
    entityType: string = 'individual',
    hasPrivateHealth: boolean = false,
  ): Promise<TaxCalculationResult> => {
    const params = new URLSearchParams({
      grossIncome: grossIncome.toString(),
      entityType,
      hasPrivateHealth: hasPrivateHealth.toString(),
    });
    const res = await fetch(`${API_URL}/tax/calculate/${year}?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to calculate tax');
    return res.json();
  },

  fetchBrackets: async (year: string): Promise<TaxBracket[]> => {
    const res = await fetch(`${API_URL}/tax/brackets/${year}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch tax brackets');
    return res.json();
  },

  fetchDeductions: async (year: string): Promise<Deduction[]> => {
    const res = await fetch(`${API_URL}/tax/deductions/${year}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch deductions');
    return res.json();
  },

  addDeduction: async (
    data: Omit<Deduction, 'id' | 'userId' | 'createdAt'>,
  ): Promise<{ id: string; success: boolean }> => {
    const res = await fetch(`${API_URL}/tax/deductions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add deduction');
    return res.json();
  },

  fetchCGTAssets: async (): Promise<CGTAsset[]> => {
    const res = await fetch(`${API_URL}/tax/assets`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch CGT assets');
    return res.json();
  },

  addCGTAsset: async (
    data: Omit<CGTAsset, 'id' | 'userId' | 'isDisposed' | 'createdAt'>,
  ): Promise<{ id: string; success: boolean }> => {
    const res = await fetch(`${API_URL}/tax/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add CGT asset');
    return res.json();
  },

  fetchCGTEvents: async (taxYear?: string): Promise<CGTEvent[]> => {
    const url = taxYear ? `${API_URL}/tax/cgt?taxYear=${taxYear}` : `${API_URL}/tax/cgt`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch CGT events');
    return res.json();
  },

  recordDisposal: async (data: {
    assetId: string;
    acquisitionDate: string;
    acquisitionCostCents: number;
    disposalDate: string;
    disposalProceedsCents: number;
    disposalCostsCents?: number;
    quantityDisposed?: number;
    carriedForwardLossesCents?: number;
  }): Promise<CGTEvent> => {
    const res = await fetch(`${API_URL}/tax/cgt/disposal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to record disposal');
    return res.json();
  },

  fetchDepreciableAssets: async (): Promise<DepreciableAsset[]> => {
    const res = await fetch(`${API_URL}/tax/depreciation/assets`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch depreciable assets');
    return res.json();
  },

  addDepreciableAsset: async (
    data: Omit<DepreciableAsset, 'id' | 'userId' | 'currentValueCents' | 'isActive' | 'createdAt'>,
  ): Promise<{ id: string; success: boolean }> => {
    const res = await fetch(`${API_URL}/tax/depreciation/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add depreciable asset');
    return res.json();
  },

  calculateDepreciation: async (assetId: string): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_URL}/tax/depreciation/calculate/${assetId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to calculate depreciation');
    return res.json();
  },

  fetchTaxSummary: async (year: string): Promise<TaxSummary> => {
    const res = await fetch(`${API_URL}/tax/summary/${year}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch tax summary');
    return res.json();
  },

  // TODO: server endpoint doesn't exist yet — POST /api/tax/company-return
  fetchCompanyReturn: async (_year: number): Promise<Record<string, unknown>> =>
    Promise.resolve({}),

  // TODO: server endpoint doesn't exist yet — POST /api/tax/personal-return
  fetchPersonalReturn: async (_year: number): Promise<Record<string, unknown>> =>
    Promise.resolve({}),

  // TODO: server endpoint doesn't exist yet — POST /api/tax/sole-trader-return
  fetchSoleTraderReturn: async (_year: number): Promise<Record<string, unknown>> =>
    Promise.resolve({}),

  // TODO: server endpoint doesn't exist yet — POST /api/tax/trust-return
  fetchTrustReturn: async (_year: number): Promise<Record<string, unknown>> => Promise.resolve({}),

  // TODO: server endpoint doesn't exist yet — GET /api/tax/strategies
  fetchStrategies: async (_year: number): Promise<Record<string, unknown>[]> => Promise.resolve([]),

  // TODO: server endpoint doesn't exist yet — POST /api/tax/strategies/generate
  generateStrategies: async (_params: {
    year: number;
    income: number;
  }): Promise<Record<string, unknown>> => Promise.resolve({}),

  // TODO: server endpoint doesn't exist yet — PATCH /api/tax/strategies/:id/status
  updateStrategyStatus: async (_id: string, _status: string): Promise<Record<string, unknown>> =>
    Promise.resolve({}),

  // TODO: server endpoint doesn't exist yet — POST /api/tax/equity/scan
  scanEquity: async (): Promise<Record<string, unknown>> => Promise.resolve({}),

  // TODO: server endpoint doesn't exist yet — POST /api/tax/equity/:id/confirm
  confirmEquityEvent: async (_id: string): Promise<Record<string, unknown>> => Promise.resolve({}),

  // TODO: server endpoint doesn't exist yet — GET /api/tax/equity/summary
  fetchEquitySummary: async (_year: number): Promise<Record<string, unknown>> =>
    Promise.resolve({}),
};

export const gstApi = {
  fetchReviewQueue: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/gst/review-queue`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch GST review queue');
    return res.json();
  },

  approveClassification: async (id: number, gstCategory: string): Promise<void> => {
    const res = await fetch(`${API_URL}/gst/classify/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ gstCategory }),
    });
    if (!res.ok) throw new Error('Failed to approve GST classification');
  },

  bulkApprove: async (ids: number[]): Promise<void> => {
    const res = await fetch(`${API_URL}/gst/bulk-approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error('Failed to bulk approve GST');
  },

  fetchSummary: async (period: string): Promise<any> => {
    const res = await fetch(`${API_URL}/gst/summary?period=${encodeURIComponent(period)}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch GST summary');
    return res.json();
  },

  fetchBASCalculation: async (quarter: string, method?: string): Promise<any> => {
    const params = new URLSearchParams({ quarter });
    if (method) params.set('method', method);
    const res = await fetch(`${API_URL}/bas/calculate?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch BAS calculation');
    return res.json();
  },

  saveBASdraft: async (quarter: string, data: any): Promise<void> => {
    const res = await fetch(`${API_URL}/bas/${quarter}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save BAS draft');
  },

  updateBASStatus: async (quarter: string, status: string): Promise<void> => {
    const res = await fetch(`${API_URL}/bas/${quarter}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update BAS status');
  },

  fetchBASComparison: async (q1: string, q2: string): Promise<any> => {
    const res = await fetch(
      `${API_URL}/bas/compare?q1=${encodeURIComponent(q1)}&q2=${encodeURIComponent(q2)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to fetch BAS comparison');
    return res.json();
  },

  fetchBASDrillDown: async (quarter: string, label: string): Promise<any[]> => {
    const res = await fetch(`${API_URL}/bas/${quarter}/drill-down/${label}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch BAS drill-down');
    return res.json();
  },

  fetchInputTaxCredits: async (period: string): Promise<any[]> => {
    const res = await fetch(
      `${API_URL}/gst/input-tax-credits?period=${encodeURIComponent(period)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) throw new Error('Failed to fetch input tax credits');
    return res.json();
  },
};
