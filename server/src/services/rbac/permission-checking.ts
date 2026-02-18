/**
 * RBAC — Permission checking, user permission retrieval, and cache management.
 */

import { db, rolePermissions, permissions, tenantMembers } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import type { TenantRole } from '../tenant-types.js';
import { ForbiddenError } from '../rbac-errors.js';
import { PermissionCache } from '../rbac-cache.js';

/** Numeric ordering for role hierarchy comparison: higher = more privileged */
export const ROLE_LEVEL: Record<TenantRole, number> = {
  viewer: 0,
  bookkeeper: 1,
  accountant: 2,
  admin: 3,
  owner: 4,
};

/**
 * Get a user's role in a tenant.
 */
export async function getRoleForUser(tenantId: string, userId: string): Promise<TenantRole | null> {
  const member = await db
    .select()
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
    .get();

  if (!member) return null;
  return ((member as Record<string, unknown>).role ?? 'viewer') as TenantRole;
}

/**
 * Get permissions from cache or DB.
 * Caches the result for future requests.
 */
export async function getCachedPermissions(
  cache: PermissionCache,
  tenantId: string,
  userId: string,
): Promise<string[]> {
  // Check cache first
  const cached = cache.get(tenantId, userId);
  if (cached) return cached;

  // Get user's role in this tenant
  const role = await getRoleForUser(tenantId, userId);
  if (!role) return [];

  // Fetch permissions for this role from DB
  const rps = await db
    .select()
    .from(rolePermissions)
    .where(and(eq(rolePermissions.tenantId, tenantId), eq(rolePermissions.role, role)))
    .all();

  const permIds = rps.map((rp: Record<string, unknown>) => rp.permissionId ?? rp.permission_id);
  if (permIds.length === 0) {
    cache.set(tenantId, userId, []);
    return [];
  }

  // Fetch permission names
  const allPerms = await db.select().from(permissions).all();
  const permMap = new Map<string, string>();
  for (const p of allPerms as Array<{ id: string; name: string }>) {
    permMap.set(p.id, p.name);
  }

  const permNames = (permIds as (string | unknown)[])
    .map((id) => permMap.get(id as string))
    .filter((name): name is string => !!name);

  // Cache the result
  cache.set(tenantId, userId, permNames);

  return permNames;
}

/**
 * Check if a user has a specific permission in a tenant.
 */
export async function checkPermission(
  cache: PermissionCache,
  tenantId: string,
  userId: string,
  permission: string,
): Promise<boolean> {
  const perms = await getCachedPermissions(cache, tenantId, userId);
  return perms.includes(permission);
}

/**
 * Require a specific permission -- throws ForbiddenError if not granted.
 */
export async function requirePermission(
  cache: PermissionCache,
  tenantId: string,
  userId: string,
  permission: string,
): Promise<void> {
  const granted = await checkPermission(cache, tenantId, userId, permission);
  if (!granted) {
    throw new ForbiddenError(permission, tenantId, userId);
  }
}
