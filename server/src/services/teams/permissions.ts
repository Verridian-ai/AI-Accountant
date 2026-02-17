/**
 * Team Permissions
 *
 * Role-permission mappings and core permission checking utilities.
 */

import { db, teamMembers } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import type { TeamRole, Permission } from './types.js';

// ============================================================================
// ROLE PERMISSIONS MAPPING
// ============================================================================

/**
 * Default permissions for each role
 */
export const ROLE_PERMISSIONS: Record<TeamRole, Permission[]> = {
  owner: [
    'view_transactions',
    'edit_transactions',
    'delete_transactions',
    'view_statements',
    'upload_statements',
    'delete_statements',
    'view_accounts',
    'edit_accounts',
    'view_bas',
    'edit_bas',
    'submit_bas',
    'view_reports',
    'export_data',
    'manage_team',
    'invite_members',
    'remove_members',
    'edit_member_roles',
    'view_audit_log',
    'manage_settings',
  ],
  admin: [
    'view_transactions',
    'edit_transactions',
    'delete_transactions',
    'view_statements',
    'upload_statements',
    'delete_statements',
    'view_accounts',
    'edit_accounts',
    'view_bas',
    'edit_bas',
    'submit_bas',
    'view_reports',
    'export_data',
    'invite_members',
    'remove_members',
    'view_audit_log',
  ],
  accountant: [
    'view_transactions',
    'edit_transactions',
    'view_statements',
    'upload_statements',
    'view_accounts',
    'view_bas',
    'edit_bas',
    'view_reports',
    'export_data',
  ],
  viewer: ['view_transactions', 'view_statements', 'view_accounts', 'view_bas', 'view_reports'],
};

// ============================================================================
// PERMISSION CHECK FUNCTIONS
// ============================================================================

/**
 * Check if a user is a member of a team
 */
export async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  const member = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .get();
  return !!member;
}

/**
 * Get the user's role in a team
 */
export async function getUserRole(userId: string, teamId: string): Promise<TeamRole | null> {
  const member = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .get();
  return member ? (member.role as TeamRole) : null;
}

/**
 * Check if a user has a specific permission in a team
 */
export async function hasPermission(
  userId: string,
  teamId: string,
  permission: Permission,
): Promise<boolean> {
  const member = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .get();

  if (!member) {
    return false;
  }

  const role = member.role as TeamRole;
  const rolePermissions = ROLE_PERMISSIONS[role];

  // Check if role has the permission
  if (rolePermissions.includes(permission)) {
    return true;
  }

  // Check custom permissions if any
  if (member.permissions) {
    try {
      const customPermissions = JSON.parse(member.permissions) as Permission[];
      return customPermissions.includes(permission);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Get all permissions for a user in a team
 */
export async function getUserPermissions(userId: string, teamId: string): Promise<Permission[]> {
  const member = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .get();

  if (!member) {
    return [];
  }

  const role = member.role as TeamRole;
  const basePermissions = [...ROLE_PERMISSIONS[role]];

  // Merge with custom permissions if any
  if (member.permissions) {
    try {
      const customPermissions = JSON.parse(member.permissions) as Permission[];
      for (const perm of customPermissions) {
        if (!basePermissions.includes(perm)) {
          basePermissions.push(perm);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return basePermissions;
}

/**
 * Check if user can manage a team
 */
export async function canManageTeam(userId: string, teamId: string): Promise<boolean> {
  return hasPermission(userId, teamId, 'manage_team');
}
