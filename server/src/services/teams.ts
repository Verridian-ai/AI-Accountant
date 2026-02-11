/**
 * Team/Shared Access Service for Accountant Collaboration
 *
 * Provides complete team management with:
 * - Role-based access control (Owner, Admin, Accountant, Viewer)
 * - Invitation system with secure email tokens
 * - Permission-based access control
 * - Comprehensive audit logging
 */

import { db, teams, teamMembers, teamInvitations, accounts, auditLog, users, transactions, statements, basPeriods } from '../schema.js';
import { eq, and, or, inArray, gte, lte, desc, isNull } from 'drizzle-orm';
import crypto from 'crypto';

// ============================================================================
// TYPES & ENUMS
// ============================================================================

export type TeamRole = 'owner' | 'admin' | 'accountant' | 'viewer';

export type Permission =
    | 'view_transactions'
    | 'edit_transactions'
    | 'delete_transactions'
    | 'view_statements'
    | 'upload_statements'
    | 'delete_statements'
    | 'view_accounts'
    | 'edit_accounts'
    | 'view_bas'
    | 'edit_bas'
    | 'submit_bas'
    | 'view_reports'
    | 'export_data'
    | 'manage_team'
    | 'invite_members'
    | 'remove_members'
    | 'edit_member_roles'
    | 'view_audit_log'
    | 'manage_settings';

export interface Team {
    id: string;
    name: string;
    ownerId: string;
    description?: string | null;
    settings?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface TeamMember {
    id: string;
    teamId: string;
    userId: string;
    role: TeamRole;
    permissions?: string | null;
    invitedBy?: string | null;
    joinedAt: string;
    lastAccessAt?: string | null;
}

export interface TeamInvitation {
    id: string;
    teamId: string;
    email: string;
    role: TeamRole;
    token: string;
    invitedBy: string;
    expiresAt: string;
    acceptedAt?: string | null;
    status: 'pending' | 'accepted' | 'expired' | 'revoked';
    createdAt: string;
}

export interface AuditLogEntry {
    id: string;
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: string | null;
    timestamp: string;
}

export interface CreateTeamOptions {
    name: string;
    description?: string;
    settings?: Record<string, unknown>;
}

export interface InviteMemberOptions {
    email: string;
    role: TeamRole;
    customPermissions?: Permission[];
}

export interface PermissionCheckContext {
    ipAddress?: string;
    userAgent?: string;
    requestPath?: string;
}

// ============================================================================
// ROLE PERMISSIONS MAPPING
// ============================================================================

/**
 * Default permissions for each role
 */
const ROLE_PERMISSIONS: Record<TeamRole, Permission[]> = {
    owner: [
        'view_transactions', 'edit_transactions', 'delete_transactions',
        'view_statements', 'upload_statements', 'delete_statements',
        'view_accounts', 'edit_accounts',
        'view_bas', 'edit_bas', 'submit_bas',
        'view_reports', 'export_data',
        'manage_team', 'invite_members', 'remove_members', 'edit_member_roles',
        'view_audit_log', 'manage_settings'
    ],
    admin: [
        'view_transactions', 'edit_transactions', 'delete_transactions',
        'view_statements', 'upload_statements', 'delete_statements',
        'view_accounts', 'edit_accounts',
        'view_bas', 'edit_bas', 'submit_bas',
        'view_reports', 'export_data',
        'invite_members', 'remove_members',
        'view_audit_log'
    ],
    accountant: [
        'view_transactions', 'edit_transactions',
        'view_statements', 'upload_statements',
        'view_accounts',
        'view_bas', 'edit_bas',
        'view_reports', 'export_data'
    ],
    viewer: [
        'view_transactions',
        'view_statements',
        'view_accounts',
        'view_bas',
        'view_reports'
    ]
};

// ============================================================================
// TEAM SERVICE CLASS
// ============================================================================

export class TeamService {

    // ------------------------------------------------------------------------
    // TEAM MANAGEMENT
    // ------------------------------------------------------------------------

    /**
     * Create a new team with the specified owner
     */
    async createTeam(ownerId: string, options: CreateTeamOptions): Promise<Team> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        const team: typeof teams.$inferInsert = {
            id,
            name: options.name,
            ownerId,
            description: options.description || null,
            settings: options.settings ? JSON.stringify(options.settings) : null,
            createdAt: now,
            updatedAt: now
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
            lastAccessAt: now
        });

        // Log the team creation
        await this.logAuditEvent({
            userId: ownerId,
            action: 'CREATE',
            entityType: 'team',
            entityId: id,
            newValue: JSON.stringify({ name: options.name, ownerId }),
            metadata: JSON.stringify({ description: options.description })
        });

        return {
            id,
            name: options.name,
            ownerId,
            description: options.description || null,
            settings: team.settings,
            createdAt: now,
            updatedAt: now
        };
    }

    /**
     * Get team by ID
     */
    async getTeam(teamId: string): Promise<Team | undefined> {
        const result = await db.select()
            .from(teams)
            .where(eq(teams.id, teamId))
            .get();
        return result as Team | undefined;
    }

    /**
     * Get all teams for a user (as member or owner)
     */
    async getUserTeams(userId: string): Promise<Array<Team & { role: TeamRole; memberCount: number }>> {
        // Get all team memberships for the user
        const memberships = await db.select()
            .from(teamMembers)
            .where(eq(teamMembers.userId, userId))
            .all();

        if (memberships.length === 0) {
            return [];
        }

        const teamIds = memberships.map((m: typeof teamMembers.$inferSelect) => m.teamId);
        const teamRoles = new Map(memberships.map((m: typeof teamMembers.$inferSelect) => [m.teamId, m.role as TeamRole]));

        // Get team details
        const teamList = await db.select()
            .from(teams)
            .where(inArray(teams.id, teamIds))
            .all();

        // Get member counts for each team
        const result: Array<Team & { role: TeamRole; memberCount: number }> = [];

        for (const team of teamList) {
            const members = await db.select()
                .from(teamMembers)
                .where(eq(teamMembers.teamId, team.id))
                .all();

            result.push({
                ...team as Team,
                role: (teamRoles.get(team.id) ?? 'viewer') as TeamRole,
                memberCount: members.length
            });
        }

        return result;
    }

    /**
     * Update team details
     */
    async updateTeam(
        teamId: string,
        actorId: string,
        updates: { name?: string; description?: string; settings?: Record<string, unknown> }
    ): Promise<Team | null> {
        // Verify actor has permission
        if (!(await this.canManageTeam(actorId, teamId))) {
            throw new Error('Permission denied: cannot manage team');
        }

        const existing = await this.getTeam(teamId);
        if (!existing) {
            return null;
        }

        const now = new Date().toISOString();
        const updateData: Partial<typeof teams.$inferInsert> = {
            updatedAt: now
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

        await db.update(teams)
            .set(updateData)
            .where(eq(teams.id, teamId));

        // Log the update
        await this.logAuditEvent({
            userId: actorId,
            action: 'UPDATE',
            entityType: 'team',
            entityId: teamId,
            oldValue: JSON.stringify(existing),
            newValue: JSON.stringify(updates)
        });

        return this.getTeam(teamId) as Promise<Team>;
    }

    /**
     * Delete a team (owner only)
     */
    async deleteTeam(teamId: string, actorId: string): Promise<boolean> {
        const team = await this.getTeam(teamId);
        if (!team) {
            return false;
        }

        // Only the owner can delete a team
        if (team.ownerId !== actorId) {
            throw new Error('Permission denied: only the team owner can delete the team');
        }

        // Delete all invitations
        await db.delete(teamInvitations)
            .where(eq(teamInvitations.teamId, teamId));

        // Delete all members
        await db.delete(teamMembers)
            .where(eq(teamMembers.teamId, teamId));

        // Delete the team
        await db.delete(teams)
            .where(eq(teams.id, teamId));

        // Log the deletion
        await this.logAuditEvent({
            userId: actorId,
            action: 'DELETE',
            entityType: 'team',
            entityId: teamId,
            oldValue: JSON.stringify(team)
        });

        return true;
    }

    // ------------------------------------------------------------------------
    // INVITATION MANAGEMENT
    // ------------------------------------------------------------------------

    /**
     * Generate a secure invitation token
     */
    private generateInvitationToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Invite a member to the team
     */
    async inviteMember(
        teamId: string,
        inviterId: string,
        options: InviteMemberOptions
    ): Promise<TeamInvitation> {
        // Verify inviter has permission
        if (!(await this.hasPermission(inviterId, teamId, 'invite_members'))) {
            throw new Error('Permission denied: cannot invite members');
        }

        // Check if user already has a pending invitation
        const existingInvitation = await db.select()
            .from(teamInvitations)
            .where(and(
                eq(teamInvitations.teamId, teamId),
                eq(teamInvitations.email, options.email.toLowerCase()),
                eq(teamInvitations.status, 'pending')
            ))
            .get();

        if (existingInvitation) {
            throw new Error('A pending invitation already exists for this email');
        }

        // Check if user is already a member
        const existingUser = await db.select()
            .from(users)
            .where(eq(users.username, options.email.toLowerCase()))
            .get();

        if (existingUser) {
            const existingMember = await db.select()
                .from(teamMembers)
                .where(and(
                    eq(teamMembers.teamId, teamId),
                    eq(teamMembers.userId, existingUser.id)
                ))
                .get();

            if (existingMember) {
                throw new Error('User is already a member of this team');
            }
        }

        // Prevent inviting as owner
        if (options.role === 'owner') {
            throw new Error('Cannot invite members with owner role');
        }

        const id = crypto.randomUUID();
        const token = this.generateInvitationToken();
        const now = new Date().toISOString();
        // Invitation expires in 7 days
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
            createdAt: now
        };

        await db.insert(teamInvitations).values(invitation);

        // Log the invitation
        await this.logAuditEvent({
            userId: inviterId,
            action: 'INVITE',
            entityType: 'team_invitation',
            entityId: id,
            newValue: JSON.stringify({
                teamId,
                email: options.email,
                role: options.role
            })
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
            createdAt: now
        };
    }

    /**
     * Accept an invitation to join a team
     * Security: Verifies that the accepting user's email matches the invitation email
     */
    async acceptInvitation(token: string, userId: string): Promise<TeamMember> {
        // Find the invitation
        const invitation = await db.select()
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
            await db.update(teamInvitations)
                .set({ status: 'expired' })
                .where(eq(teamInvitations.id, invitation.id));
            throw new Error('Invitation has expired');
        }

        // Verify the user exists and email matches the invitation
        const user = await db.select()
            .from(users)
            .where(eq(users.id, userId))
            .get();

        if (!user) {
            throw new Error('User not found');
        }

        // SECURITY: Verify that the accepting user's email matches the invitation email
        // This prevents users from accepting invitations meant for others
        const userEmail = user.username?.toLowerCase(); // username stores email in this schema
        const invitationEmail = invitation.email?.toLowerCase();

        if (!userEmail || !invitationEmail || userEmail !== invitationEmail) {
            // Log this security event for monitoring
            console.warn(`[TeamService] Invitation email mismatch: invitation was for ${invitationEmail}, but user ${userId} has email ${userEmail}`);
            throw new Error('This invitation was sent to a different email address');
        }

        // Check if already a member
        const existingMember = await db.select()
            .from(teamMembers)
            .where(and(
                eq(teamMembers.teamId, invitation.teamId),
                eq(teamMembers.userId, userId)
            ))
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
            lastAccessAt: now
        });

        // Update invitation status
        await db.update(teamInvitations)
            .set({
                status: 'accepted',
                acceptedAt: now
            })
            .where(eq(teamInvitations.id, invitation.id));

        // Log the acceptance
        await this.logAuditEvent({
            userId,
            action: 'ACCEPT_INVITATION',
            entityType: 'team_member',
            entityId: memberId,
            newValue: JSON.stringify({
                teamId: invitation.teamId,
                role,
                invitationId: invitation.id
            })
        });

        return {
            id: memberId,
            teamId: invitation.teamId,
            userId,
            role,
            permissions: JSON.stringify(permissions),
            invitedBy: invitation.invitedBy,
            joinedAt: now,
            lastAccessAt: now
        };
    }

    /**
     * Get pending invitations for a team
     */
    async getTeamInvitations(teamId: string, actorId: string): Promise<TeamInvitation[]> {
        // Verify actor has permission to view invitations
        if (!(await this.hasPermission(actorId, teamId, 'invite_members'))) {
            throw new Error('Permission denied: cannot view invitations');
        }

        const invitations = await db.select()
            .from(teamInvitations)
            .where(and(
                eq(teamInvitations.teamId, teamId),
                eq(teamInvitations.status, 'pending')
            ))
            .all();

        return invitations as TeamInvitation[];
    }

    /**
     * Revoke a pending invitation
     */
    async revokeInvitation(invitationId: string, actorId: string): Promise<boolean> {
        const invitation = await db.select()
            .from(teamInvitations)
            .where(eq(teamInvitations.id, invitationId))
            .get();

        if (!invitation) {
            return false;
        }

        // Verify actor has permission
        if (!(await this.hasPermission(actorId, invitation.teamId, 'invite_members'))) {
            throw new Error('Permission denied: cannot revoke invitations');
        }

        if (invitation.status !== 'pending') {
            throw new Error(`Cannot revoke invitation that is already ${invitation.status}`);
        }

        await db.update(teamInvitations)
            .set({ status: 'revoked' })
            .where(eq(teamInvitations.id, invitationId));

        // Log the revocation
        await this.logAuditEvent({
            userId: actorId,
            action: 'REVOKE_INVITATION',
            entityType: 'team_invitation',
            entityId: invitationId,
            oldValue: JSON.stringify(invitation)
        });

        return true;
    }

    /**
     * Get invitation by token (for acceptance flow)
     */
    async getInvitationByToken(token: string): Promise<(TeamInvitation & { teamName: string }) | null> {
        const invitation = await db.select()
            .from(teamInvitations)
            .where(eq(teamInvitations.token, token))
            .get();

        if (!invitation) {
            return null;
        }

        const team = await this.getTeam(invitation.teamId);
        if (!team) {
            return null;
        }

        return {
            ...invitation as TeamInvitation,
            teamName: team.name
        };
    }

    // ------------------------------------------------------------------------
    // MEMBER MANAGEMENT
    // ------------------------------------------------------------------------

    /**
     * Get all members of a team
     */
    async getTeamMembers(teamId: string, actorId?: string): Promise<Array<TeamMember & { username: string }>> {
        // If actorId is provided, verify they're a member
        if (actorId) {
            const isMember = await this.isTeamMember(actorId, teamId);
            if (!isMember) {
                throw new Error('Permission denied: not a team member');
            }
        }

        const members = await db.select({
            member: teamMembers,
            user: users
        })
            .from(teamMembers)
            .innerJoin(users, eq(teamMembers.userId, users.id))
            .where(eq(teamMembers.teamId, teamId))
            .all();

        return members.map((m: { member: typeof teamMembers.$inferSelect; user: typeof users.$inferSelect }) => ({
            ...m.member as TeamMember,
            username: m.user.username
        }));
    }

    /**
     * Remove a member from the team
     */
    async removeMember(teamId: string, userId: string, actorId: string): Promise<boolean> {
        // Get the member to be removed
        const member = await db.select()
            .from(teamMembers)
            .where(and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, userId)
            ))
            .get();

        if (!member) {
            return false;
        }

        // Cannot remove the owner
        if (member.role === 'owner') {
            throw new Error('Cannot remove the team owner');
        }

        // Verify actor has permission (or is removing themselves)
        if (actorId !== userId && !(await this.hasPermission(actorId, teamId, 'remove_members'))) {
            throw new Error('Permission denied: cannot remove members');
        }

        await db.delete(teamMembers)
            .where(eq(teamMembers.id, member.id));

        // Log the removal
        await this.logAuditEvent({
            userId: actorId,
            action: 'REMOVE_MEMBER',
            entityType: 'team_member',
            entityId: member.id,
            oldValue: JSON.stringify(member),
            metadata: JSON.stringify({ removedUserId: userId, removedByUserId: actorId })
        });

        return true;
    }

    /**
     * Update a member's role
     */
    async updateMemberRole(
        teamId: string,
        userId: string,
        newRole: TeamRole,
        actorId: string
    ): Promise<TeamMember | null> {
        // Verify actor has permission
        if (!(await this.hasPermission(actorId, teamId, 'edit_member_roles'))) {
            throw new Error('Permission denied: cannot edit member roles');
        }

        // Get the current member
        const member = await db.select()
            .from(teamMembers)
            .where(and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, userId)
            ))
            .get();

        if (!member) {
            return null;
        }

        // Cannot change owner's role
        if (member.role === 'owner') {
            throw new Error('Cannot change the team owner\'s role');
        }

        // Cannot promote to owner
        if (newRole === 'owner') {
            throw new Error('Cannot promote member to owner');
        }

        const oldRole = member.role;
        const newPermissions = ROLE_PERMISSIONS[newRole];

        await db.update(teamMembers)
            .set({
                role: newRole,
                permissions: JSON.stringify(newPermissions)
            })
            .where(eq(teamMembers.id, member.id));

        // Log the role change
        await this.logAuditEvent({
            userId: actorId,
            action: 'UPDATE_MEMBER_ROLE',
            entityType: 'team_member',
            entityId: member.id,
            oldValue: JSON.stringify({ role: oldRole }),
            newValue: JSON.stringify({ role: newRole }),
            metadata: JSON.stringify({ targetUserId: userId })
        });

        return {
            ...member,
            role: newRole,
            permissions: JSON.stringify(newPermissions)
        } as TeamMember;
    }

    /**
     * Update last access timestamp for a member
     */
    async updateMemberLastAccess(userId: string, teamId: string): Promise<void> {
        await db.update(teamMembers)
            .set({ lastAccessAt: new Date().toISOString() })
            .where(and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, userId)
            ));
    }

    // ------------------------------------------------------------------------
    // PERMISSION CHECKS
    // ------------------------------------------------------------------------

    /**
     * Check if a user is a member of a team
     */
    async isTeamMember(userId: string, teamId: string): Promise<boolean> {
        const member = await db.select()
            .from(teamMembers)
            .where(and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, userId)
            ))
            .get();
        return !!member;
    }

    /**
     * Get the user's role in a team
     */
    async getUserRole(userId: string, teamId: string): Promise<TeamRole | null> {
        const member = await db.select()
            .from(teamMembers)
            .where(and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, userId)
            ))
            .get();
        return member ? member.role as TeamRole : null;
    }

    /**
     * Check if a user has a specific permission in a team
     */
    async hasPermission(userId: string, teamId: string, permission: Permission): Promise<boolean> {
        const member = await db.select()
            .from(teamMembers)
            .where(and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, userId)
            ))
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
     * Check if user can view transactions for an account
     * Considers both direct ownership and team membership
     */
    async canViewTransactions(userId: string, accountId: string, context?: PermissionCheckContext): Promise<boolean> {
        // Check direct ownership
        const account = await db.select()
            .from(accounts)
            .where(eq(accounts.id, accountId))
            .get();

        if (!account) {
            return false;
        }

        // Direct owner can always view
        if (account.userId === userId) {
            return true;
        }

        // Check team access - find teams where the account owner has shared access
        const ownerTeams = await db.select()
            .from(teamMembers)
            .where(eq(teamMembers.userId, account.userId))
            .all();

        for (const ownerMembership of ownerTeams) {
            // Check if the requesting user is also a member of this team
            if (await this.hasPermission(userId, ownerMembership.teamId, 'view_transactions')) {
                // Log access for compliance
                if (context) {
                    await this.logAuditEvent({
                        userId,
                        action: 'VIEW_TRANSACTIONS',
                        entityType: 'account',
                        entityId: accountId,
                        ipAddress: context.ipAddress,
                        userAgent: context.userAgent,
                        metadata: JSON.stringify({
                            accessViaTeam: ownerMembership.teamId,
                            requestPath: context.requestPath
                        })
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
    async canEditTransactions(userId: string, accountId: string, context?: PermissionCheckContext): Promise<boolean> {
        // Check direct ownership
        const account = await db.select()
            .from(accounts)
            .where(eq(accounts.id, accountId))
            .get();

        if (!account) {
            return false;
        }

        // Direct owner can always edit
        if (account.userId === userId) {
            return true;
        }

        // Check team access
        const ownerTeams = await db.select()
            .from(teamMembers)
            .where(eq(teamMembers.userId, account.userId))
            .all();

        for (const ownerMembership of ownerTeams) {
            if (await this.hasPermission(userId, ownerMembership.teamId, 'edit_transactions')) {
                // Log access for compliance
                if (context) {
                    await this.logAuditEvent({
                        userId,
                        action: 'EDIT_TRANSACTIONS',
                        entityType: 'account',
                        entityId: accountId,
                        ipAddress: context.ipAddress,
                        userAgent: context.userAgent,
                        metadata: JSON.stringify({
                            accessViaTeam: ownerMembership.teamId,
                            requestPath: context.requestPath
                        })
                    });
                }
                return true;
            }
        }

        return false;
    }

    /**
     * Check if user can manage a team
     */
    async canManageTeam(userId: string, teamId: string): Promise<boolean> {
        return this.hasPermission(userId, teamId, 'manage_team');
    }

    /**
     * Check if user can view BAS for a team/user
     */
    async canViewBAS(userId: string, teamId: string, context?: PermissionCheckContext): Promise<boolean> {
        const canView = await this.hasPermission(userId, teamId, 'view_bas');

        if (canView && context) {
            await this.logAuditEvent({
                userId,
                action: 'VIEW_BAS',
                entityType: 'team',
                entityId: teamId,
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                metadata: JSON.stringify({ requestPath: context.requestPath })
            });
        }

        return canView;
    }

    /**
     * Check if user can export data for a team
     */
    async canExportData(userId: string, teamId: string, context?: PermissionCheckContext): Promise<boolean> {
        const canExport = await this.hasPermission(userId, teamId, 'export_data');

        if (canExport && context) {
            await this.logAuditEvent({
                userId,
                action: 'EXPORT_DATA',
                entityType: 'team',
                entityId: teamId,
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                metadata: JSON.stringify({ requestPath: context.requestPath })
            });
        }

        return canExport;
    }

    /**
     * Get all permissions for a user in a team
     */
    async getUserPermissions(userId: string, teamId: string): Promise<Permission[]> {
        const member = await db.select()
            .from(teamMembers)
            .where(and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, userId)
            ))
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

    // ------------------------------------------------------------------------
    // AUDIT LOGGING
    // ------------------------------------------------------------------------

    /**
     * Log an audit event
     */
    async logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<string> {
        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        await db.insert(auditLog).values({
            id,
            userId: entry.userId,
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId,
            oldValue: entry.oldValue,
            newValue: entry.newValue,
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent,
            metadata: entry.metadata,
            timestamp
        });

        return id;
    }

    /**
     * Get audit log entries for a team
     */
    async getTeamAuditLog(
        teamId: string,
        actorId: string,
        options?: {
            startDate?: string;
            endDate?: string;
            action?: string;
            entityType?: string;
            limit?: number;
            offset?: number;
        }
    ): Promise<AuditLogEntry[]> {
        // Verify actor has permission
        if (!(await this.hasPermission(actorId, teamId, 'view_audit_log'))) {
            throw new Error('Permission denied: cannot view audit log');
        }

        // Get all team members
        const members = await db.select()
            .from(teamMembers)
            .where(eq(teamMembers.teamId, teamId))
            .all();

        const memberIds = members.map((m: typeof teamMembers.$inferSelect) => m.userId);

        // Build query
        let query = db.select()
            .from(auditLog)
            .where(inArray(auditLog.userId, memberIds))
            .orderBy(desc(auditLog.timestamp));

        const results = await query.all();

        // Apply filters in memory (SQLite doesn't support complex dynamic queries well)
        let filtered = results;

        if (options?.startDate) {
            filtered = filtered.filter((e: typeof auditLog.$inferSelect) => e.timestamp >= options.startDate!);
        }
        if (options?.endDate) {
            filtered = filtered.filter((e: typeof auditLog.$inferSelect) => e.timestamp <= options.endDate!);
        }
        if (options?.action) {
            filtered = filtered.filter((e: typeof auditLog.$inferSelect) => e.action === options.action);
        }
        if (options?.entityType) {
            filtered = filtered.filter((e: typeof auditLog.$inferSelect) => e.entityType === options.entityType);
        }

        // Apply pagination
        const offset = options?.offset || 0;
        const limit = options?.limit || 100;
        filtered = filtered.slice(offset, offset + limit);

        return filtered as AuditLogEntry[];
    }

    /**
     * Get accountant access history (for compliance)
     */
    async getAccountantAccessHistory(
        teamId: string,
        actorId: string,
        options?: {
            userId?: string;
            startDate?: string;
            endDate?: string;
            limit?: number;
        }
    ): Promise<AuditLogEntry[]> {
        // Verify actor has permission
        if (!(await this.hasPermission(actorId, teamId, 'view_audit_log'))) {
            throw new Error('Permission denied: cannot view access history');
        }

        // Get accountant members
        const accountants = await db.select()
            .from(teamMembers)
            .where(and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.role, 'accountant')
            ))
            .all();

        if (accountants.length === 0) {
            return [];
        }

        const accountantIds = options?.userId
            ? accountants.filter((a: typeof teamMembers.$inferSelect) => a.userId === options.userId).map((a: typeof teamMembers.$inferSelect) => a.userId)
            : accountants.map((a: typeof teamMembers.$inferSelect) => a.userId);

        if (accountantIds.length === 0) {
            return [];
        }

        // Get audit entries for accountants
        const results = await db.select()
            .from(auditLog)
            .where(inArray(auditLog.userId, accountantIds))
            .orderBy(desc(auditLog.timestamp))
            .all();

        // Apply filters
        let filtered = results;

        if (options?.startDate) {
            filtered = filtered.filter((e: typeof auditLog.$inferSelect) => e.timestamp >= options.startDate!);
        }
        if (options?.endDate) {
            filtered = filtered.filter((e: typeof auditLog.$inferSelect) => e.timestamp <= options.endDate!);
        }

        // Apply limit
        const limit = options?.limit || 500;
        filtered = filtered.slice(0, limit);

        return filtered as AuditLogEntry[];
    }

    // ------------------------------------------------------------------------
    // TEAM ACCOUNT ACCESS
    // ------------------------------------------------------------------------

    /**
     * Get all accounts accessible to a user through team membership
     */
    async getAccessibleAccounts(userId: string): Promise<Array<{
        account: typeof accounts.$inferSelect;
        accessVia: 'owner' | 'team';
        teamId?: string;
        teamName?: string;
        permissions: Permission[];
    }>> {
        const result: Array<{
            account: typeof accounts.$inferSelect;
            accessVia: 'owner' | 'team';
            teamId?: string;
            teamName?: string;
            permissions: Permission[];
        }> = [];

        // Get directly owned accounts
        const ownedAccounts = await db.select()
            .from(accounts)
            .where(eq(accounts.userId, userId))
            .all();

        for (const account of ownedAccounts) {
            result.push({
                account,
                accessVia: 'owner',
                permissions: ROLE_PERMISSIONS.owner
            });
        }

        // Get accounts via team membership
        const userTeams = await this.getUserTeams(userId);

        for (const team of userTeams) {
            // Skip if user is the owner (already have their accounts)
            if (team.ownerId === userId) {
                continue;
            }

            // Get the owner's accounts
            const ownerAccounts = await db.select()
                .from(accounts)
                .where(eq(accounts.userId, team.ownerId))
                .all();

            const permissions = await this.getUserPermissions(userId, team.id);

            for (const account of ownerAccounts) {
                // Check if already added (prevent duplicates)
                if (!result.find(r => r.account.id === account.id)) {
                    result.push({
                        account,
                        accessVia: 'team',
                        teamId: team.id,
                        teamName: team.name,
                        permissions
                    });
                }
            }
        }

        return result;
    }

    /**
     * Check if a user can access a specific account (either as owner or via team)
     */
    async canAccessAccount(userId: string, accountId: string): Promise<{
        hasAccess: boolean;
        accessVia?: 'owner' | 'team';
        teamId?: string;
        permissions?: Permission[];
    }> {
        // Check direct ownership
        const account = await db.select()
            .from(accounts)
            .where(eq(accounts.id, accountId))
            .get();

        if (!account) {
            return { hasAccess: false };
        }

        // Direct owner
        if (account.userId === userId) {
            return {
                hasAccess: true,
                accessVia: 'owner',
                permissions: ROLE_PERMISSIONS.owner
            };
        }

        // Check team access
        const ownerTeams = await db.select()
            .from(teamMembers)
            .where(eq(teamMembers.userId, account.userId))
            .all();

        for (const ownerMembership of ownerTeams) {
            const isMember = await this.isTeamMember(userId, ownerMembership.teamId);
            if (isMember) {
                const permissions = await this.getUserPermissions(userId, ownerMembership.teamId);
                return {
                    hasAccess: true,
                    accessVia: 'team',
                    teamId: ownerMembership.teamId,
                    permissions
                };
            }
        }

        return { hasAccess: false };
    }

    // ------------------------------------------------------------------------
    // UTILITY METHODS
    // ------------------------------------------------------------------------

    /**
     * Transfer team ownership
     */
    async transferOwnership(teamId: string, currentOwnerId: string, newOwnerId: string): Promise<boolean> {
        const team = await this.getTeam(teamId);
        if (!team || team.ownerId !== currentOwnerId) {
            throw new Error('Only the current owner can transfer ownership');
        }

        // Verify new owner is a team member
        const newOwnerMember = await db.select()
            .from(teamMembers)
            .where(and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, newOwnerId)
            ))
            .get();

        if (!newOwnerMember) {
            throw new Error('New owner must be an existing team member');
        }

        const now = new Date().toISOString();

        // Update team owner
        await db.update(teams)
            .set({ ownerId: newOwnerId, updatedAt: now })
            .where(eq(teams.id, teamId));

        // Update member roles
        await db.update(teamMembers)
            .set({ role: 'admin', permissions: JSON.stringify(ROLE_PERMISSIONS.admin) })
            .where(and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, currentOwnerId)
            ));

        await db.update(teamMembers)
            .set({ role: 'owner', permissions: JSON.stringify(ROLE_PERMISSIONS.owner) })
            .where(and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, newOwnerId)
            ));

        // Log the transfer
        await this.logAuditEvent({
            userId: currentOwnerId,
            action: 'TRANSFER_OWNERSHIP',
            entityType: 'team',
            entityId: teamId,
            oldValue: JSON.stringify({ ownerId: currentOwnerId }),
            newValue: JSON.stringify({ ownerId: newOwnerId })
        });

        return true;
    }

    /**
     * Get team statistics
     */
    async getTeamStats(teamId: string): Promise<{
        memberCount: number;
        pendingInvitations: number;
        roleDistribution: Record<TeamRole, number>;
    }> {
        const members = await db.select()
            .from(teamMembers)
            .where(eq(teamMembers.teamId, teamId))
            .all();

        const invitations = await db.select()
            .from(teamInvitations)
            .where(and(
                eq(teamInvitations.teamId, teamId),
                eq(teamInvitations.status, 'pending')
            ))
            .all();

        const roleDistribution: Record<TeamRole, number> = {
            owner: 0,
            admin: 0,
            accountant: 0,
            viewer: 0
        };

        for (const member of members) {
            const role = member.role as TeamRole;
            roleDistribution[role] = (roleDistribution[role] || 0) + 1;
        }

        return {
            memberCount: members.length,
            pendingInvitations: invitations.length,
            roleDistribution
        };
    }

    /**
     * Cleanup expired invitations
     */
    async cleanupExpiredInvitations(): Promise<number> {
        const now = new Date().toISOString();

        const expired = await db.select()
            .from(teamInvitations)
            .where(and(
                eq(teamInvitations.status, 'pending'),
                lte(teamInvitations.expiresAt, now)
            ))
            .all();

        if (expired.length > 0) {
            await db.update(teamInvitations)
                .set({ status: 'expired' })
                .where(and(
                    eq(teamInvitations.status, 'pending'),
                    lte(teamInvitations.expiresAt, now)
                ));
        }

        return expired.length;
    }
}

// Export singleton instance
export const teamService = new TeamService();
