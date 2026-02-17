/**
 * Tenant Service — Helpers and row converters
 */

import type {
  Tenant,
  TenantMember,
  TenantInvitation,
  TenantRole,
  SubscriptionInfo,
} from '../tenant-types.js';

/** 7 days in milliseconds */
export const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/** Default free subscription info when no subscription exists */
export const DEFAULT_SUBSCRIPTION: SubscriptionInfo = {
  planId: 'free',
  planName: 'Free',
  status: 'active',
  billingCycle: 'monthly',
  maxMembers: 3,
  maxAccounts: 2,
  maxTransactionsPerMonth: 500,
  maxAiQueriesPerMonth: 50,
  maxStorageMb: 100,
  currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  features: [],
};

/** Safely parse JSON with fallback to empty object */
export function parseJson(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/** Parse a JSON array safely */
export function parseJsonArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Convert a raw DB row into a typed Tenant object */
export function rowToTenant(row: any): Tenant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logoUrl ?? row.logo_url ?? undefined,
    primaryContactEmail: row.primaryContactEmail ?? row.primary_contact_email ?? undefined,
    abn: row.abn ?? undefined,
    entityType: row.entityType ?? row.entity_type ?? undefined,
    industry: row.industry ?? undefined,
    financialYearEnd: row.financialYearEnd ?? row.financial_year_end ?? '06-30',
    timezone: row.timezone ?? 'Australia/Sydney',
    settingsJson: parseJson(row.settingsJson ?? row.settings_json),
    isActive: Boolean(row.isActive ?? row.is_active ?? true),
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
  };
}

/** Convert a raw DB row into a typed TenantMember object */
export function rowToMember(row: any): TenantMember {
  return {
    id: row.id,
    tenantId: row.tenantId ?? row.tenant_id,
    userId: row.userId ?? row.user_id,
    role: (row.role ?? 'viewer') as TenantRole,
    displayName: row.displayName ?? row.display_name ?? undefined,
    isPrimaryContact: Boolean(row.isPrimaryContact ?? row.is_primary_contact ?? false),
    joinedAt: row.joinedAt ?? row.joined_at ?? new Date().toISOString(),
    lastActiveAt: row.lastActiveAt ?? row.last_active_at ?? undefined,
  };
}

/** Convert a raw DB row into a typed TenantInvitation object */
export function rowToInvitation(row: any): TenantInvitation {
  return {
    id: row.id,
    tenantId: row.tenantId ?? row.tenant_id,
    email: row.email,
    role: (row.role ?? 'viewer') as TenantRole,
    invitedBy: row.invitedBy ?? row.invited_by,
    token: row.token,
    status: row.status ?? 'pending',
    expiresAt: row.expiresAt ?? row.expires_at,
    acceptedAt: row.acceptedAt ?? row.accepted_at ?? undefined,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
  };
}
