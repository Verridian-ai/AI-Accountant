# Agent 6: Auth Upgrade Builder

## Role
Modify the existing authentication system to be tenant-aware. Upgrade JWT tokens to include tenantId and role. Add X-Tenant-Id header requirement for all API requests.

## Priority: WAVE 23 (After Agents 2, 3)

## Wait Condition
Check for `.agent-done-W23-02` and `.agent-done-W23-03` marker files before starting.

## Files to MODIFY

### 1. `server/src/services/admin-auth.ts` (or wherever auth is implemented)
**Current state**: Simple auth with user-level JWT tokens

- [ ] Modify JWT payload to include tenant context:
  ```typescript
  interface JWTPayload {
    userId: string;
    tenantId: string;
    role: TenantRole;
    permissions: string[];
    iat: number;
    exp: number;
  }
  ```
- [ ] Modify `generateToken(userId, tenantId)`:
  - Look up user's role in `tenant_members` for the given tenant
  - Look up role's permissions from `role_permissions`
  - Include `tenantId`, `role`, and `permissions` in JWT payload
  - Token expiry: 24 hours
- [ ] Modify `verifyToken(token)`:
  - Validate JWT signature and expiry
  - Verify tenantId still exists and is active
  - Verify user is still a member of the tenant
  - Return full `JWTPayload`
- [ ] Add `refreshToken(token, newTenantId?)`:
  - If `newTenantId` provided, switch tenant context (validates membership)
  - Generates new token with refreshed permissions
  - Old token remains valid until expiry (no revocation list)

### 2. `server/src/services/auth-middleware.ts` (CREATE if not exists)
**Purpose**: Tenant-aware authentication middleware for Hono

- [ ] Export `tenantAuthMiddleware(): HonoMiddleware`:
  - Extract JWT from `Authorization: Bearer <token>` header
  - Extract `X-Tenant-Id` from request header (required for all `/api/*` routes except auth endpoints)
  - Verify JWT token
  - Verify `X-Tenant-Id` matches token's tenantId (prevent header spoofing)
  - Attach `tenantContext` to Hono context: `c.set('tenantId', tenantId)`, `c.set('userId', userId)`, `c.set('role', role)`, `c.set('permissions', permissions)`
  - Return 401 for missing/invalid token
  - Return 403 for tenant mismatch
- [ ] Export `optionalTenantAuth(): HonoMiddleware`:
  - Same as above but does not require `X-Tenant-Id` -- for public routes and tenant-creation flow
- [ ] Export `requireRole(minRole: TenantRole): HonoMiddleware`:
  - Checks role from context meets minimum level
  - Role hierarchy: owner > admin > accountant > bookkeeper > viewer

### 3. `server/src/index.ts`
- [ ] Apply `tenantAuthMiddleware()` to all `/api/*` routes except:
  - `POST /api/auth/login`
  - `POST /api/auth/register`
  - `POST /api/tenants` (tenant creation -- uses optionalTenantAuth)
  - `POST /api/invitations/accept` (invitation acceptance)
  - `GET /api/health`
- [ ] Apply `optionalTenantAuth()` to exempted routes that still need user identification
- [ ] Add helper to extract tenant context in route handlers:
  ```typescript
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const role = c.get('role');
  ```

## Files to CREATE

### 4. `server/src/services/auth-types.ts`
**Purpose**: Auth-specific TypeScript types

```typescript
export interface AuthenticatedContext {
  userId: string;
  tenantId: string;
  role: TenantRole;
  permissions: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantId?: string; // Optional: auto-selects default tenant if omitted
}

export interface LoginResponse {
  token: string;
  user: { id: string; email: string; name: string };
  tenant: { id: string; name: string; slug: string };
  role: TenantRole;
  permissions: string[];
}
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] JWT tokens include tenantId and role
- [ ] `X-Tenant-Id` header is required for all `/api/*` routes (except exempted)
- [ ] Missing `X-Tenant-Id` returns 403 with descriptive error
- [ ] Token with tenantId=A cannot access tenantId=B resources (header mismatch rejected)
- [ ] `refreshToken()` with new tenantId generates valid token for new tenant
- [ ] Exempt routes (login, register, health) work without `X-Tenant-Id`
- [ ] Role extracted from JWT matches role in `tenant_members` table
- [ ] Create marker file: `.agent-done-W23-06`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-W23-02`) for TenantService, Agent 3 (`.agent-done-W23-03`) for RBAC
- **IMPORTANT**: Only this agent modifies auth-related files in Wave 23
