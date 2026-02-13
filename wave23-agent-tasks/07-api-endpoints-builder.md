# Agent 7: API Endpoints Builder

## Role
Wire 26 new API routes in `server/src/index.ts` for tenant management, member management, permission management, subscription management, and auth endpoints.

## Priority: WAVE 23 (After Agents 2, 3, 4, 6)

## Wait Condition
Check for `.agent-done-W23-02`, `.agent-done-W23-03`, `.agent-done-W23-04`, `.agent-done-W23-06` marker files before starting.

## File to MODIFY

### `server/src/index.ts`
**Current state**: ~4,707+ lines (plus Wave 21-22 additions)
**Insert location**: After existing route blocks

- [ ] Add imports:
  ```typescript
  import { TenantService } from './services/tenant.js';
  import { RBACService } from './services/rbac.js';
  import { SubscriptionService } from './services/subscriptions.js';
  import { tenantAuthMiddleware, requireRole } from './services/auth-middleware.js';
  ```

- [ ] Instantiate services:
  ```typescript
  const tenantService = new TenantService();
  const rbacService = new RBACService();
  const subscriptionService = new SubscriptionService();
  ```

### Tenant Routes (6 endpoints):

- [ ] `POST /api/tenants` -- Create new tenant (body: `{name, slug, abn?, entityType?}`)
  - Uses `optionalTenantAuth` (user may not have a tenant yet)
  - Returns tenant + owner membership
- [ ] `GET /api/tenants` -- List user's tenants (returns all tenants user is member of)
- [ ] `GET /api/tenants/:id` -- Get single tenant details
- [ ] `PUT /api/tenants/:id` -- Update tenant (requires `settings.manage` permission)
- [ ] `POST /api/tenants/:id/switch` -- Switch active tenant (generates new JWT)
- [ ] `DELETE /api/tenants/:id` -- Deactivate tenant (owner only)

### Member Routes (6 endpoints):

- [ ] `GET /api/tenants/:tenantId/members` -- List members (requires `members.read`)
- [ ] `POST /api/tenants/:tenantId/members` -- Add member directly (requires `members.manage`)
- [ ] `PUT /api/tenants/:tenantId/members/:userId/role` -- Update member role (requires `members.manage`)
- [ ] `DELETE /api/tenants/:tenantId/members/:userId` -- Remove member (requires `members.manage`)
- [ ] `POST /api/tenants/:tenantId/invitations` -- Send invitation (requires `members.manage`, body: `{email, role}`)
- [ ] `POST /api/invitations/accept` -- Accept invitation (body: `{token}`, no tenant auth required)

### Permission Routes (4 endpoints):

- [ ] `GET /api/tenants/:tenantId/permissions` -- List all permissions
- [ ] `GET /api/tenants/:tenantId/permissions/matrix` -- Get full role-permission matrix
- [ ] `PUT /api/tenants/:tenantId/permissions/:role` -- Update role permissions (owner only, body: `{permissions: string[]}`)
- [ ] `POST /api/tenants/:tenantId/permissions/reset` -- Reset to defaults (owner only)

### Subscription Routes (6 endpoints):

- [ ] `GET /api/subscriptions/plans` -- List available plans (public, no auth required)
- [ ] `GET /api/tenants/:tenantId/subscription` -- Get current subscription + usage
- [ ] `POST /api/tenants/:tenantId/subscription` -- Subscribe to plan (body: `{planName, billingCycle}`)
- [ ] `PUT /api/tenants/:tenantId/subscription/upgrade` -- Upgrade plan (body: `{newPlanName}`)
- [ ] `PUT /api/tenants/:tenantId/subscription/downgrade` -- Downgrade plan (body: `{newPlanName}`)
- [ ] `DELETE /api/tenants/:tenantId/subscription` -- Cancel subscription

### Auth Routes (4 endpoints):

- [ ] `POST /api/auth/login` -- Login with tenant selection
- [ ] `POST /api/auth/register` -- Register new user
- [ ] `POST /api/auth/refresh` -- Refresh token (optional tenant switch)
- [ ] `GET /api/auth/me` -- Get current user + tenant context

### Route Pattern (with RBAC middleware):
```typescript
app.get('/api/tenants/:tenantId/members', async (c) => {
    try {
        const tenantId = c.get('tenantId') || c.req.param('tenantId');
        const userId = c.get('userId');
        await rbacService.requirePermission(tenantId, userId, 'members.read');
        const members = await tenantService.getMembers(tenantId);
        return c.json(members);
    } catch (err) {
        if (err instanceof ForbiddenError) return c.json({ error: err.message }, 403);
        console.error('Get members failed:', err);
        return c.json({ error: 'Failed to get members' }, 500);
    }
});
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 26 routes are accessible (test with curl after Docker rebuild)
- [ ] Tenant CRUD: create, read, update, deactivate work
- [ ] Member management: add, remove, change role, invite, accept invitation
- [ ] Permission endpoints return correct matrix and allow updates
- [ ] Subscription endpoints handle full lifecycle (subscribe, upgrade, downgrade, cancel)
- [ ] Auth endpoints return tenant-aware JWT tokens
- [ ] RBAC enforcement: viewer cannot access `members.manage` routes (returns 403)
- [ ] No route path conflicts with existing routes
- [ ] Create marker file: `.agent-done-W23-07`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-W23-02`), Agent 3 (`.agent-done-W23-03`), Agent 4 (`.agent-done-W23-04`), Agent 6 (`.agent-done-W23-06`)
- **IMPORTANT**: Only this agent modifies `server/src/index.ts` in Wave 23
