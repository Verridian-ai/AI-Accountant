/**
 * Team Access Checks
 *
 * Higher-level access control: account-level permission checks,
 * BAS/export access, and account accessibility queries.
 */

import { db, teamMembers, accounts } from '../../schema.js';
import { eq } from 'drizzle-orm';
import type { Permission, PermissionCheckContext } from './types.js';
import {
  ROLE_PERMISSIONS,
  hasPermission,
  getUserPermissions,
  isTeamMember,
} from './permissions.js';
import { logAuditEvent } from './audit-logger.js';
import { getUserTeams } from './team-crud.js';

// ============================================================================
// TRANSACTION ACCESS CHECKS
// ============================================================================

/**
 * Check if user can view transactions for an account
 * Considers both direct ownership and team membership
 */
export async function canViewTransactions(
  userId: string,
  accountId: string,
  context?: PermissionCheckContext,
): Promise<boolean> {
  const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).get();

  if (!account) {
    return false;
  }

  if (account.userId === userId) {
    return true;
  }

  const ownerTeams = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, account.userId))
    .all();

  for (const ownerMembership of ownerTeams) {
    if (await hasPermission(userId, ownerMembership.teamId, 'view_transactions')) {
      if (context) {
        await logAuditEvent({
          userId,
          action: 'VIEW_TRANSACTIONS',
          entityType: 'account',
          entityId: accountId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: JSON.stringify({
            accessViaTeam: ownerMembership.teamId,
            requestPath: context.requestPath,
          }),
        });
      }
      return true;
    }
  }

  return false;
}

/**
 * Check if user can edit transactions for an account
 */
export async function canEditTransactions(
  userId: string,
  accountId: string,
  context?: PermissionCheckContext,
): Promise<boolean> {
  const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).get();

  if (!account) {
    return false;
  }

  if (account.userId === userId) {
    return true;
  }

  const ownerTeams = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, account.userId))
    .all();

  for (const ownerMembership of ownerTeams) {
    if (await hasPermission(userId, ownerMembership.teamId, 'edit_transactions')) {
      if (context) {
        await logAuditEvent({
          userId,
          action: 'EDIT_TRANSACTIONS',
          entityType: 'account',
          entityId: accountId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: JSON.stringify({
            accessViaTeam: ownerMembership.teamId,
            requestPath: context.requestPath,
          }),
        });
      }
      return true;
    }
  }

  return false;
}

// ============================================================================
// TEAM-LEVEL ACCESS CHECKS
// ============================================================================

/**
 * Check if user can view BAS for a team/user
 */
export async function canViewBAS(
  userId: string,
  teamId: string,
  context?: PermissionCheckContext,
): Promise<boolean> {
  const canView = await hasPermission(userId, teamId, 'view_bas');

  if (canView && context) {
    await logAuditEvent({
      userId,
      action: 'VIEW_BAS',
      entityType: 'team',
      entityId: teamId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: JSON.stringify({ requestPath: context.requestPath }),
    });
  }

  return canView;
}

/**
 * Check if user can export data for a team
 */
export async function canExportData(
  userId: string,
  teamId: string,
  context?: PermissionCheckContext,
): Promise<boolean> {
  const canExport = await hasPermission(userId, teamId, 'export_data');

  if (canExport && context) {
    await logAuditEvent({
      userId,
      action: 'EXPORT_DATA',
      entityType: 'team',
      entityId: teamId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: JSON.stringify({ requestPath: context.requestPath }),
    });
  }

  return canExport;
}

// ============================================================================
// ACCOUNT ACCESSIBILITY
// ============================================================================

/**
 * Get all accounts accessible to a user through team membership
 */
export async function getAccessibleAccounts(userId: string): Promise<
  Array<{
    account: typeof accounts.$inferSelect;
    accessVia: 'owner' | 'team';
    teamId?: string;
    teamName?: string;
    permissions: Permission[];
  }>
> {
  const result: Array<{
    account: typeof accounts.$inferSelect;
    accessVia: 'owner' | 'team';
    teamId?: string;
    teamName?: string;
    permissions: Permission[];
  }> = [];

  // Get directly owned accounts
  const ownedAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId)).all();

  for (const account of ownedAccounts) {
    result.push({
      account,
      accessVia: 'owner',
      permissions: ROLE_PERMISSIONS.owner,
    });
  }

  // Get accounts via team membership
  const userTeams = await getUserTeams(userId);

  for (const team of userTeams) {
    if (team.ownerId === userId) {
      continue;
    }

    const ownerAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, team.ownerId))
      .all();

    const permissions = await getUserPermissions(userId, team.id);

    for (const account of ownerAccounts) {
      if (!result.find((r) => r.account.id === account.id)) {
        result.push({
          account,
          accessVia: 'team',
          teamId: team.id,
          teamName: team.name,
          permissions,
        });
      }
    }
  }

  return result;
}

/**
 * Check if a user can access a specific account (either as owner or via team)
 */
export async function canAccessAccount(
  userId: string,
  accountId: string,
): Promise<{
  hasAccess: boolean;
  accessVia?: 'owner' | 'team';
  teamId?: string;
  permissions?: Permission[];
}> {
  const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).get();

  if (!account) {
    return { hasAccess: false };
  }

  if (account.userId === userId) {
    return {
      hasAccess: true,
      accessVia: 'owner',
      permissions: ROLE_PERMISSIONS.owner,
    };
  }

  const ownerTeams = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, account.userId))
    .all();

  for (const ownerMembership of ownerTeams) {
    const memberOfTeam = await isTeamMember(userId, ownerMembership.teamId);
    if (memberOfTeam) {
      const permissions = await getUserPermissions(userId, ownerMembership.teamId);
      return {
        hasAccess: true,
        accessVia: 'team',
        teamId: ownerMembership.teamId,
        permissions,
      };
    }
  }

  return { hasAccess: false };
}
