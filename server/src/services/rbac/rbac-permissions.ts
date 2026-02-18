/**
 * RBAC — Permission matrix management
 */

import { db, rolePermissions, permissions } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import type { TenantRole } from '../tenant-types.js';
import { TENANT_ROLES } from '../tenant-types.js';
import { PermissionCache } from '../rbac-cache.js';
import { seedDefaultPermissions } from '../tenant-defaults.js';
import { getRoleForUser } from './permission-checking.js';
import crypto from 'crypto';

export async function getPermissionMatrixImpl(
  tenantId: string,
): Promise<Record<TenantRole, string[]>> {
  const matrix: Record<string, string[]> = {};
  for (const role of TENANT_ROLES) {
    matrix[role] = [];
  }

  const rps = await db
    .select()
    .from(rolePermissions)
    .where(eq(rolePermissions.tenantId, tenantId))
    .all();

  const allPerms = await db.select().from(permissions).all();
  const permMap = new Map<string, string>();
  for (const p of allPerms as Array<Record<string, unknown>>) {
    permMap.set(p.id as string, p.name as string);
  }

  for (const rp of rps as Array<Record<string, unknown>>) {
    const role = rp.role as string;
    const permId = (rp.permissionId ?? rp.permission_id) as string;
    const permName = permMap.get(permId);
    if (permName && matrix[role]) {
      matrix[role].push(permName);
    }
  }

  return matrix as Record<TenantRole, string[]>;
}

export async function updateRolePermissionsImpl(
  cache: PermissionCache,
  tenantId: string,
  role: TenantRole,
  permissionNames: string[],
  updatedBy: string,
): Promise<void> {
  const updaterRole = await getRoleForUser(tenantId, updatedBy);
  if (updaterRole !== 'owner') {
    throw new Error('Only tenant owners can modify role permissions');
  }

  if (role === 'owner') {
    throw new Error('Cannot modify owner permissions -- owners always have full access');
  }

  const allPerms = await db.select().from(permissions).all();
  const permByName = new Map<string, string>();
  for (const p of allPerms as Array<Record<string, unknown>>) {
    permByName.set(p.name as string, p.id as string);
  }

  for (const name of permissionNames) {
    if (!permByName.has(name)) {
      throw new Error(`Unknown permission: ${name}`);
    }
  }

  await db
    .delete(rolePermissions)
    .where(and(eq(rolePermissions.tenantId, tenantId), eq(rolePermissions.role, role)))
    .run();

  for (const name of permissionNames) {
    const permId = permByName.get(name);
    if (!permId) continue;

    await db
      .insert(rolePermissions)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        role,
        permissionId: permId,
        grantedBy: updatedBy,
      })
      .run();
  }

  cache.invalidateTenant(tenantId);
}

export async function resetToDefaultsImpl(cache: PermissionCache, tenantId: string): Promise<void> {
  await db.delete(rolePermissions).where(eq(rolePermissions.tenantId, tenantId)).run();
  await seedDefaultPermissions(tenantId);
  cache.invalidateTenant(tenantId);
}
