/**
 * Team Invitation Lookup — Token lookup, acceptance, and cleanup.
 */

import { db, teamMembers, teamInvitations } from '../../schema.js';
import { eq, and, lte } from 'drizzle-orm';
import crypto from 'crypto';
import type { TeamInvitation } from './types.js';
import { logAuditEvent } from './audit-logger.js';
import { getTeam } from './team-crud.js';

/** Get invitation by token (for acceptance flow) */
export async function getInvitationByToken(
  token: string,
): Promise<(TeamInvitation & { teamName: string }) | null> {
  const invitation = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.token, token))
    .get();

  if (!invitation) return null;

  const team = await getTeam(invitation.teamId);
  if (!team) return null;

  return { ...(invitation as TeamInvitation), teamName: team.name };
}

/** Accept a team invitation by token */
export async function acceptInvitation(token: string, userId: string): Promise<boolean> {
  const invitation = await db
    .select()
    .from(teamInvitations)
    .where(and(eq(teamInvitations.token, token), eq(teamInvitations.status, 'pending')))
    .get();

  if (!invitation) throw new Error('Invitation not found or already used');

  if (new Date(invitation.expiresAt) < new Date()) {
    await db
      .update(teamInvitations)
      .set({ status: 'expired' })
      .where(eq(teamInvitations.id, invitation.id));
    throw new Error('Invitation has expired');
  }

  const existingMember = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, invitation.teamId), eq(teamMembers.userId, userId)))
    .get();

  if (existingMember) throw new Error('You are already a member of this team');

  const memberId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(teamMembers).values({
    id: memberId,
    teamId: invitation.teamId,
    userId,
    role: invitation.role,
    joinedAt: now,
  });

  await db
    .update(teamInvitations)
    .set({ status: 'accepted', acceptedAt: now })
    .where(eq(teamInvitations.id, invitation.id));

  await logAuditEvent({
    userId,
    action: 'ACCEPT_INVITATION',
    entityType: 'team_invitation',
    entityId: invitation.id,
    newValue: JSON.stringify({ teamId: invitation.teamId, role: invitation.role }),
  });

  return true;
}

/** Cleanup expired invitations */
export async function cleanupExpiredInvitations(): Promise<number> {
  const now = new Date().toISOString();

  const expired = await db
    .select()
    .from(teamInvitations)
    .where(and(eq(teamInvitations.status, 'pending'), lte(teamInvitations.expiresAt, now)))
    .all();

  if (expired.length > 0) {
    await db
      .update(teamInvitations)
      .set({ status: 'expired' })
      .where(and(eq(teamInvitations.status, 'pending'), lte(teamInvitations.expiresAt, now)));
  }

  return expired.length;
}
