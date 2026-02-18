/**
 * RBAC — Role assignment and user-role queries
 */

import { db, tenantMembers } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import type { TenantRole, TenantMember } from '../tenant-types.js';
import { TENANT_ROLES } from '../tenant-types.js';
import { ForbiddenError } from './errors.js';
import { PermissionCache } from './cache.js';
import { getRoleForUser, checkPermission as checkPermissionFn } from './permission-checking.js';

export async function getUsersWithRoleImpl(
  tenantId: string,
  role: TenantRole,
): Promise<TenantMember[]> {
  const rows = await db
    .select()
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.role, role)))
    .all();

  return (rows as Array<Record<string, unknown>>).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    tenantId: (row.tenantId ?? row.tenant_id) as string,
    userId: (row.userId ?? row.user_id) as string,
    role: (row.role ?? 'viewer') as TenantRole,
    displayName: (row.displayName ?? row.display_name ?? undefined) as string | undefined,
    isPrimaryContact: Boolean(row.isPrimaryContact ?? row.is_primary_contact ?? false),
    joinedAt: (row.joinedAt ?? row.joined_at ?? '') as string,
    lastActiveAt: (row.lastActiveAt ?? row.last_active_at ?? undefined) as string | undefined,
  }));
}

export async function assignRoleImpl(
  cache: PermissionCache,
  tenantId: string,
  userId: string,
  role: TenantRole,
  assignedBy: string,
): Promise<void> {
  if (!TENANT_ROLES.includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }

  const hasManagePermission = await checkPermissionFn(
    cache,
    tenantId,
    assignedBy,
    'members.manage',
  );
  if (!hasManagePermission) {
    throw new ForbiddenError('members.manage', tenantId, assignedBy);
  }

  if (role === 'owner') {
    const assignerRole = await getRoleForUser(tenantId, assignedBy);
    if (assignerRole !== 'owner') {
      throw new Error('Only owners can assign the owner role');
    }
  }

  const currentRole = await getRoleForUser(tenantId, userId);
  if (currentRole === 'owner' && role !== 'owner') {
    const owners = await getUsersWithRoleImpl(tenantId, 'owner');
    if (owners.length <= 1) {
      throw new Error('Cannot demote the last owner. Assign another owner first.');
    }
  }

  const now = new Date().toISOString();
  await db
    .update(tenantMembers)
    .set({ role, updatedAt: now })
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
    .run();

  cache.invalidate(tenantId, userId);
}
