/**
 * Team CRUD Operations
 *
 * Create, read, update, delete teams; list user teams;
 * transfer ownership; team statistics.
 */

import { db, teams, teamMembers, teamInvitations } from '../../schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import type { Team, TeamRole, CreateTeamOptions } from './types.js';
import { ROLE_PERMISSIONS, canManageTeam } from './permissions.js';
import { logAuditEvent } from './audit-logger.js';

// ============================================================================
// TEAM MANAGEMENT
// ============================================================================

/**
 * Create a new team with the specified owner
 */
export async function createTeam(ownerId: string, options: CreateTeamOptions): Promise<Team> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const team: typeof teams.$inferInsert = {
    id,
    name: options.name,
    ownerId,
    description: options.description || null,
    settings: options.settings ? JSON.stringify(options.settings) : null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(teams).values(team);

  // Automatically add the owner as a team member
  await db.insert(teamMembers).values({
    id: crypto.randomUUID(),
    teamId: id,
    userId: ownerId,
    role: 'owner',
    permissions: JSON.stringify(ROLE_PERMISSIONS.owner),
    invitedBy: null,
    joinedAt: now,
    lastAccessAt: now,
  });

  // Log the team creation
  await logAuditEvent({
    userId: ownerId,
    action: 'CREATE',
    entityType: 'team',
    entityId: id,
    newValue: JSON.stringify({ name: options.name, ownerId }),
    metadata: JSON.stringify({ description: options.description }),
  });

  return {
    id,
    name: options.name,
    ownerId,
    description: options.description || null,
    settings: team.settings,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get team by ID
 */
export async function getTeam(teamId: string): Promise<Team | undefined> {
  const result = await db.select().from(teams).where(eq(teams.id, teamId)).get();
  return result as Team | undefined;
}

/**
 * Get all teams for a user (as member or owner)
 */
export async function getUserTeams(
  userId: string,
): Promise<Array<Team & { role: TeamRole; memberCount: number }>> {
  // Get all team memberships for the user
  const memberships = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .all();

  if (memberships.length === 0) {
    return [];
  }

  const teamIds = memberships.map((m: typeof teamMembers.$inferSelect) => m.teamId);
  const teamRoles = new Map(
    memberships.map((m: typeof teamMembers.$inferSelect) => [m.teamId, m.role as TeamRole]),
  );

  // Get team details
  const teamList = await db.select().from(teams).where(inArray(teams.id, teamIds)).all();

  // Get member counts for each team
  const result: Array<Team & { role: TeamRole; memberCount: number }> = [];

  for (const team of teamList) {
    const members = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, team.id))
      .all();

    result.push({
      ...(team as Team),
      role: (teamRoles.get(team.id) ?? 'viewer') as TeamRole,
      memberCount: members.length,
    });
  }

  return result;
}

/**
 * Update team details
 */
export async function updateTeam(
  teamId: string,
  actorId: string,
  updates: { name?: string; description?: string; settings?: Record<string, unknown> },
): Promise<Team | null> {
  // Verify actor has permission
  if (!(await canManageTeam(actorId, teamId))) {
    throw new Error('Permission denied: cannot manage team');
  }

  const existing = await getTeam(teamId);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const updateData: Partial<typeof teams.$inferInsert> = {
    updatedAt: now,
  };

  if (updates.name !== undefined) {
    updateData.name = updates.name;
  }
  if (updates.description !== undefined) {
    updateData.description = updates.description;
  }
  if (updates.settings !== undefined) {
    updateData.settings = JSON.stringify(updates.settings);
  }

  await db.update(teams).set(updateData).where(eq(teams.id, teamId));

  // Log the update
  await logAuditEvent({
    userId: actorId,
    action: 'UPDATE',
    entityType: 'team',
    entityId: teamId,
    oldValue: JSON.stringify(existing),
    newValue: JSON.stringify(updates),
  });

  return getTeam(teamId) as Promise<Team>;
}

/**
 * Delete a team (owner only)
 */
export async function deleteTeam(teamId: string, actorId: string): Promise<boolean> {
  const team = await getTeam(teamId);
  if (!team) {
    return false;
  }

  // Only the owner can delete a team
  if (team.ownerId !== actorId) {
    throw new Error('Permission denied: only the team owner can delete the team');
  }

  // Delete all invitations
  await db.delete(teamInvitations).where(eq(teamInvitations.teamId, teamId));

  // Delete all members
  await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));

  // Delete the team
  await db.delete(teams).where(eq(teams.id, teamId));

  // Log the deletion
  await logAuditEvent({
    userId: actorId,
    action: 'DELETE',
    entityType: 'team',
    entityId: teamId,
    oldValue: JSON.stringify(team),
  });

  return true;
}

/**
 * Transfer team ownership
 */
export async function transferOwnership(
  teamId: string,
  currentOwnerId: string,
  newOwnerId: string,
): Promise<boolean> {
  const team = await getTeam(teamId);
  if (!team || team.ownerId !== currentOwnerId) {
    throw new Error('Only the current owner can transfer ownership');
  }

  // Verify new owner is a team member
  const newOwnerMember = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, newOwnerId)))
    .get();

  if (!newOwnerMember) {
    throw new Error('New owner must be an existing team member');
  }

  const now = new Date().toISOString();

  // Update team owner
  await db.update(teams).set({ ownerId: newOwnerId, updatedAt: now }).where(eq(teams.id, teamId));

  // Update member roles
  await db
    .update(teamMembers)
    .set({ role: 'admin', permissions: JSON.stringify(ROLE_PERMISSIONS.admin) })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, currentOwnerId)));

  await db
    .update(teamMembers)
    .set({ role: 'owner', permissions: JSON.stringify(ROLE_PERMISSIONS.owner) })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, newOwnerId)));

  // Log the transfer
  await logAuditEvent({
    userId: currentOwnerId,
    action: 'TRANSFER_OWNERSHIP',
    entityType: 'team',
    entityId: teamId,
    oldValue: JSON.stringify({ ownerId: currentOwnerId }),
    newValue: JSON.stringify({ ownerId: newOwnerId }),
  });

  return true;
}

/**
 * Get team statistics
 */
export async function getTeamStats(teamId: string): Promise<{
  memberCount: number;
  pendingInvitations: number;
  roleDistribution: Record<TeamRole, number>;
}> {
  const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId)).all();

  const invitations = await db
    .select()
    .from(teamInvitations)
    .where(and(eq(teamInvitations.teamId, teamId), eq(teamInvitations.status, 'pending')))
    .all();

  const roleDistribution: Record<TeamRole, number> = {
    owner: 0,
    admin: 0,
    accountant: 0,
    viewer: 0,
  };

  for (const member of members) {
    const role = member.role as TeamRole;
    roleDistribution[role] = (roleDistribution[role] || 0) + 1;
  }

  return {
    memberCount: members.length,
    pendingInvitations: invitations.length,
    roleDistribution,
  };
}
