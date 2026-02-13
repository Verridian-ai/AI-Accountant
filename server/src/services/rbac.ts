/**
 * RBAC Service
 * Role-Based Access Control for multi-tenant permission checking,
 * role assignment, permission matrix management, and Hono middleware.
 */

import { db, tenantMembers, rolePermissions, permissions } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import type { Context, Next } from 'hono';
import type { TenantRole, TenantMember } from './tenant-types.js';
import { TENANT_ROLES } from './tenant-types.js';
import { ForbiddenError, InsufficientRoleError } from './rbac-errors.js';
import { PermissionCache } from './rbac-cache.js';
import { DEFAULT_ROLE_PERMISSIONS } from './tenant-defaults.js';
import { seedDefaultPermissions } from './tenant-defaults.js';
import crypto from 'crypto';

// ============================================================================
// ROLE HIERARCHY
// ============================================================================

/** Numeric ordering for role hierarchy comparison: higher = more privileged */
const ROLE_LEVEL: Record<TenantRole, number> = {
  viewer: 0,
  bookkeeper: 1,
  accountant: 2,
  admin: 3,
  owner: 4,
};

// ============================================================================
// RBAC SERVICE
// ============================================================================

export class RBACService {
  private cache: PermissionCache;

  constructor() {
    this.cache = new PermissionCache(1000, 60);
  }

  // --------------------------------------------------------------------------
  // PERMISSION CHECKING
  // --------------------------------------------------------------------------

  /**
   * Check if a user has a specific permission in a tenant.
   * Uses cached permissions when available.
   */
  async checkPermission(tenantId: string, userId: string, permission: string): Promise<boolean> {
    const perms = await this._getCachedPermissions(tenantId, userId);
    return perms.includes(permission);
  }

  /**
   * Batch-check multiple permissions for a user in a tenant.
   * Returns a map of permission → granted boolean.
   */
  async checkPermissions(
    tenantId: string,
    userId: string,
    permissionNames: string[],
  ): Promise<Record<string, boolean>> {
    const perms = await this._getCachedPermissions(tenantId, userId);
    const permSet = new Set(perms);

    const result: Record<string, boolean> = {};
    for (const p of permissionNames) {
      result[p] = permSet.has(p);
    }
    return result;
  }

  /**
   * Require a specific permission — throws ForbiddenError if not granted.
   */
  async requirePermission(tenantId: string, userId: string, permission: string): Promise<void> {
    const granted = await this.checkPermission(tenantId, userId, permission);
    if (!granted) {
      throw new ForbiddenError(permission, tenantId, userId);
    }
  }

  /**
   * Get all permission names for a user's role in a tenant.
   */
  async getUserPermissions(tenantId: string, userId: string): Promise<string[]> {
    return this._getCachedPermissions(tenantId, userId);
  }

  // --------------------------------------------------------------------------
  // ROLE ASSIGNMENT
  // --------------------------------------------------------------------------

  /**
   * Assign a role to a user in a tenant.
   * Validates that the assigner has 'members.manage' permission and
   * only owners can create other owners.
   */
  async assignRole(
    tenantId: string,
    userId: string,
    role: TenantRole,
    assignedBy: string,
  ): Promise<void> {
    if (!TENANT_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    // Check assigner has permission
    const hasManagePermission = await this.checkPermission(tenantId, assignedBy, 'members.manage');
    if (!hasManagePermission) {
      throw new ForbiddenError('members.manage', tenantId, assignedBy);
    }

    // Only owners can assign the owner role
    if (role === 'owner') {
      const assignerRole = await this.getRoleForUser(tenantId, assignedBy);
      if (assignerRole !== 'owner') {
        throw new Error('Only owners can assign the owner role');
      }
    }

    // Prevent demoting the last owner
    const currentRole = await this.getRoleForUser(tenantId, userId);
    if (currentRole === 'owner' && role !== 'owner') {
      const owners = await this.getUsersWithRole(tenantId, 'owner');
      if (owners.length <= 1) {
        throw new Error('Cannot demote the last owner. Assign another owner first.');
      }
    }

    // Update the role
    const now = new Date().toISOString();
    await db
      .update(tenantMembers)
      .set({
        role,
        updatedAt: now,
      })
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .run();

    // Invalidate cache for affected user
    this.cache.invalidate(tenantId, userId);
  }

  /**
   * Get a user's role in a tenant.
   */
  async getRoleForUser(tenantId: string, userId: string): Promise<TenantRole | null> {
    const member = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .get();

    if (!member) return null;
    return ((member as any).role ?? 'viewer') as TenantRole;
  }

  /**
   * List all members with a specific role in a tenant.
   */
  async getUsersWithRole(tenantId: string, role: TenantRole): Promise<TenantMember[]> {
    const rows = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.role, role)))
      .all();

    return (rows as any[]).map((row: any) => ({
      id: row.id,
      tenantId: row.tenantId ?? row.tenant_id,
      userId: row.userId ?? row.user_id,
      role: (row.role ?? 'viewer') as TenantRole,
      displayName: row.displayName ?? row.display_name ?? undefined,
      isPrimaryContact: Boolean(row.isPrimaryContact ?? row.is_primary_contact ?? false),
      joinedAt: row.joinedAt ?? row.joined_at ?? '',
      lastActiveAt: row.lastActiveAt ?? row.last_active_at ?? undefined,
    }));
  }

  // --------------------------------------------------------------------------
  // PERMISSION MATRIX
  // --------------------------------------------------------------------------

  /**
   * Get the complete role-permission matrix for a tenant.
   * Returns all role → permission[] mappings.
   */
  async getPermissionMatrix(tenantId: string): Promise<Record<TenantRole, string[]>> {
    const matrix: Record<string, string[]> = {};
    for (const role of TENANT_ROLES) {
      matrix[role] = [];
    }

    // Fetch all role_permissions for this tenant
    const rps = await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.tenantId, tenantId))
      .all();

    // Fetch all permissions to map IDs to names
    const allPerms = await db.select().from(permissions).all();
    const permMap = new Map<string, string>();
    for (const p of allPerms as any[]) {
      permMap.set(p.id, p.name);
    }

    for (const rp of rps as any[]) {
      const role = rp.role as string;
      const permId = rp.permissionId ?? rp.permission_id;
      const permName = permMap.get(permId);
      if (permName && matrix[role]) {
        matrix[role].push(permName);
      }
    }

    return matrix as Record<TenantRole, string[]>;
  }

  /**
   * Replace all permissions for a specific role in a tenant.
   * Only owners can modify role permissions.
   */
  async updateRolePermissions(
    tenantId: string,
    role: TenantRole,
    permissionNames: string[],
    updatedBy: string,
  ): Promise<void> {
    // Only owners can modify permissions
    const updaterRole = await this.getRoleForUser(tenantId, updatedBy);
    if (updaterRole !== 'owner') {
      throw new Error('Only tenant owners can modify role permissions');
    }

    // Cannot modify the owner role's permissions (always has all)
    if (role === 'owner') {
      throw new Error('Cannot modify owner permissions — owners always have full access');
    }

    // Fetch all permissions to validate names and get IDs
    const allPerms = await db.select().from(permissions).all();
    const permByName = new Map<string, string>();
    for (const p of allPerms as any[]) {
      permByName.set(p.name, p.id);
    }

    // Validate all permission names
    for (const name of permissionNames) {
      if (!permByName.has(name)) {
        throw new Error(`Unknown permission: ${name}`);
      }
    }

    // Delete existing role_permissions for this role in this tenant
    await db
      .delete(rolePermissions)
      .where(and(eq(rolePermissions.tenantId, tenantId), eq(rolePermissions.role, role)))
      .run();

    // Insert new permissions
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

    // Invalidate entire tenant cache since permissions changed
    this.cache.invalidateTenant(tenantId);
  }

  /**
   * Reset all role-permissions for a tenant back to the defaults.
   */
  async resetToDefaults(tenantId: string): Promise<void> {
    // Delete all existing role_permissions for this tenant
    await db.delete(rolePermissions).where(eq(rolePermissions.tenantId, tenantId)).run();

    // Re-seed defaults
    await seedDefaultPermissions(tenantId);

    // Invalidate entire tenant cache
    this.cache.invalidateTenant(tenantId);
  }

  // --------------------------------------------------------------------------
  // MIDDLEWARE HELPERS
  // --------------------------------------------------------------------------

  /**
   * Create a Hono middleware that requires a specific permission.
   * Extracts tenantId from `X-Tenant-Id` header and userId from context.
   */
  createPermissionMiddleware(permission: string) {
    const self = this;
    return async (c: Context, next: Next) => {
      const tenantId = c.req.header('X-Tenant-Id');
      const userId = c.get('userId') as string | undefined;

      if (!tenantId) {
        return c.json({ error: 'X-Tenant-Id header is required', code: 400 }, 400);
      }
      if (!userId) {
        return c.json({ error: 'Authentication required', code: 401 }, 401);
      }

      try {
        await self.requirePermission(tenantId, userId, permission);
        await next();
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return c.json(
            {
              error: `Forbidden: missing permission '${permission}'`,
              code: 403,
              permission,
            },
            403,
          );
        }
        throw err;
      }
    };
  }

  /**
   * Create a Hono middleware that requires a minimum role level.
   * Role hierarchy: owner > admin > accountant > bookkeeper > viewer
   */
  createRoleMiddleware(minRole: TenantRole) {
    const self = this;
    const requiredLevel = ROLE_LEVEL[minRole];

    return async (c: Context, next: Next) => {
      const tenantId = c.req.header('X-Tenant-Id');
      const userId = c.get('userId') as string | undefined;

      if (!tenantId) {
        return c.json({ error: 'X-Tenant-Id header is required', code: 400 }, 400);
      }
      if (!userId) {
        return c.json({ error: 'Authentication required', code: 401 }, 401);
      }

      const userRole = await self.getRoleForUser(tenantId, userId);
      if (!userRole) {
        return c.json({ error: 'Not a member of this tenant', code: 403 }, 403);
      }

      const userLevel = ROLE_LEVEL[userRole] ?? 0;
      if (userLevel < requiredLevel) {
        return c.json(
          {
            error: `Insufficient role: requires '${minRole}', you have '${userRole}'`,
            code: 403,
            requiredRole: minRole,
            actualRole: userRole,
          },
          403,
        );
      }

      await next();
    };
  }

  // --------------------------------------------------------------------------
  // CACHE MANAGEMENT (public API for external invalidation)
  // --------------------------------------------------------------------------

  /**
   * Invalidate cached permissions for a specific user in a tenant.
   * Should be called when a user's role changes or they are removed.
   */
  invalidateUserCache(tenantId: string, userId: string): void {
    this.cache.invalidate(tenantId, userId);
  }

  /**
   * Invalidate all cached permissions for a tenant.
   * Should be called when role-permission mappings change.
   */
  invalidateTenantCache(tenantId: string): void {
    this.cache.invalidateTenant(tenantId);
  }

  /** Clear the entire permission cache. */
  clearCache(): void {
    this.cache.clear();
  }

  // --------------------------------------------------------------------------
  // PRIVATE HELPERS
  // --------------------------------------------------------------------------

  /**
   * Get permissions from cache or DB.
   * Caches the result for future requests.
   */
  private async _getCachedPermissions(tenantId: string, userId: string): Promise<string[]> {
    // Check cache first
    const cached = this.cache.get(tenantId, userId);
    if (cached) return cached;

    // Get user's role in this tenant
    const role = await this.getRoleForUser(tenantId, userId);
    if (!role) return [];

    // Fetch permissions for this role from DB
    const rps = await db
      .select()
      .from(rolePermissions)
      .where(and(eq(rolePermissions.tenantId, tenantId), eq(rolePermissions.role, role)))
      .all();

    const permIds = (rps as any[]).map((rp) => rp.permissionId ?? rp.permission_id);
    if (permIds.length === 0) {
      this.cache.set(tenantId, userId, []);
      return [];
    }

    // Fetch permission names
    const allPerms = await db.select().from(permissions).all();
    const permMap = new Map<string, string>();
    for (const p of allPerms as any[]) {
      permMap.set(p.id, p.name);
    }

    const permNames = permIds.map((id) => permMap.get(id)).filter((name): name is string => !!name);

    // Cache the result
    this.cache.set(tenantId, userId, permNames);

    return permNames;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const rbacService = new RBACService();
