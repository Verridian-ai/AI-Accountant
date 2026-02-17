import { API_URL, getAuthHeaders } from './client';
import { UserSettings } from './types';

export async function fetchSettings(): Promise<UserSettings> {
  const res = await fetch(`${API_URL}/settings`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings: UserSettings): Promise<void> {
  const res = await fetch(`${API_URL}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
}
