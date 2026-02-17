/**
 * Team Member Service
 *
 * Handles team member operations: list, remove, update role, update access.
 */

import { db, teamMembers, users } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import type { TeamRole, TeamMember } from './types.js';
import { ROLE_PERMISSIONS, hasPermission, isTeamMember } from './permissions.js';
import { logAuditEvent } from './audit-logger.js';

// ============================================================================
// MEMBER MANAGEMENT
// ============================================================================

/**
 * Get all members of a team
 */
export async function getTeamMembers(
  teamId: string,
  actorId?: string,
): Promise<Array<TeamMember & { username: string }>> {
  // If actorId is provided, verify they're a member
  if (actorId) {
    const memberCheck = await isTeamMember(actorId, teamId);
    if (!memberCheck) {
      throw new Error('Permission denied: not a team member');
    }
  }

  const members = await db
    .select({
      member: teamMembers,
      user: users,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))
    .all();

  return members.map(
    (m: { member: typeof teamMembers.$inferSelect; user: typeof users.$inferSelect }) => ({
      ...(m.member as TeamMember),
      username: m.user.username,
    }),
  );
}

/**
 * Remove a member from the team
 */
export async function removeMember(
  teamId: string,
  userId: string,
  actorId: string,
): Promise<boolean> {
  // Get the member to be removed
  const member = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .get();

  if (!member) {
    return false;
  }

  // Cannot remove the owner
  if (member.role === 'owner') {
    throw new Error('Cannot remove the team owner');
  }

  // Verify actor has permission (or is removing themselves)
  if (actorId !== userId && !(await hasPermission(actorId, teamId, 'remove_members'))) {
    throw new Error('Permission denied: cannot remove members');
  }

  await db.delete(teamMembers).where(eq(teamMembers.id, member.id));

  // Log the removal
  await logAuditEvent({
    userId: actorId,
    action: 'REMOVE_MEMBER',
    entityType: 'team_member',
    entityId: member.id,
    oldValue: JSON.stringify(member),
    metadata: JSON.stringify({ removedUserId: userId, removedByUserId: actorId }),
  });

  return true;
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
  teamId: string,
  userId: string,
  newRole: TeamRole,
  actorId: string,
): Promise<TeamMember | null> {
  // Verify actor has permission
  if (!(await hasPermission(actorId, teamId, 'edit_member_roles'))) {
    throw new Error('Permission denied: cannot edit member roles');
  }

  // Get the current member
  const member = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .get();

  if (!member) {
    return null;
  }

  // Cannot change owner's role
  if (member.role === 'owner') {
    throw new Error("Cannot change the team owner's role");
  }

  // Cannot promote to owner
  if (newRole === 'owner') {
    throw new Error('Cannot promote member to owner');
  }

  const oldRole = member.role;
  const newPermissions = ROLE_PERMISSIONS[newRole];

  await db
    .update(teamMembers)
    .set({
      role: newRole,
      permissions: JSON.stringify(newPermissions),
    })
    .where(eq(teamMembers.id, member.id));

  // Log the role change
  await logAuditEvent({
    userId: actorId,
    action: 'UPDATE_MEMBER_ROLE',
    entityType: 'team_member',
    entityId: member.id,
    oldValue: JSON.stringify({ role: oldRole }),
    newValue: JSON.stringify({ role: newRole }),
    metadata: JSON.stringify({ targetUserId: userId }),
  });

  return {
    ...member,
    role: newRole,
    permissions: JSON.stringify(newPermissions),
  } as TeamMember;
}

/**
 * Update last access timestamp for a member
 */
export async function updateMemberLastAccess(userId: string, teamId: string): Promise<void> {
  await db
    .update(teamMembers)
    .set({ lastAccessAt: new Date().toISOString() })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
}
