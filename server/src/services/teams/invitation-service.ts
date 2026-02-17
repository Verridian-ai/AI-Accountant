/**
 * Team Invitation Service
 *
 * Handles team invitations: create, revoke, and list.
 * Token lookup, acceptance, and cleanup in invitation-lookup.ts.
 */

import { db, teamMembers, teamInvitations, users } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import type { TeamInvitation, InviteMemberOptions } from './types.js';
import { hasPermission } from './permissions.js';
import { logAuditEvent } from './audit-logger.js';

/** Generate a secure invitation token */
function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Invite a member to the team */
export async function inviteMember(
  teamId: string,
  inviterId: string,
  options: InviteMemberOptions,
): Promise<TeamInvitation> {
  if (!(await hasPermission(inviterId, teamId, 'invite_members'))) {
    throw new Error('Permission denied: cannot invite members');
  }

  const existingInvitation = await db
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.email, options.email.toLowerCase()),
        eq(teamInvitations.status, 'pending'),
      ),
    )
    .get();

  if (existingInvitation) {
    throw new Error('A pending invitation already exists for this email');
  }

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.username, options.email.toLowerCase()))
    .get();

  if (existingUser) {
    const existingMember = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, existingUser.id)))
      .get();

    if (existingMember) {
      throw new Error('User is already a member of this team');
    }
  }

  if (options.role === 'owner') {
    throw new Error('Cannot invite members with owner role');
  }

  const id = crypto.randomUUID();
  const token = generateInvitationToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const invitation: typeof teamInvitations.$inferInsert = {
    id,
    teamId,
    email: options.email.toLowerCase(),
    role: options.role,
    token,
    invitedBy: inviterId,
    expiresAt,
    acceptedAt: null,
    status: 'pending',
    createdAt: now,
  };

  await db.insert(teamInvitations).values(invitation);

  await logAuditEvent({
    userId: inviterId,
    action: 'INVITE',
    entityType: 'team_invitation',
    entityId: id,
    newValue: JSON.stringify({ teamId, email: options.email, role: options.role }),
  });

  return {
    id,
    teamId,
    email: options.email.toLowerCase(),
    role: options.role,
    token,
    invitedBy: inviterId,
    expiresAt,
    acceptedAt: null,
    status: 'pending',
    createdAt: now,
  };
}

/** Get pending invitations for a team */
export async function getTeamInvitations(
  teamId: string,
  actorId: string,
): Promise<TeamInvitation[]> {
  if (!(await hasPermission(actorId, teamId, 'invite_members'))) {
    throw new Error('Permission denied: cannot view invitations');
  }

  const invitations = await db
    .select()
    .from(teamInvitations)
    .where(and(eq(teamInvitations.teamId, teamId), eq(teamInvitations.status, 'pending')))
    .all();

  return invitations as TeamInvitation[];
}

/** Revoke a pending invitation */
export async function revokeInvitation(invitationId: string, actorId: string): Promise<boolean> {
  const invitation = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.id, invitationId))
    .get();

  if (!invitation) return false;

  if (!(await hasPermission(actorId, invitation.teamId, 'invite_members'))) {
    throw new Error('Permission denied: cannot revoke invitations');
  }

  if (invitation.status !== 'pending') {
    throw new Error(`Cannot revoke invitation that is already ${invitation.status}`);
  }

  await db
    .update(teamInvitations)
    .set({ status: 'revoked' })
    .where(eq(teamInvitations.id, invitationId));

  await logAuditEvent({
    userId: actorId,
    action: 'REVOKE_INVITATION',
    entityType: 'team_invitation',
    entityId: invitationId,
    oldValue: JSON.stringify(invitation),
  });

  return true;
}

// Re-export lookup, acceptance, and cleanup for backward compatibility
export {
  getInvitationByToken,
  acceptInvitation,
  cleanupExpiredInvitations,
} from './invitation-lookup.js';
