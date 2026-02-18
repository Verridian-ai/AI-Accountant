const envUrl: string | undefined = import.meta.env.VITE_API_URL;
// undefined = local dev (use localhost), "" = Docker (use nginx proxy), URL = production
export const BASE_URL =
  envUrl === undefined ? 'http://localhost:3501' : envUrl === '' ? '' : envUrl;
export const API_URL = BASE_URL ? `${BASE_URL}/api` : '/api';

export const getToken = (): string | null => localStorage.getItem('token');

export const getAuthHeaders = (): HeadersInit => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
