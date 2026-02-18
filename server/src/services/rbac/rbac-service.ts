/**
 * RBAC Service — Thin orchestrator
 * Delegates all logic to sub-modules.
 */

import type { TenantRole, TenantMember } from '../tenant-types.js';
import { PermissionCache } from './cache.js';
import {
  ROLE_LEVEL,
  getRoleForUser,
  getCachedPermissions,
  checkPermission as checkPermissionFn,
  requirePermission as requirePermissionFn,
} from './permission-checking.js';
import { createPermissionMiddlewareImpl, createRoleMiddlewareImpl } from './rbac-middleware.js';
import { assignRoleImpl, getUsersWithRoleImpl } from './rbac-role-management.js';
import {
  getPermissionMatrixImpl,
  updateRolePermissionsImpl,
  resetToDefaultsImpl,
} from './rbac-permissions.js';

export { ROLE_LEVEL };

export class RBACService {
  private cache: PermissionCache;

  constructor() {
    this.cache = new PermissionCache(1000, 60);
  }

  async checkPermission(tenantId: string, userId: string, permission: string): Promise<boolean> {
    return checkPermissionFn(this.cache, tenantId, userId, permission);
  }

  async checkPermissions(
    tenantId: string,
    userId: string,
    permissionNames: string[],
  ): Promise<Record<string, boolean>> {
    const perms = await getCachedPermissions(this.cache, tenantId, userId);
    const permSet = new Set(perms);
    const result: Record<string, boolean> = {};
    for (const p of permissionNames) {
      result[p] = permSet.has(p);
    }
    return result;
  }

  async requirePermission(tenantId: string, userId: string, permission: string): Promise<void> {
    return requirePermissionFn(this.cache, tenantId, userId, permission);
  }

  async getUserPermissions(tenantId: string, userId: string): Promise<string[]> {
    return getCachedPermissions(this.cache, tenantId, userId);
  }

  async assignRole(
    tenantId: string,
    userId: string,
    role: TenantRole,
    assignedBy: string,
  ): Promise<void> {
    return assignRoleImpl(this.cache, tenantId, userId, role, assignedBy);
  }

  async getRoleForUser(tenantId: string, userId: string): Promise<TenantRole | null> {
    return getRoleForUser(tenantId, userId);
  }

  async getUsersWithRole(tenantId: string, role: TenantRole): Promise<TenantMember[]> {
    return getUsersWithRoleImpl(tenantId, role);
  }

  async getPermissionMatrix(tenantId: string): Promise<Record<TenantRole, string[]>> {
    return getPermissionMatrixImpl(tenantId);
  }

  async updateRolePermissions(
    tenantId: string,
    role: TenantRole,
    permissionNames: string[],
    updatedBy: string,
  ): Promise<void> {
    return updateRolePermissionsImpl(this.cache, tenantId, role, permissionNames, updatedBy);
  }

  async resetToDefaults(tenantId: string): Promise<void> {
    return resetToDefaultsImpl(this.cache, tenantId);
  }

  createPermissionMiddleware(permission: string) {
    return createPermissionMiddlewareImpl(this.cache, permission);
  }

  createRoleMiddleware(minRole: TenantRole) {
    return createRoleMiddlewareImpl(this.cache, minRole);
  }

  invalidateUserCache(tenantId: string, userId: string): void {
    this.cache.invalidate(tenantId, userId);
  }

  invalidateTenantCache(tenantId: string): void {
    this.cache.invalidateTenant(tenantId);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const rbacService = new RBACService();
