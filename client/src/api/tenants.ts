import { API_URL } from './client';

function getTenantHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const tenantId = localStorage.getItem('tenantId');
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  return headers;
}

const tenantFetch = async (path: string, options?: RequestInit) => {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...getTenantHeaders(), ...((options?.headers as Record<string, string>) ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Request failed: ${res.status}` }));
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
};

export const tenantApi = {
  // ── Tenant CRUD ──
  createTenant: (data: {
    name: string;
    slug: string;
    abn?: string;
    entityType: string;
    planId?: string;
  }) => tenantFetch('/tenants', { method: 'POST', body: JSON.stringify(data) }),

  getTenant: (tenantId: string) => tenantFetch(`/tenants/${tenantId}`),

  updateTenant: (tenantId: string, data: Record<string, unknown>) =>
    tenantFetch(`/tenants/${tenantId}`, { method: 'PUT', body: JSON.stringify(data) }),

  deactivateTenant: (tenantId: string) => tenantFetch(`/tenants/${tenantId}`, { method: 'DELETE' }),

  listMyTenants: () => tenantFetch('/tenants'),

  switchTenant: (tenantId: string): Promise<{ token: string }> =>
    tenantFetch(`/tenants/${tenantId}/switch`, { method: 'POST' }),

  // ── Members ──
  listMembers: (tenantId: string) => tenantFetch(`/tenants/${tenantId}/members`),

  inviteMember: (tenantId: string, email: string, role: string) =>
    tenantFetch(`/tenants/${tenantId}/members/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),

  updateMemberRole: (tenantId: string, memberId: string, role: string) =>
    tenantFetch(`/tenants/${tenantId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  removeMember: (tenantId: string, memberId: string) =>
    tenantFetch(`/tenants/${tenantId}/members/${memberId}`, { method: 'DELETE' }),

  // ── Invitations ──
  listInvitations: (tenantId: string) => tenantFetch(`/tenants/${tenantId}/invitations`),

  acceptInvitation: (token: string) =>
    tenantFetch(`/tenants/invitations/${token}/accept`, { method: 'POST' }),

  revokeInvitation: (tenantId: string, invitationId: string) =>
    tenantFetch(`/tenants/${tenantId}/invitations/${invitationId}`, { method: 'DELETE' }),

  // ── Permissions ──
  getPermissions: (tenantId: string) => tenantFetch(`/tenants/${tenantId}/permissions`),

  updatePermissions: (tenantId: string, role: string, permissions: Record<string, boolean>) =>
    tenantFetch(`/tenants/${tenantId}/permissions/${role}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    }),

  // ── Subscription ──
  getSubscription: (tenantId: string) => tenantFetch(`/tenants/${tenantId}/subscription`),

  updateSubscription: (tenantId: string, planId: string, billingCycle: string) =>
    tenantFetch(`/tenants/${tenantId}/subscription`, {
      method: 'PUT',
      body: JSON.stringify({ planId, billingCycle }),
    }),

  cancelSubscription: (tenantId: string) =>
    tenantFetch(`/tenants/${tenantId}/subscription`, { method: 'DELETE' }),

  getBillingHistory: (tenantId: string) => tenantFetch(`/tenants/${tenantId}/billing`),

  // ── Usage ──
  getUsage: (tenantId: string) => tenantFetch(`/tenants/${tenantId}/usage`),

  checkLimit: (tenantId: string, metric: string) =>
    tenantFetch(`/tenants/${tenantId}/usage/check?metric=${encodeURIComponent(metric)}`),
};
