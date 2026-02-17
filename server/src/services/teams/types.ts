/**
 * Team Service Types & Interfaces
 *
 * Shared type definitions for the team management sub-modules.
 */

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
