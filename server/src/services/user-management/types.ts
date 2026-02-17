/**
 * User Management Service — Type Definitions
 */

export interface CreateAdminInput {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  role: 'super_admin' | 'admin' | 'viewer';
  permissions?: string[];
}

export interface UpdateAdminInput {
  email?: string;
  displayName?: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
}

export interface AdminListFilters {
  role?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: 'username' | 'last_login_at' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ActivityLogInput {
  userId?: string;
  sessionId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  durationMs?: number;
  status?: 'success' | 'failure';
}

export interface ActivityLogFilters {
  userId?: string;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ActivitySummary {
  totalActions: number;
  actionBreakdown: Record<string, number>;
  dailyActivity: Array<{ date: string; count: number }>;
  mostActiveHour: number;
  topResources: Array<{ type: string; count: number }>;
  lastActivity: string;
}

export interface RoleDefinition {
  role: string;
  displayName: string;
  description: string;
  defaultPermissions: string[];
}

export interface PermissionDefinition {
  permission: string;
  displayName: string;
  description: string;
  category: string;
}

export interface CreateFeatureFlagInput {
  flagName: string;
  displayName: string;
  description?: string;
  isEnabled: boolean;
  rolloutPercentage?: number;
  category: string;
}

export interface FeatureFlagUpdate {
  isEnabled?: boolean;
  rolloutPercentage?: number;
  conditions?: Record<string, any>;
}
