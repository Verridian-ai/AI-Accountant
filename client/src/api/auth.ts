import { BASE_URL, getAuthHeaders } from './client';

export interface LoginResponse {
  token: string;
  user: { id: string; username: string };
  tenants?: unknown[];
  activeTenant?: { tenantId?: string; id?: string } | null;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(error.error || 'Login failed');
  }
  return res.json();
}

export async function register(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Registration failed' }));
    throw new Error(error.error || 'Registration failed');
  }
  return res.json();
}

export async function getCurrentUser(): Promise<{ id: string; username: string }> {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch user');
  const data = await res.json();
  return data.user;
}
