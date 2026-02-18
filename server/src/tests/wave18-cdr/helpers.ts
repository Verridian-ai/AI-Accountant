export const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3501';

// Helper: fetch with JSON response + status check
export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}
