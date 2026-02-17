/**
 * Team Invitation Acceptance
 *
 * Handles the secure acceptance flow for team invitations.
 */

import { db, teamMembers, teamInvitations, users } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { logger } from '../../lib/logger.js';
import type { TeamRole, TeamMember } from './types.js';
import { ROLE_PERMISSIONS } from './permissions.js';
import { logAuditEvent } from './audit-logger.js';

// ============================================================================
// INVITATION ACCEPTANCE
// ============================================================================

/**
 * Accept an invitation to join a team
 * Security: Verifies that the accepting user's email matches the invitation email
 */
export async function acceptInvitation(token: string, userId: string): Promise<TeamMember> {
  // Find the invitation
  const invitation = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.token, token))
    .get();

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new Error(`Invitation has already been ${invitation.status}`);
  }

  // Check if invitation has expired
  if (new Date(invitation.expiresAt) < new Date()) {
    // Mark as expired
    await db
      .update(teamInvitations)
      .set({ status: 'expired' })
      .where(eq(teamInvitations.id, invitation.id));
    throw new Error('Invitation has expired');
  }

  // Verify the user exists and email matches the invitation
  const user = await db.select().from(users).where(eq(users.id, userId)).get();

  if (!user) {
    throw new Error('User not found');
  }

  // SECURITY: Verify that the accepting user's email matches the invitation email
  // This prevents users from accepting invitations meant for others
  const userEmail = user.username?.toLowerCase(); // username stores email in this schema
  const invitationEmail = invitation.email?.toLowerCase();

  if (!userEmail || !invitationEmail || userEmail !== invitationEmail) {
    // Log this security event for monitoring
    logger.warn(
      `[TeamService] Invitation email mismatch: invitation was for ${invitationEmail}, but user ${userId} has email ${userEmail}`,
    );
    throw new Error('This invitation was sent to a different email address');
  }

  // Check if already a member
  const existingMember = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, invitation.teamId), eq(teamMembers.userId, userId)))
    .get();

  if (existingMember) {
    throw new Error('You are already a member of this team');
  }

  const now = new Date().toISOString();

  // Create team membership
  const memberId = crypto.randomUUID();
  const role = invitation.role as TeamRole;
  const permissions = ROLE_PERMISSIONS[role];

  await db.insert(teamMembers).values({
    id: memberId,
    teamId: invitation.teamId,
    userId,
    role,
    permissions: JSON.stringify(permissions),
    invitedBy: invitation.invitedBy,
    joinedAt: now,
    lastAccessAt: now,
  });

  // Update invitation status
  await db
    .update(teamInvitations)
    .set({
      status: 'accepted',
      acceptedAt: now,
    })
    .where(eq(teamInvitations.id, invitation.id));

  // Log the acceptance
  await logAuditEvent({
    userId,
    action: 'ACCEPT_INVITATION',
    entityType: 'team_member',
    entityId: memberId,
    newValue: JSON.stringify({
      teamId: invitation.teamId,
      role,
      invitationId: invitation.id,
    }),
  });

  return {
    id: memberId,
    teamId: invitation.teamId,
    userId,
    role,
    permissions: JSON.stringify(permissions),
    invitedBy: invitation.invitedBy,
    joinedAt: now,
    lastAccessAt: now,
  };
}
