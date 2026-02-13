# Agent 6: User Management Builder

## Role
Build a user management service for admin CRUD operations, role assignment, permission management, and activity logging for the admin dashboard.

## Priority: WAVE 20 (After Agents 1, 2)

## Wait Condition
Check for `.agent-done-W20-01`, `.agent-done-W20-02` marker files before starting.

## Files to CREATE

### 1. `server/src/services/user-management.ts`
**Purpose**: Admin user CRUD, role management, and activity tracking
**Pattern**: Service class with database operations

- [ ] Create `UserManagementService` class:
  ```typescript
  import { AdminAuthService } from './admin-auth.js';

  class UserManagementService {
    private adminAuth: AdminAuthService;

    constructor(adminAuth: AdminAuthService) {
      this.adminAuth = adminAuth;
    }
  }
  ```

- [ ] **Admin CRUD**:

  `async createAdmin(data: CreateAdminInput, createdBy: string): Promise<AdminUser>`
  ```typescript
  interface CreateAdminInput {
    username: string;
    email: string;
    password: string;
    displayName?: string;
    role: 'super_admin' | 'admin' | 'viewer';
    permissions?: string[];
  }
  ```
  - Validate username uniqueness
  - Validate email uniqueness
  - Validate password policy via `adminAuth.validatePassword()`
  - Hash password via `adminAuth.hashPassword()`
  - Insert into `admin_users` table
  - Log creation to `user_activity_log`
  - If role is 'viewer', default permissions to `['view_metrics']`
  - If role is 'admin', default permissions to `['view_metrics', 'manage_agents', 'trigger_crawl', 'manage_scheduler']`
  - If role is 'super_admin', all permissions

  `async getAdmin(id: string): Promise<AdminUser | null>`
  - Fetch admin by ID, exclude `password_hash` from response

  `async updateAdmin(id: string, data: UpdateAdminInput, updatedBy: string): Promise<AdminUser>`
  ```typescript
  interface UpdateAdminInput {
    email?: string;
    displayName?: string;
    role?: string;
    permissions?: string[];
    isActive?: boolean;
  }
  ```
  - Validate email uniqueness if changed
  - Cannot change own role (prevent self-demotion)
  - Cannot deactivate self
  - Log update to `user_activity_log`

  `async deleteAdmin(id: string, deletedBy: string): Promise<void>`
  - Soft delete: set `is_active = false`
  - Cannot delete self
  - Cannot delete last super_admin
  - Log deletion to `user_activity_log`

  `async listAdmins(filters?: AdminListFilters): Promise<PaginatedResult<AdminUser>>`
  ```typescript
  interface AdminListFilters {
    role?: string;
    isActive?: boolean;
    search?: string;                  // search username, email, displayName
    sortBy?: 'username' | 'last_login_at' | 'created_at';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }
  ```
  - Never return `password_hash` in list responses

- [ ] **Role & Permission Management**:

  `async assignRole(adminId: string, role: string, assignedBy: string): Promise<void>`
  - Validate role is valid
  - Update `admin_users.role`
  - Auto-update default permissions for new role
  - Log to activity log

  `async updatePermissions(adminId: string, permissions: string[], updatedBy: string): Promise<void>`
  - Validate all permissions are in known list
  - Update `admin_users.permissions`
  - Log to activity log

  `async getAvailableRoles(): Promise<RoleDefinition[]>`
  ```typescript
  interface RoleDefinition {
    role: string;
    displayName: string;
    description: string;
    defaultPermissions: string[];
  }
  ```
  - Return: super_admin, admin, viewer with their default permissions

  `async getAvailablePermissions(): Promise<PermissionDefinition[]>`
  ```typescript
  interface PermissionDefinition {
    permission: string;
    displayName: string;
    description: string;
    category: string;
  }
  ```
  - Return all available permissions grouped by category:
    - User management: manage_users
    - Agent management: manage_agents
    - Cognee management: manage_cognee
    - System monitoring: view_metrics
    - Feature flags: manage_features
    - Data operations: trigger_crawl, manage_scheduler

- [ ] **Activity Logging**:

  `async logActivity(activity: ActivityLogInput): Promise<void>`
  ```typescript
  interface ActivityLogInput {
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
  ```
  - Insert into `user_activity_log` table
  - Non-blocking (fire and forget, don't fail if logging fails)

  `async getActivityLog(filters: ActivityLogFilters): Promise<PaginatedResult<UserActivityLog>>`
  ```typescript
  interface ActivityLogFilters {
    userId?: string;
    action?: string;
    resourceType?: string;
    from?: string;
    to?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }
  ```

  `async getActivitySummary(userId?: string, days?: number): Promise<ActivitySummary>`
  ```typescript
  interface ActivitySummary {
    totalActions: number;
    actionBreakdown: Record<string, number>;
    dailyActivity: Array<{ date: string; count: number }>;
    mostActiveHour: number;
    topResources: Array<{ type: string; count: number }>;
    lastActivity: string;
  }
  ```
  - Aggregate activity data for dashboard
  - Default last 30 days

- [ ] **Feature Flag Management**:

  `async getFeatureFlags(): Promise<FeatureFlag[]>`
  - Return all feature flags from `feature_flags` table

  `async getFeatureFlag(flagName: string): Promise<FeatureFlag | null>`
  - Return single flag by name

  `async isFeatureEnabled(flagName: string): Promise<boolean>`
  - Check if flag is enabled
  - Consider rollout percentage
  - Cache result for performance (TTL 60s)

  `async updateFeatureFlag(flagName: string, updates: FeatureFlagUpdate, updatedBy: string): Promise<FeatureFlag>`
  ```typescript
  interface FeatureFlagUpdate {
    isEnabled?: boolean;
    rolloutPercentage?: number;
    conditions?: Record<string, any>;
  }
  ```
  - Update flag in database
  - Log change to activity log
  - Clear cache for updated flag

  `async createFeatureFlag(data: CreateFeatureFlagInput, createdBy: string): Promise<FeatureFlag>`
  ```typescript
  interface CreateFeatureFlagInput {
    flagName: string;
    displayName: string;
    description?: string;
    isEnabled: boolean;
    rolloutPercentage?: number;
    category: string;
  }
  ```

- [ ] **Cleanup**: `async cleanupActivityLog(olderThanDays?: number): Promise<number>`
  - Delete activity logs older than specified days (default 90)
  - Return count of deleted records

## Files to MODIFY

None -- all endpoints wired by Agent 7.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `createAdmin()` creates admin with hashed password
- [ ] `listAdmins()` never exposes password_hash
- [ ] `updateAdmin()` prevents self-role-change
- [ ] `deleteAdmin()` prevents deleting last super_admin
- [ ] `assignRole()` auto-updates default permissions
- [ ] `logActivity()` creates records in user_activity_log
- [ ] `getActivitySummary()` returns correct aggregation
- [ ] `isFeatureEnabled()` checks flag status and rollout percentage
- [ ] `updateFeatureFlag()` persists changes and clears cache
- [ ] Activity log cleanup removes records older than retention period
- [ ] Create marker file: `.agent-done-W20-06`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W20-01`), Agent 2 (`.agent-done-W20-02`) for admin auth
- **Reuses**: AdminAuthService for password hashing, Drizzle ORM patterns
