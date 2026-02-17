/**
 * Tenant Default Configuration
 * Default role-permission mappings and seeding logic for new tenants.
 */

import { db, permissions, rolePermissions } from '../schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import type { TenantRole } from './tenant-types.js';

// ============================================================================
// PERMISSION DEFINITIONS
// ============================================================================

/** All 16 system permissions available in the platform */
export const ALL_PERMISSIONS = [
  'transactions.read',
  'transactions.write',
  'transactions.delete',
  'accounts.read',
  'accounts.write',
  'accounts.delete',
  'bas.read',
  'bas.write',
  'tax.read',
  'tax.write',
  'reports.read',
  'reports.write',
  'reports.export',
  'settings.read',
  'settings.manage',
  'members.manage',
] as const;

export type PermissionName = (typeof ALL_PERMISSIONS)[number];

// ============================================================================
// DEFAULT ROLE → PERMISSION MAPPINGS
// ============================================================================

/**
 * Maps each tenant role to its allowed permissions.
 * - owner: full access to all 16 permissions
 * - admin: everything except settings.manage (members.manage limited to non-owner)
 * - accountant: financial read/write + reports + settings.read
 * - bookkeeper: limited read/write for transactions, read-only for rest
 * - viewer: read-only access across all modules
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<TenantRole, PermissionName[]> = {
  owner: [...ALL_PERMISSIONS],

  admin: [
    'transactions.read',
    'transactions.write',
    'transactions.delete',
    'accounts.read',
    'accounts.write',
    'accounts.delete',
    'bas.read',
    'bas.write',
    'tax.read',
    'tax.write',
    'reports.read',
    'reports.write',
    'reports.export',
    'settings.read',
    'members.manage',
  ],

  accountant: [
    'transactions.read',
    'transactions.write',
    'accounts.read',
    'accounts.write',
    'bas.read',
    'bas.write',
    'tax.read',
    'tax.write',
    'reports.read',
    'reports.write',
    'reports.export',
    'settings.read',
  ],

  bookkeeper: [
    'transactions.read',
    'transactions.write',
    'accounts.read',
    'bas.read',
    'reports.read',
  ],

  viewer: [
    'transactions.read',
    'accounts.read',
    'bas.read',
    'tax.read',
    'reports.read',
    'settings.read',
  ],
};

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

/**
 * Ensures all 16 system permissions exist in the permissions table.
 * Idempotent — skips permissions that already exist.
 */
export async function ensurePermissionsExist(): Promise<void> {
  const existing = await db.select().from(permissions).all();
  const existingNames = new Set((existing as Array<Record<string, unknown>>).map((p: Record<string, unknown>) => p.name));

  for (const perm of ALL_PERMISSIONS) {
    if (existingNames.has(perm)) continue;

    const [resource, action] = perm.split('.');
    await db
      .insert(permissions)
      .values({
        id: crypto.randomUUID(),
        name: perm,
        description: `${action.charAt(0).toUpperCase() + action.slice(1)} access to ${resource}`,
        resource,
        action,
        isSystem: true,
      })
      .run();
  }
}

/**
 * Seeds default role_permissions for a newly created tenant.
 * Creates entries linking each of the 5 roles to their allowed permissions.
 *
 * @param tenantId - The tenant to seed permissions for
 * @param grantedBy - The user who triggered the seeding (usually the tenant creator)
 */
export async function seedDefaultPermissions(tenantId: string, grantedBy?: string): Promise<void> {
  // First ensure all system permissions exist
  await ensurePermissionsExist();

  // Fetch all permissions to get their IDs
  const allPerms = await db.select().from(permissions).all();
  const permByName = new Map<string, string>();
  for (const p of allPerms as Array<Record<string, unknown>>) {
    permByName.set(String(p.name), String(p.id));
  }

  // Insert role_permissions for each role
  const roles = Object.keys(DEFAULT_ROLE_PERMISSIONS) as TenantRole[];
  for (const role of roles) {
    const permNames = DEFAULT_ROLE_PERMISSIONS[role];
    for (const permName of permNames) {
      const permId = permByName.get(permName);
      if (!permId) continue;

      await db
        .insert(rolePermissions)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          role,
          permissionId: permId,
          grantedBy: grantedBy ?? null,
        })
        .run();
    }
  }
}
