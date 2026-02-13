/**
 * RBAC Error Types
 * Custom error classes for permission and role enforcement failures.
 */

/**
 * Thrown when a user attempts an action they don't have permission for.
 */
export class ForbiddenError extends Error {
  public readonly permission: string;
  public readonly tenantId: string;
  public readonly userId: string;

  constructor(permission: string, tenantId: string, userId: string) {
    super(`User ${userId} lacks permission '${permission}' in tenant ${tenantId}`);
    this.name = 'ForbiddenError';
    this.permission = permission;
    this.tenantId = tenantId;
    this.userId = userId;
  }
}

/**
 * Thrown when a user's role is below the minimum required level.
 */
export class InsufficientRoleError extends Error {
  public readonly requiredRole: string;
  public readonly actualRole: string;

  constructor(requiredRole: string, actualRole: string) {
    super(`Required role '${requiredRole}', but user has '${actualRole}'`);
    this.name = 'InsufficientRoleError';
    this.requiredRole = requiredRole;
    this.actualRole = actualRole;
  }
}
