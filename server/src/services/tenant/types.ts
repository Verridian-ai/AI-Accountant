/**
 * Tenant System Type Definitions
 * Types for multi-tenant management: tenants, members, invitations, context, and subscriptions.
 */

// ============================================================================
// ROLES
// ============================================================================

export type TenantRole = 'owner' | 'admin' | 'accountant' | 'bookkeeper' | 'viewer';

export const TENANT_ROLES: TenantRole[] = ['owner', 'admin', 'accountant', 'bookkeeper', 'viewer'];

// ============================================================================
// TENANT
// ============================================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  primaryContactEmail?: string;
  abn?: string;
  entityType?: string;
  industry?: string;
  financialYearEnd: string;
  timezone: string;
  settingsJson: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantOptions {
  abn?: string;
  entityType?: string;
  industry?: string;
  financialYearEnd?: string;
  timezone?: string;
  primaryContactEmail?: string;
  settingsJson?: Record<string, unknown>;
}

// ============================================================================
// TENANT MEMBER
// ============================================================================

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: TenantRole;
  displayName?: string;
  isPrimaryContact: boolean;
  joinedAt: string;
  lastActiveAt?: string;
}

// ============================================================================
// TENANT INVITATION
// ============================================================================

export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  role: TenantRole;
  invitedBy: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}

// ============================================================================
// SUBSCRIPTION INFO
// ============================================================================

export interface SubscriptionInfo {
  planId: string;
  planName: string;
  status: string;
  billingCycle: string;
  maxMembers: number;
  maxAccounts: number;
  maxTransactionsPerMonth: number;
  maxAiQueriesPerMonth: number;
  maxStorageMb: number;
  currentPeriodEnd: string;
  features: string[];
}

// ============================================================================
// TENANT CONTEXT
// ============================================================================

export interface TenantContext {
  tenant: Tenant;
  role: TenantRole;
  permissions: string[];
  subscription: SubscriptionInfo;
}
