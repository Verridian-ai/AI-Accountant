/**
 * Team/Shared Access Service for Accountant Collaboration
 *
 * Barrel exports + TeamService facade class that delegates to sub-modules.
 */

// Re-export all types
export type {
  TeamRole,
  Permission,
  Team,
  TeamMember,
  TeamInvitation,
  AuditLogEntry,
  CreateTeamOptions,
  InviteMemberOptions,
  PermissionCheckContext,
} from './types.js';

// Re-export permission utilities
export {
  ROLE_PERMISSIONS,
  isTeamMember,
  getUserRole,
  hasPermission,
  getUserPermissions,
  canManageTeam,
} from './permissions.js';

// Re-export access checks
export {
  canViewTransactions,
  canEditTransactions,
  canViewBAS,
  canExportData,
  getAccessibleAccounts,
  canAccessAccount,
} from './access-checks.js';

// Re-export team CRUD
export {
  createTeam,
  getTeam,
  getUserTeams,
  updateTeam,
  deleteTeam,
  transferOwnership,
  getTeamStats,
} from './team-crud.js';

// Re-export invitation service
export {
  inviteMember,
  getTeamInvitations,
  revokeInvitation,
  getInvitationByToken,
  cleanupExpiredInvitations,
} from './invitation-service.js';

// Re-export invitation acceptance
export { acceptInvitation } from './invitation-accept.js';

// Re-export member service
export {
  getTeamMembers,
  removeMember,
  updateMemberRole,
  updateMemberLastAccess,
} from './member-service.js';

// Re-export audit logger
export { logAuditEvent, getTeamAuditLog, getAccountantAccessHistory } from './audit-logger.js';

// Import sub-modules for the facade class
import * as teamCrud from './team-crud.js';
import * as invitationService from './invitation-service.js';
import * as memberService from './member-service.js';
import * as permissionsMod from './permissions.js';
import * as accessChecks from './access-checks.js';
import * as auditLogger from './audit-logger.js';

// ============================================================================
// TEAM SERVICE FACADE CLASS
// ============================================================================

/**
 * TeamService facade that delegates to sub-module functions.
 * Preserves the original class-based API for backward compatibility.
 */
export class TeamService {
  // Team CRUD
  createTeam = teamCrud.createTeam;
  getTeam = teamCrud.getTeam;
  getUserTeams = teamCrud.getUserTeams;
  updateTeam = teamCrud.updateTeam;
  deleteTeam = teamCrud.deleteTeam;
  transferOwnership = teamCrud.transferOwnership;
  getTeamStats = teamCrud.getTeamStats;

  // Invitations
  inviteMember = invitationService.inviteMember;
  acceptInvitation = invitationService.acceptInvitation;
  getTeamInvitations = invitationService.getTeamInvitations;
  revokeInvitation = invitationService.revokeInvitation;
  getInvitationByToken = invitationService.getInvitationByToken;
  cleanupExpiredInvitations = invitationService.cleanupExpiredInvitations;

  // Members
  getTeamMembers = memberService.getTeamMembers;
  removeMember = memberService.removeMember;
  updateMemberRole = memberService.updateMemberRole;
  updateMemberLastAccess = memberService.updateMemberLastAccess;

  // Permissions
  isTeamMember = permissionsMod.isTeamMember;
  getUserRole = permissionsMod.getUserRole;
  hasPermission = permissionsMod.hasPermission;
  getUserPermissions = permissionsMod.getUserPermissions;
  canManageTeam = permissionsMod.canManageTeam;

  // Access checks
  canViewTransactions = accessChecks.canViewTransactions;
  canEditTransactions = accessChecks.canEditTransactions;
  canViewBAS = accessChecks.canViewBAS;
  canExportData = accessChecks.canExportData;
  getAccessibleAccounts = accessChecks.getAccessibleAccounts;
  canAccessAccount = accessChecks.canAccessAccount;

  // Audit
  logAuditEvent = auditLogger.logAuditEvent;
  getTeamAuditLog = auditLogger.getTeamAuditLog;
  getAccountantAccessHistory = auditLogger.getAccountantAccessHistory;
}

// Export singleton instance
export const teamService = new TeamService();
