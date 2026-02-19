/**
 * Tenant Service — CRUD, Members, and Context Switching (Part 1)
 */

import {
  db,
  tenants,
  tenantMembers,
  permissions,
  rolePermissions,
  subscriptionPlans,
  subscriptionHistory,
} from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import type {
  Tenant,
  TenantMember,
  TenantRole,
  CreateTenantOptions,
  SubscriptionInfo,
} from './types.js';
import { TENANT_ROLES } from './types.js';
import { seedDefaultPermissions } from './defaults.js';
import { rbacService } from '../rbac.js';
import { rowToTenant, rowToMember, DEFAULT_SUBSCRIPTION, parseJsonArray } from './helpers.js';

export async function createTenant(
  name: string,
  slug: string,
  ownerId: string,
  options: CreateTenantOptions = {},
): Promise<Tenant> {
  const now = new Date().toISOString();
  const tenantId = crypto.randomUUID();
  const existing = (await db.select().from(tenants).where(eq(tenants.slug, slug)))[0];
  if (existing) throw new Error(`Tenant with slug "${slug}" already exists`);
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
      settingsJson: options.settingsJson ?? {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  await seedDefaultPermissions(tenantId, ownerId);
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
  return (await getTenant(tenantId)) as Tenant;
}

export async function updateTenant(
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
  if (updates.financialYearEnd !== undefined) setValues.financialYearEnd = updates.financialYearEnd;
  if (updates.timezone !== undefined) setValues.timezone = updates.timezone;
  if (updates.settingsJson !== undefined) setValues.settingsJson = updates.settingsJson;
  await db.update(tenants).set(setValues).where(eq(tenants.id, tenantId)).run();
  const updated = await getTenant(tenantId);
  if (!updated) throw new Error(`Tenant ${tenantId} not found after update`);
  return updated;
}

export async function getTenant(tenantId: string): Promise<Tenant | null> {
  const row = (await db.select().from(tenants).where(eq(tenants.id, tenantId)))[0];
  if (!row) return null;
  return rowToTenant(row);
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const row = (await db.select().from(tenants).where(eq(tenants.slug, slug)))[0];
  if (!row) return null;
  return rowToTenant(row);
}

export async function deactivateTenant(tenantId: string): Promise<void> {
  await db
    .update(tenants)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(eq(tenants.id, tenantId))
    .run();
}

export async function addMember(
  tenantId: string,
  userId: string,
  role: TenantRole,
  invitedBy?: string,
): Promise<TenantMember> {
  if (!TENANT_ROLES.includes(role))
    throw new Error(`Invalid role: ${role}. Must be one of: ${TENANT_ROLES.join(', ')}`);
  const existingMember = (
    await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
  )[0];
  if (existingMember) throw new Error('User is already a member of this tenant');
  const sub = await getSubscriptionInfo(tenantId);
  const memberCount = await getMemberCount(tenantId);
  if (memberCount >= sub.maxMembers)
    throw new Error(
      `Member limit reached (${sub.maxMembers} on ${sub.planName} plan). Upgrade your subscription to add more members.`,
    );
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
  const member = (await db.select().from(tenantMembers).where(eq(tenantMembers.id, memberId)))[0];
  return rowToMember(member);
}

export async function removeMember(tenantId: string, userId: string): Promise<void> {
  const member = (
    await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
  )[0];
  if (!member) throw new Error('Member not found in this tenant');
  if ((member as Record<string, unknown>).role === 'owner') {
    const ownerCount = await countMembersWithRole(tenantId, 'owner');
    if (ownerCount <= 1) throw new Error('Cannot remove the last owner. Transfer ownership first.');
  }
  await db
    .delete(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
    .run();
  rbacService.invalidateUserCache(tenantId, userId);
}

export async function updateMemberRole(
  tenantId: string,
  userId: string,
  newRole: TenantRole,
): Promise<TenantMember> {
  if (!TENANT_ROLES.includes(newRole))
    throw new Error(`Invalid role: ${newRole}. Must be one of: ${TENANT_ROLES.join(', ')}`);
  const member = (
    await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
  )[0];
  if (!member) throw new Error('Member not found in this tenant');
  if ((member as Record<string, unknown>).role === 'owner' && newRole !== 'owner') {
    const ownerCount = await countMembersWithRole(tenantId, 'owner');
    if (ownerCount <= 1)
      throw new Error('Cannot demote the last owner. Assign another owner first.');
  }
  const now = new Date().toISOString();
  await db
    .update(tenantMembers)
    .set({ role: newRole, updatedAt: now })
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
    .run();
  rbacService.invalidateUserCache(tenantId, userId);
  const updated = (
    await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
  )[0];
  return rowToMember(updated);
}

export async function getMembers(tenantId: string): Promise<TenantMember[]> {
  const rows = await db.select().from(tenantMembers).where(eq(tenantMembers.tenantId, tenantId));
  return (rows as Record<string, unknown>[]).map(rowToMember);
}

export async function getMemberTenants(
  userId: string,
): Promise<Array<{ tenant: Tenant; role: TenantRole }>> {
  const memberships = await db.select().from(tenantMembers).where(eq(tenantMembers.userId, userId));
  const results: Array<{ tenant: Tenant; role: TenantRole }> = [];
  for (const m of memberships as Record<string, unknown>[]) {
    const tenant = await getTenant((m.tenantId ?? m.tenant_id) as string);
    if (tenant && tenant.isActive)
      results.push({ tenant, role: (m.role ?? 'viewer') as TenantRole });
  }
  return results;
}

export async function getMemberCount(tenantId: string): Promise<number> {
  const rows = await db.select().from(tenantMembers).where(eq(tenantMembers.tenantId, tenantId));
  return rows.length;
}

export async function countMembersWithRole(tenantId: string, role: TenantRole): Promise<number> {
  const rows = await db
    .select()
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.role, role)));
  return rows.length;
}

export async function getPermissionsForRole(tenantId: string, role: TenantRole): Promise<string[]> {
  const rps = await db
    .select()
    .from(rolePermissions)
    .where(and(eq(rolePermissions.tenantId, tenantId), eq(rolePermissions.role, role)));
  const permIds = (rps as Record<string, unknown>[]).map(
    (rp) => (rp.permissionId ?? rp.permission_id) as string,
  );
  if (permIds.length === 0) return [];
  const allPerms = await db.select().from(permissions);
  const permMap = new Map<string, string>();
  for (const p of allPerms as Record<string, unknown>[])
    permMap.set(p.id as string, p.name as string);
  return permIds.map((id) => permMap.get(id)).filter((name): name is string => !!name);
}

export async function getSubscriptionInfo(tenantId: string): Promise<SubscriptionInfo> {
  const sub = (
    await db
      .select()
      .from(subscriptionHistory)
      .where(
        and(eq(subscriptionHistory.tenantId, tenantId), eq(subscriptionHistory.status, 'active')),
      )
  )[0];
  if (!sub) return { ...DEFAULT_SUBSCRIPTION };
  const subRow = sub as Record<string, unknown>;
  const planId = (subRow.planId ?? subRow.plan_id) as string;
  const plan = (
    await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId))
  )[0];
  if (!plan) return { ...DEFAULT_SUBSCRIPTION };
  const planRow = plan as Record<string, unknown>;
  return {
    planId: planRow.id as string,
    planName: (planRow.displayName ?? planRow.display_name ?? planRow.name) as string,
    status: subRow.status as string,
    billingCycle: (subRow.billingCycle ?? subRow.billing_cycle ?? 'monthly') as string,
    maxMembers: (planRow.maxMembers ?? planRow.max_members ?? 3) as number,
    maxAccounts: (planRow.maxAccounts ?? planRow.max_accounts ?? 2) as number,
    maxTransactionsPerMonth: (planRow.maxTransactionsPerMonth ??
      planRow.max_transactions_per_month ??
      500) as number,
    maxAiQueriesPerMonth: (planRow.maxAiQueriesPerMonth ??
      planRow.max_ai_queries_per_month ??
      50) as number,
    maxStorageMb: (planRow.maxStorageMb ?? planRow.max_storage_mb ?? 100) as number,
    currentPeriodEnd: (subRow.currentPeriodEnd ??
      subRow.current_period_end ??
      DEFAULT_SUBSCRIPTION.currentPeriodEnd) as string,
    features: parseJsonArray(planRow.featuresJson ?? planRow.features_json),
  };
}
