/**
 * Tenant Service
 * Core multi-tenant management: CRUD, members, invitations, and context switching.
 * Follows existing service patterns (BudgetService, FinancialReportService).
 */

import {
  db,
  tenants,
  tenantMembers,
  tenantInvitations,
  permissions,
  rolePermissions,
  subscriptionPlans,
  subscriptionHistory,
} from '../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import type {
  Tenant,
  TenantMember,
  TenantInvitation,
  TenantContext,
  TenantRole,
  CreateTenantOptions,
  SubscriptionInfo,
} from './tenant-types.js';
import { TENANT_ROLES } from './tenant-types.js';
import { seedDefaultPermissions } from './tenant-defaults.js';
import { rbacService } from './rbac.js';

// ============================================================================
// HELPERS
// ============================================================================

/** 7 days in milliseconds */
const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/** Default free subscription info when no subscription exists */
const DEFAULT_SUBSCRIPTION: SubscriptionInfo = {
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

/** Convert a raw DB row into a typed Tenant object */
function rowToTenant(row: Record<string, unknown>): Tenant {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    logoUrl: row.logoUrl ?? row.logo_url ? String(row.logoUrl ?? row.logo_url) : undefined,
    primaryContactEmail: row.primaryContactEmail ?? row.primary_contact_email ? String(row.primaryContactEmail ?? row.primary_contact_email) : undefined,
    abn: row.abn ? String(row.abn) : undefined,
    entityType: row.entityType ?? row.entity_type ? String(row.entityType ?? row.entity_type) : undefined,
    industry: row.industry ? String(row.industry) : undefined,
    financialYearEnd: String(row.financialYearEnd ?? row.financial_year_end ?? '06-30'),
    timezone: String(row.timezone ?? 'Australia/Sydney'),
    settingsJson: parseJson(row.settingsJson ?? row.settings_json),
    isActive: Boolean(row.isActive ?? row.is_active ?? true),
    createdAt: String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updatedAt ?? row.updated_at ?? new Date().toISOString()),
  };
}

/** Convert a raw DB row into a typed TenantMember object */
function rowToMember(row: Record<string, unknown>): TenantMember {
  return {
    id: String(row.id),
    tenantId: String(row.tenantId ?? row.tenant_id),
    userId: String(row.userId ?? row.user_id),
    role: (row.role ?? 'viewer') as TenantRole,
    displayName: row.displayName ?? row.display_name ? String(row.displayName ?? row.display_name) : undefined,
    isPrimaryContact: Boolean(row.isPrimaryContact ?? row.is_primary_contact ?? false),
    joinedAt: String(row.joinedAt ?? row.joined_at ?? new Date().toISOString()),
    lastActiveAt: row.lastActiveAt ?? row.last_active_at ? String(row.lastActiveAt ?? row.last_active_at) : undefined,
  };
}

/** Convert a raw DB row into a typed TenantInvitation object */
function rowToInvitation(row: Record<string, unknown>): TenantInvitation {
  return {
    id: String(row.id),
    tenantId: String(row.tenantId ?? row.tenant_id),
    email: String(row.email),
    role: (row.role ?? 'viewer') as TenantRole,
    invitedBy: String(row.invitedBy ?? row.invited_by),
    token: String(row.token),
    status: String(row.status ?? 'pending') as 'pending' | 'accepted' | 'expired' | 'revoked',
    expiresAt: String(row.expiresAt ?? row.expires_at),
    acceptedAt: row.acceptedAt ?? row.accepted_at ? String(row.acceptedAt ?? row.accepted_at) : undefined,
    createdAt: String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
  };
}

/** Safely parse JSON with fallback to empty object */
function parseJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}

// ============================================================================
// TENANT SERVICE
// ============================================================================

export class TenantService {
  // --------------------------------------------------------------------------
  // TENANT CRUD
  // --------------------------------------------------------------------------

  /**
   * Create a new tenant with default role-permissions and an owner member.
   * @param name - Display name for the tenant/organization
   * @param slug - URL-safe identifier (must be unique)
   * @param ownerId - User ID of the tenant creator (becomes owner)
   * @param options - Additional optional fields (ABN, entity type, etc.)
   */
  async createTenant(
    name: string,
    slug: string,
    ownerId: string,
    options: CreateTenantOptions = {},
  ): Promise<Tenant> {
    const now = new Date().toISOString();
    const tenantId = crypto.randomUUID();

    // Validate slug uniqueness
    const existing = await db.select().from(tenants).where(eq(tenants.slug, slug)).get();
    if (existing) {
      throw new Error(`Tenant with slug "${slug}" already exists`);
    }

    // Insert tenant
    await db
      .insert(tenants)
      .values({
        id: tenantId,
        name,
        slug,
        abn: options.abn ?? null,
        entityType: options.entityType ?? null,
        industry: options.industry ?? null,
        financialYearEnd: options.financialYearEnd ?? '06-30',
        timezone: options.timezone ?? 'Australia/Sydney',
        primaryContactEmail: options.primaryContactEmail ?? null,
        settingsJson: JSON.stringify(options.settingsJson ?? {}),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Seed default role-permissions for this tenant
    await seedDefaultPermissions(tenantId, ownerId);

    // Create the owner as the first member
    await db
      .insert(tenantMembers)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        userId: ownerId,
        role: 'owner',
        isPrimaryContact: true,
        invitedBy: null,
        joinedAt: now,
        lastActiveAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return this.getTenant(tenantId) as Promise<Tenant>;
  }

  /**
   * Update tenant fields (partial update).
   */
  async updateTenant(
    tenantId: string,
    updates: Partial<
      Pick<
        Tenant,
        | 'name'
        | 'logoUrl'
        | 'primaryContactEmail'
        | 'abn'
        | 'entityType'
        | 'industry'
        | 'financialYearEnd'
        | 'timezone'
        | 'settingsJson'
      >
    >,
  ): Promise<Tenant> {
    const now = new Date().toISOString();
    const setValues: Record<string, any> = { updatedAt: now };

    if (updates.name !== undefined) setValues.name = updates.name;
    if (updates.logoUrl !== undefined) setValues.logoUrl = updates.logoUrl;
    if (updates.primaryContactEmail !== undefined)
      setValues.primaryContactEmail = updates.primaryContactEmail;
    if (updates.abn !== undefined) setValues.abn = updates.abn;
    if (updates.entityType !== undefined) setValues.entityType = updates.entityType;
    if (updates.industry !== undefined) setValues.industry = updates.industry;
    if (updates.financialYearEnd !== undefined)
      setValues.financialYearEnd = updates.financialYearEnd;
    if (updates.timezone !== undefined) setValues.timezone = updates.timezone;
    if (updates.settingsJson !== undefined)
      setValues.settingsJson = JSON.stringify(updates.settingsJson);

    await db.update(tenants).set(setValues).where(eq(tenants.id, tenantId)).run();

    const updated = await this.getTenant(tenantId);
    if (!updated) throw new Error(`Tenant ${tenantId} not found after update`);
    return updated;
  }

  /**
   * Get a single tenant by ID.
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    const row = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!row) return null;
    return rowToTenant(row);
  }

  /**
   * Get a tenant by its URL slug.
   */
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const row = await db.select().from(tenants).where(eq(tenants.slug, slug)).get();
    if (!row) return null;
    return rowToTenant(row);
  }

  /**
   * Soft-delete a tenant by setting is_active=false.
   */
  async deactivateTenant(tenantId: string): Promise<void> {
    await db
      .update(tenants)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, tenantId))
      .run();
  }

  // --------------------------------------------------------------------------
  // MEMBER MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Add a member to a tenant.
   * Validates role and checks subscription member limit.
   */
  async addMember(
    tenantId: string,
    userId: string,
    role: TenantRole,
    invitedBy?: string,
  ): Promise<TenantMember> {
    // Validate role
    if (!TENANT_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${role}. Must be one of: ${TENANT_ROLES.join(', ')}`);
    }

    // Check if user is already a member
    const existingMember = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .get();
    if (existingMember) {
      throw new Error('User is already a member of this tenant');
    }

    // Check subscription member limit
    const sub = await this._getSubscriptionInfo(tenantId);
    const memberCount = await this._getMemberCount(tenantId);
    if (memberCount >= sub.maxMembers) {
      throw new Error(
        `Member limit reached (${sub.maxMembers} on ${sub.planName} plan). ` +
          'Upgrade your subscription to add more members.',
      );
    }

    const now = new Date().toISOString();
    const memberId = crypto.randomUUID();

    await db
      .insert(tenantMembers)
      .values({
        id: memberId,
        tenantId,
        userId,
        role,
        isPrimaryContact: false,
        invitedBy: invitedBy ?? null,
        joinedAt: now,
        lastActiveAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const member = await db
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.id, memberId))
      .get();
    return rowToMember(member);
  }

  /**
   * Remove a member from a tenant.
   * Prevents removing the last owner.
   */
  async removeMember(tenantId: string, userId: string): Promise<void> {
    // Get the member being removed
    const member = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .get();

    if (!member) {
      throw new Error('Member not found in this tenant');
    }

    // Prevent removing the last owner
    if ((member as Record<string, unknown>).role === 'owner') {
      const ownerCount = await this._countMembersWithRole(tenantId, 'owner');
      if (ownerCount <= 1) {
        throw new Error('Cannot remove the last owner. Transfer ownership first.');
      }
    }

    await db
      .delete(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .run();

    // Invalidate RBAC cache for removed user
    rbacService.invalidateUserCache(tenantId, userId);
  }

  /**
   * Update a member's role within a tenant.
   * Prevents demoting the last owner.
   */
  async updateMemberRole(
    tenantId: string,
    userId: string,
    newRole: TenantRole,
  ): Promise<TenantMember> {
    if (!TENANT_ROLES.includes(newRole)) {
      throw new Error(`Invalid role: ${newRole}. Must be one of: ${TENANT_ROLES.join(', ')}`);
    }

    const member = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .get();

    if (!member) {
      throw new Error('Member not found in this tenant');
    }

    // Prevent demoting the last owner
    if ((member as Record<string, unknown>).role === 'owner' && newRole !== 'owner') {
      const ownerCount = await this._countMembersWithRole(tenantId, 'owner');
      if (ownerCount <= 1) {
        throw new Error('Cannot demote the last owner. Assign another owner first.');
      }
    }

    const now = new Date().toISOString();
    await db
      .update(tenantMembers)
      .set({
        role: newRole,
        updatedAt: now,
      })
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .run();

    // Invalidate RBAC cache for affected user
    rbacService.invalidateUserCache(tenantId, userId);

    const updated = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .get();
    return rowToMember(updated);
  }

  /**
   * List all members of a tenant.
   */
  async getMembers(tenantId: string): Promise<TenantMember[]> {
    const rows = await db
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.tenantId, tenantId))
      .all();
    return (rows as Array<Record<string, unknown>>).map(rowToMember);
  }

  /**
   * List all tenants a user belongs to, with their role in each.
   */
  async getMemberTenants(userId: string): Promise<Array<{ tenant: Tenant; role: TenantRole }>> {
    const memberships = await db
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.userId, userId))
      .all();

    const results: Array<{ tenant: Tenant; role: TenantRole }> = [];
    for (const m of memberships as Array<Record<string, unknown>>) {
      const tenant = await this.getTenant(String(m.tenantId ?? m.tenant_id));
      if (tenant && tenant.isActive) {
        results.push({ tenant, role: (m.role ?? 'viewer') as TenantRole });
      }
    }
    return results;
  }

  // --------------------------------------------------------------------------
  // INVITATION MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Invite a user by email to join a tenant.
   * Generates a secure token with a 7-day expiry.
   */
  async inviteMember(
    tenantId: string,
    email: string,
    role: TenantRole,
    invitedBy: string,
  ): Promise<TenantInvitation> {
    if (!TENANT_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    // Check for existing pending invitation for same email+tenant
    const existing = await db
      .select()
      .from(tenantInvitations)
      .where(
        and(
          eq(tenantInvitations.tenantId, tenantId),
          eq(tenantInvitations.email, email),
          eq(tenantInvitations.status, 'pending'),
        ),
      )
      .get();
    if (existing) {
      throw new Error(`A pending invitation already exists for ${email} in this tenant`);
    }

    // Check subscription member limit (existing members + pending invitations)
    const sub = await this._getSubscriptionInfo(tenantId);
    const memberCount = await this._getMemberCount(tenantId);
    const pendingCount = await this._getPendingInvitationCount(tenantId);
    if (memberCount + pendingCount >= sub.maxMembers) {
      throw new Error(
        `Member limit would be exceeded (${sub.maxMembers} on ${sub.planName} plan). ` +
          'Upgrade your subscription to invite more members.',
      );
    }

    const now = new Date().toISOString();
    const invitationId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS).toISOString();

    await db
      .insert(tenantInvitations)
      .values({
        id: invitationId,
        tenantId,
        email,
        role,
        invitedBy,
        token,
        status: 'pending',
        expiresAt,
        createdAt: now,
      })
      .run();

    const row = await db
      .select()
      .from(tenantInvitations)
      .where(eq(tenantInvitations.id, invitationId))
      .get();
    return rowToInvitation(row);
  }

  /**
   * Accept an invitation by its token.
   * Validates the token, checks expiry/status, creates the member.
   * @param token - The invitation token
   * @param userId - The user accepting the invitation
   */
  async acceptInvitation(
    token: string,
    userId: string,
  ): Promise<{ tenant: Tenant; member: TenantMember }> {
    const invitation = await db
      .select()
      .from(tenantInvitations)
      .where(eq(tenantInvitations.token, token))
      .get();

    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    const inv = invitation as Record<string, unknown>;
    if (inv.status !== 'pending') {
      throw new Error(`Invitation has already been ${inv.status}`);
    }

    const expiresAt = new Date(String(inv.expiresAt ?? inv.expires_at));
    if (expiresAt < new Date()) {
      // Mark as expired
      await db
        .update(tenantInvitations)
        .set({ status: 'expired' })
        .where(eq(tenantInvitations.id, String(inv.id)))
        .run();
      throw new Error('Invitation has expired');
    }

    const tenantId = String(inv.tenantId ?? inv.tenant_id);
    const role = (inv.role ?? 'viewer') as TenantRole;

    // Create the member
    const member = await this.addMember(tenantId, userId, role, String(inv.invitedBy ?? inv.invited_by));

    // Mark invitation as accepted
    const now = new Date().toISOString();
    await db
      .update(tenantInvitations)
      .set({
        status: 'accepted',
        acceptedAt: now,
      })
      .where(eq(tenantInvitations.id, String(inv.id)))
      .run();

    const tenant = await this.getTenant(tenantId);
    if (!tenant) throw new Error('Tenant not found after accepting invitation');

    return { tenant, member };
  }

  /**
   * Revoke a pending invitation.
   */
  async revokeInvitation(invitationId: string): Promise<void> {
    const invitation = await db
      .select()
      .from(tenantInvitations)
      .where(eq(tenantInvitations.id, invitationId))
      .get();

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if ((invitation as Record<string, unknown>).status !== 'pending') {
      throw new Error('Can only revoke pending invitations');
    }

    await db
      .update(tenantInvitations)
      .set({ status: 'revoked' })
      .where(eq(tenantInvitations.id, invitationId))
      .run();
  }

  /**
   * List all pending invitations for a tenant.
   */
  async getPendingInvitations(tenantId: string): Promise<TenantInvitation[]> {
    const rows = await db
      .select()
      .from(tenantInvitations)
      .where(and(eq(tenantInvitations.tenantId, tenantId), eq(tenantInvitations.status, 'pending')))
      .all();
    return (rows as Array<Record<string, unknown>>).map(rowToInvitation);
  }

  /**
   * Mark all expired invitations across all tenants.
   * Returns the number of invitations marked as expired.
   */
  async cleanupExpiredInvitations(): Promise<number> {
    const now = new Date().toISOString();

    // Fetch all pending invitations that have passed their expiry
    const expired = await db
      .select()
      .from(tenantInvitations)
      .where(eq(tenantInvitations.status, 'pending'))
      .all();

    let count = 0;
    for (const inv of expired as Array<Record<string, unknown>>) {
      const expiresAt = inv.expiresAt ?? inv.expires_at;
      if (expiresAt && new Date(String(expiresAt)) < new Date(now)) {
        await db
          .update(tenantInvitations)
          .set({ status: 'expired' })
          .where(eq(tenantInvitations.id, String(inv.id)))
          .run();
        count++;
      }
    }

    return count;
  }

  // --------------------------------------------------------------------------
  // CONTEXT SWITCHING
  // --------------------------------------------------------------------------

  /**
   * Switch the current user's context to a specific tenant.
   * Validates membership and returns the full tenant context.
   */
  async switchTenant(userId: string, tenantId: string): Promise<TenantContext> {
    return this.getTenantContext(userId, tenantId);
  }

  /**
   * Get the full context for a user within a specific tenant.
   * Includes tenant info, role, permissions, and subscription.
   */
  async getTenantContext(userId: string, tenantId: string): Promise<TenantContext> {
    // Validate the user is a member
    const member = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .get();

    if (!member) {
      throw new Error('User is not a member of this tenant');
    }

    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    if (!tenant.isActive) {
      throw new Error('Tenant has been deactivated');
    }

    const role = ((member as Record<string, unknown>).role ?? 'viewer') as TenantRole;

    // Fetch permissions for this role in this tenant
    const perms = await this._getPermissionsForRole(tenantId, role);

    // Fetch subscription info
    const subscription = await this._getSubscriptionInfo(tenantId);

    // Update last active timestamp
    await db
      .update(tenantMembers)
      .set({
        lastActiveAt: new Date().toISOString(),
      })
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .run();

    return {
      tenant,
      role,
      permissions: perms,
      subscription,
    };
  }

  /**
   * Get the default (first joined) tenant for a user.
   */
  async getDefaultTenant(userId: string): Promise<Tenant | null> {
    const memberships = await db
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.userId, userId))
      .orderBy(tenantMembers.joinedAt)
      .all();

    if (!memberships || (memberships as Array<Record<string, unknown>>).length === 0) return null;

    const first = (memberships as Array<Record<string, unknown>>)[0];
    const tenantId = String(first.tenantId ?? first.tenant_id);
    return this.getTenant(tenantId);
  }

  // --------------------------------------------------------------------------
  // PRIVATE HELPERS
  // --------------------------------------------------------------------------

  /** Get the count of members in a tenant */
  private async _getMemberCount(tenantId: string): Promise<number> {
    const rows = await db
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.tenantId, tenantId))
      .all();
    return (rows as Array<Record<string, unknown>>).length;
  }

  /** Get the count of pending invitations for a tenant */
  private async _getPendingInvitationCount(tenantId: string): Promise<number> {
    const rows = await db
      .select()
      .from(tenantInvitations)
      .where(and(eq(tenantInvitations.tenantId, tenantId), eq(tenantInvitations.status, 'pending')))
      .all();
    return (rows as Array<Record<string, unknown>>).length;
  }

  /** Count members with a specific role in a tenant */
  private async _countMembersWithRole(tenantId: string, role: TenantRole): Promise<number> {
    const rows = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.role, role)))
      .all();
    return (rows as Array<Record<string, unknown>>).length;
  }

  /** Get the list of permission names for a role in a tenant */
  private async _getPermissionsForRole(tenantId: string, role: TenantRole): Promise<string[]> {
    // Join rolePermissions with permissions to get permission names
    const rps = await db
      .select()
      .from(rolePermissions)
      .where(and(eq(rolePermissions.tenantId, tenantId), eq(rolePermissions.role, role)))
      .all();

    const permIds = (rps as Array<Record<string, unknown>>).map((rp) => rp.permissionId ?? rp.permission_id);
    if (permIds.length === 0) return [];

    const allPerms = await db.select().from(permissions).all();
    const permMap = new Map<string, string>();
    for (const p of allPerms as Array<Record<string, unknown>>) {
      permMap.set(String(p.id), String(p.name));
    }

    return permIds.map((id) => permMap.get(String(id))).filter((name): name is string => !!name);
  }

  /** Get subscription info for a tenant, with defaults for free tier */
  private async _getSubscriptionInfo(tenantId: string): Promise<SubscriptionInfo> {
    // Find the active subscription for this tenant
    const sub = await db
      .select()
      .from(subscriptionHistory)
      .where(
        and(eq(subscriptionHistory.tenantId, tenantId), eq(subscriptionHistory.status, 'active')),
      )
      .get();

    if (!sub) return { ...DEFAULT_SUBSCRIPTION };

    const subRow = sub as Record<string, unknown>;
    const planId = String(subRow.planId ?? subRow.plan_id);

    // Fetch the plan details
    const plan = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .get();

    if (!plan) return { ...DEFAULT_SUBSCRIPTION };

    const planRow = plan as Record<string, unknown>;
    return {
      planId: String(planRow.id),
      planName: String(planRow.displayName ?? planRow.display_name ?? planRow.name),
      status: String(subRow.status),
      billingCycle: String(subRow.billingCycle ?? subRow.billing_cycle ?? 'monthly'),
      maxMembers: Number(planRow.maxMembers ?? planRow.max_members ?? 3),
      maxAccounts: Number(planRow.maxAccounts ?? planRow.max_accounts ?? 2),
      maxTransactionsPerMonth:
        Number(planRow.maxTransactionsPerMonth ?? planRow.max_transactions_per_month ?? 500),
      maxAiQueriesPerMonth: Number(planRow.maxAiQueriesPerMonth ?? planRow.max_ai_queries_per_month ?? 50),
      maxStorageMb: Number(planRow.maxStorageMb ?? planRow.max_storage_mb ?? 100),
      currentPeriodEnd:
        String(subRow.currentPeriodEnd ??
        subRow.current_period_end ??
        DEFAULT_SUBSCRIPTION.currentPeriodEnd),
      features: parseJsonArray(planRow.featuresJson ?? planRow.features_json),
    };
  }
}

/** Parse a JSON array safely */
function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const tenantService = new TenantService();
