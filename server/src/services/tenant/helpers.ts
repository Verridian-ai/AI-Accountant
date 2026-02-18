/**
 * Tenant Service — Helpers and row converters
 */

import type {
  Tenant,
  TenantMember,
  TenantInvitation,
  TenantRole,
  SubscriptionInfo,
} from './types.js';

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
export function parseJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

/** Parse a JSON array safely */
export function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Convert a raw DB row into a typed Tenant object */
export function rowToTenant(row: Record<string, unknown>): Tenant {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    logoUrl: (row.logoUrl ?? row.logo_url) as string | undefined,
    primaryContactEmail: (row.primaryContactEmail ?? row.primary_contact_email) as
      | string
      | undefined,
    abn: row.abn as string | undefined,
    entityType: (row.entityType ?? row.entity_type) as string | undefined,
    industry: row.industry as string | undefined,
    financialYearEnd: ((row.financialYearEnd ?? row.financial_year_end) as string) ?? '06-30',
    timezone: (row.timezone as string) ?? 'Australia/Sydney',
    settingsJson: parseJson(row.settingsJson ?? row.settings_json),
    isActive: Boolean(row.isActive ?? row.is_active ?? true),
    createdAt: ((row.createdAt ?? row.created_at) as string) ?? new Date().toISOString(),
    updatedAt: ((row.updatedAt ?? row.updated_at) as string) ?? new Date().toISOString(),
  };
}

/** Convert a raw DB row into a typed TenantMember object */
export function rowToMember(row: Record<string, unknown>): TenantMember {
  return {
    id: row.id as string,
    tenantId: (row.tenantId ?? row.tenant_id) as string,
    userId: (row.userId ?? row.user_id) as string,
    role: ((row.role as string) ?? 'viewer') as TenantRole,
    displayName: (row.displayName ?? row.display_name) as string | undefined,
    isPrimaryContact: Boolean(row.isPrimaryContact ?? row.is_primary_contact ?? false),
    joinedAt: ((row.joinedAt ?? row.joined_at) as string) ?? new Date().toISOString(),
    lastActiveAt: (row.lastActiveAt ?? row.last_active_at) as string | undefined,
  };
}

/** Convert a raw DB row into a typed TenantInvitation object */
export function rowToInvitation(row: Record<string, unknown>): TenantInvitation {
  return {
    id: row.id as string,
    tenantId: (row.tenantId ?? row.tenant_id) as string,
    email: row.email as string,
    role: ((row.role as string) ?? 'viewer') as TenantRole,
    invitedBy: (row.invitedBy ?? row.invited_by) as string,
    token: row.token as string,
    status: (row.status ?? 'pending') as 'pending' | 'expired' | 'accepted' | 'revoked',
    expiresAt: (row.expiresAt ?? row.expires_at) as string,
    acceptedAt: (row.acceptedAt ?? row.accepted_at) as string | undefined,
    createdAt: ((row.createdAt ?? row.created_at) as string) ?? new Date().toISOString(),
  };
}
