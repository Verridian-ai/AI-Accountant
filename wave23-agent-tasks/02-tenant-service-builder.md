# Agent 2: Tenant Service Builder

## Role
Build the core tenant management service with methods for creating, updating, and managing tenants and their members.

## Priority: WAVE 23 (After Agent 1)

## Wait Condition
Check for `.agent-done-W23-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/tenant.ts`
**Purpose**: Core tenant management service
**Pattern**: Follow existing service patterns (e.g., `server/src/services/accounts.ts`)

- [ ] Create `TenantService` class with methods:

  **Tenant CRUD**:
  - `createTenant(name, slug, options?: {abn, entityType, industry, financialYearEnd}): Promise<Tenant>` -- inserts into `tenants` table, creates default role_permissions for all 5 roles, creates first member as 'owner'
  - `updateTenant(tenantId, updates): Promise<Tenant>` -- partial update of name, logo_url, settings_json, etc.
  - `getTenant(tenantId): Promise<Tenant | null>` -- single tenant with member count
  - `getTenantBySlug(slug): Promise<Tenant | null>` -- lookup by URL slug
  - `deactivateTenant(tenantId): Promise<void>` -- sets is_active=false (soft delete)

  **Member Management**:
  - `addMember(tenantId, userId, role): Promise<TenantMember>` -- inserts into `tenant_members`, validates role, checks subscription member limit
  - `removeMember(tenantId, userId): Promise<void>` -- deletes from `tenant_members`, prevents removing last owner
  - `updateMemberRole(tenantId, userId, newRole): Promise<TenantMember>` -- validates role transition (cannot demote last owner)
  - `getMembers(tenantId): Promise<TenantMember[]>` -- list all members with user details
  - `getMemberTenants(userId): Promise<Array<{tenant: Tenant, role: string}>>` -- list all tenants a user belongs to

  **Invitation Management**:
  - `inviteMember(tenantId, email, role, invitedBy): Promise<TenantInvitation>` -- generates secure token (crypto.randomUUID), sets 7-day expiry, stores in `tenant_invitations`
  - `acceptInvitation(token): Promise<{tenant: Tenant, member: TenantMember}>` -- validates token, checks not expired/revoked, creates member, updates invitation status
  - `revokeInvitation(invitationId): Promise<void>` -- sets status to 'revoked'
  - `getPendingInvitations(tenantId): Promise<TenantInvitation[]>` -- list pending invitations
  - `cleanupExpiredInvitations(): Promise<number>` -- marks expired invitations

  **Context Switching**:
  - `switchTenant(userId, tenantId): Promise<TenantContext>` -- validates user is member, returns full tenant context (tenant + role + permissions)
  - `getTenantContext(userId, tenantId): Promise<TenantContext>` -- returns current tenant context without switching
  - `getDefaultTenant(userId): Promise<Tenant | null>` -- returns first tenant user joined (or primary)

### 2. `server/src/services/tenant-types.ts`
**Purpose**: TypeScript types for tenant system

```typescript
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  abn?: string;
  entityType?: string;
  industry?: string;
  financialYearEnd: string;
  timezone: string;
  settingsJson: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: TenantRole;
  displayName?: string;
  isPrimaryContact: boolean;
  joinedAt: string;
  lastActiveAt?: string;
}

export type TenantRole = 'owner' | 'admin' | 'accountant' | 'bookkeeper' | 'viewer';

export interface TenantContext {
  tenant: Tenant;
  role: TenantRole;
  permissions: string[];
  subscription: SubscriptionInfo;
}

export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  role: TenantRole;
  invitedBy: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
}
```

- [ ] Define all types for tenant, member, invitation, context

### 3. `server/src/services/tenant-defaults.ts`
**Purpose**: Default role-permission mappings

- [ ] Export `DEFAULT_ROLE_PERMISSIONS: Record<TenantRole, string[]>`:
  - `owner`: all 16 permissions
  - `admin`: all except `settings.manage`, `members.manage` restricted to non-owner changes
  - `accountant`: transactions.*, accounts.*, bas.*, tax.*, reports.*, settings.read
  - `bookkeeper`: transactions.read/write, accounts.read, bas.read, reports.read
  - `viewer`: *.read only (transactions.read, accounts.read, bas.read, tax.read, reports.read, settings.read)
- [ ] Export `seedDefaultPermissions(tenantId): Promise<void>` -- inserts role_permissions for all 5 roles

## Files to MODIFY

None -- this agent only creates new files.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `createTenant()` creates tenant + owner member + default role_permissions
- [ ] `addMember()` respects subscription member limit
- [ ] `inviteMember()` generates unique token with 7-day expiry
- [ ] `acceptInvitation()` creates member and updates invitation status
- [ ] `removeMember()` prevents removing last owner
- [ ] `switchTenant()` returns correct permissions for user's role
- [ ] Create marker file: `.agent-done-W23-02`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W23-01`) for schema tables
- **Reuses**: Drizzle ORM patterns from existing services
