# Agent 3: RBAC Service Builder

## Role
Build the Role-Based Access Control (RBAC) service for checking permissions, assigning roles, and managing the permission matrix across tenants.

## Priority: WAVE 23 (After Agent 2)

## Wait Condition
Check for `.agent-done-W23-02` marker file before starting.

## Files to CREATE

### 1. `server/src/services/rbac.ts`
**Purpose**: RBAC enforcement service
**Pattern**: Follow existing service patterns

- [ ] Create `RBACService` class with methods:

  **Permission Checking**:
  - `checkPermission(tenantId, userId, permission: string): Promise<boolean>` -- looks up user's role in `tenant_members`, then checks `role_permissions` for that role+permission. Returns true if granted. Caches per request.
  - `checkPermissions(tenantId, userId, permissions: string[]): Promise<Record<string, boolean>>` -- batch check multiple permissions
  - `requirePermission(tenantId, userId, permission: string): Promise<void>` -- throws `ForbiddenError` if not granted
  - `getUserPermissions(tenantId, userId): Promise<string[]>` -- returns all permission names for user's role in tenant

  **Role Assignment**:
  - `assignRole(tenantId, userId, role: TenantRole, assignedBy: string): Promise<void>` -- validates assigner has 'members.manage' permission, validates role transition rules (only owners can create other owners), updates `tenant_members.role`
  - `getRoleForUser(tenantId, userId): Promise<TenantRole | null>` -- returns user's role in tenant
  - `getUsersWithRole(tenantId, role: TenantRole): Promise<TenantMember[]>` -- list all members with specific role

  **Permission Matrix**:
  - `getPermissionMatrix(tenantId): Promise<Record<TenantRole, string[]>>` -- returns all role->permission mappings for tenant
  - `updateRolePermissions(tenantId, role: TenantRole, permissions: string[], updatedBy: string): Promise<void>` -- replaces all permissions for a role (owner only). Cannot modify system permissions mapping.
  - `resetToDefaults(tenantId): Promise<void>` -- resets all role_permissions to defaults from `tenant-defaults.ts`

  **Middleware Helpers**:
  - `createPermissionMiddleware(permission: string): HonoMiddleware` -- returns Hono middleware that extracts tenantId from `X-Tenant-Id` header and userId from JWT, calls `requirePermission`, returns 403 on failure
  - `createRoleMiddleware(minRole: TenantRole): HonoMiddleware` -- checks user has at least the specified role level (owner > admin > accountant > bookkeeper > viewer)

### 2. `server/src/services/rbac-errors.ts`
**Purpose**: RBAC-specific error types

```typescript
export class ForbiddenError extends Error {
  constructor(
    public permission: string,
    public tenantId: string,
    public userId: string,
  ) {
    super(`User ${userId} lacks permission '${permission}' in tenant ${tenantId}`);
    this.name = 'ForbiddenError';
  }
}

export class InsufficientRoleError extends Error {
  constructor(
    public requiredRole: string,
    public actualRole: string,
  ) {
    super(`Required role '${requiredRole}', but user has '${actualRole}'`);
    this.name = 'InsufficientRoleError';
  }
}
```

- [ ] Define `ForbiddenError` and `InsufficientRoleError` classes

### 3. `server/src/services/rbac-cache.ts`
**Purpose**: In-memory permission cache to avoid repeated DB queries

- [ ] Create `PermissionCache` class:
  - LRU cache with TTL of 60 seconds
  - Key: `${tenantId}:${userId}` -> `string[]` (permission list)
  - Methods: `get(tenantId, userId)`, `set(tenantId, userId, permissions)`, `invalidate(tenantId, userId)`, `invalidateTenant(tenantId)`, `clear()`
  - Max entries: 1000
- [ ] Cache invalidated when: role changes, permissions updated, member removed

## Files to MODIFY

### 4. `server/src/services/tenant.ts`
- [ ] In `updateMemberRole()`: invalidate RBAC cache for affected user
- [ ] In `removeMember()`: invalidate RBAC cache for removed user

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `checkPermission()` returns true for granted permissions, false for denied
- [ ] `requirePermission()` throws `ForbiddenError` for denied permissions
- [ ] `assignRole()` prevents non-owners from creating owners
- [ ] `getPermissionMatrix()` returns complete role-permission mapping
- [ ] Permission middleware returns 403 with descriptive error for unauthorized requests
- [ ] Cache invalidation works on role change and member removal
- [ ] Role hierarchy: owner > admin > accountant > bookkeeper > viewer
- [ ] Create marker file: `.agent-done-W23-03`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-W23-02`) for tenant service and types
- **Reuses**: Drizzle ORM, tenant-defaults.ts
