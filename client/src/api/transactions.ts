import { API_URL, getAuthHeaders } from './client';
import {
  Transaction,
  TransactionStats,
  PendingCategorization,
  MerchantMemory,
  TransferLink,
} from './types';

export async function fetchTransactions(options?: {
  limit?: number;
  offset?: number;
  accountId?: string;
}): Promise<{ transactions: Transaction[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  if (options?.accountId) params.set('accountId', options.accountId);
  const qs = params.toString();
  const res = await fetch(`${API_URL}/transactions${qs ? `?${qs}` : ''}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

export function calculateStats(transactions: Transaction[]): TransactionStats {
  // Exclude transfers from income/expense calculations
  const nonTransfers = transactions.filter((t) => !t.isTransfer);

  const income = nonTransfers.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const expenses = nonTransfers
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const categoryBreakdown: Record<string, number> = {};
  nonTransfers.forEach((t) => {
    const cat = t.category || 'Uncategorized';
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + Math.abs(t.amount);
  });

  return {
    totalIncome: income,
    totalExpenses: expenses,
    netFlow: income - expenses,
    transactionCount: transactions.length,
    categoryBreakdown,
  };
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
  const res = await fetch(`${API_URL}/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update transaction');
}

export async function splitTransaction(
  id: string,
  splits: Array<{ category: string; amount: number; description: string; gst: boolean }>,
): Promise<void> {
  const res = await fetch(`${API_URL}/transactions/${id}/split`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ splits }),
  });
  if (!res.ok) throw new Error('Failed to split transaction');
}

export async function deleteTransaction(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/transactions/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete transaction');
}

export async function categorizeGST(
  updates: Array<{ transactionId: string; gstCategory: string; gstAmount: number }>,
): Promise<{ success: boolean; updated: number }> {
  const res = await fetch(`${API_URL}/transactions/categorize-gst`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) throw new Error('Failed to categorize GST');
  return res.json();
}

// Pending Categorizations
export async function fetchPendingCategorizations(): Promise<PendingCategorization[]> {
  const res = await fetch(`${API_URL}/pending-categorizations`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch pending categorizations');
  return res.json();
}

export async function resolveCategorization(
  id: string,
  action: 'approve' | 'reject' | 'modify',
  category?: string,
  gstApplicable?: boolean,
): Promise<void> {
  const res = await fetch(`${API_URL}/pending-categorizations/${id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ action, category, gstApplicable }),
  });
  if (!res.ok) throw new Error('Failed to resolve categorization');
}

// Merchant Memory
export async function fetchMerchantMemory(): Promise<MerchantMemory[]> {
  const res = await fetch(`${API_URL}/merchant-memory`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch merchant memory');
  return res.json();
}

export async function updateMerchantMemory(
  id: string,
  updates: Partial<MerchantMemory>,
): Promise<void> {
  const res = await fetch(`${API_URL}/merchant-memory/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update merchant memory');
}

export async function deleteMerchantMemory(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/merchant-memory/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete merchant memory');
}

// Transfer Links
export async function fetchTransfers(): Promise<TransferLink[]> {
  const res = await fetch(`${API_URL}/transfers`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch transfers');
  return res.json();
}

export async function createTransferLink(
  sourceTransactionId: string,
  destinationTransactionId: string,
): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ sourceTransactionId, destinationTransactionId }),
  });
  if (!res.ok) throw new Error('Failed to create transfer link');
  return res.json();
}

export async function deleteTransferLink(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/transfers/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete transfer link');
}
