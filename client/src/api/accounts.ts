import { API_URL, getAuthHeaders } from './client';
import {
  Account,
  CreateAccountRequest,
  BalanceHistoryEntry,
  CreditCardAnalytics,
  DebtRecommendations,
  ReconciliationAlert,
} from './types';

export async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch(`${API_URL}/accounts`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch accounts');
  return res.json();
}

export async function createAccount(
  data: CreateAccountRequest,
): Promise<{ id: string; accountNumber: string }> {
  const res = await fetch(`${API_URL}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to create account' }));
    throw new Error(error.error || 'Failed to create account');
  }
  return res.json();
}

export async function updateAccount(id: string, updates: Partial<Account>): Promise<void> {
  const res = await fetch(`${API_URL}/accounts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update account');
}

export async function fetchBalanceHistory(accountId: string): Promise<BalanceHistoryEntry[]> {
  const res = await fetch(`${API_URL}/accounts/${accountId}/balance-history`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch balance history');
  return res.json();
}

export async function fetchCreditCardAnalytics(accountId: string): Promise<CreditCardAnalytics> {
  const res = await fetch(`${API_URL}/accounts/${accountId}/credit-analytics`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch credit card analytics');
  return res.json();
}

export async function fetchDebtRecommendations(
  monthlyBudget: number,
): Promise<DebtRecommendations> {
  const res = await fetch(`${API_URL}/debt-recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ monthlyBudget }),
  });
  if (!res.ok) throw new Error('Failed to fetch debt recommendations');
  return res.json();
}

export async function fetchReconciliationAlerts(
  showResolved = false,
): Promise<ReconciliationAlert[]> {
  const res = await fetch(`${API_URL}/reconciliation-alerts?showResolved=${showResolved}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch reconciliation alerts');
  return res.json();
}

export async function resolveReconciliationAlert(id: string, notes?: string): Promise<void> {
  const res = await fetch(`${API_URL}/reconciliation-alerts/${id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error('Failed to resolve alert');
}
