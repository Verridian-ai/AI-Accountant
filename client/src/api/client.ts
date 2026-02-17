const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3501';
export const API_URL = `${BASE_URL}/api`;

export const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};
