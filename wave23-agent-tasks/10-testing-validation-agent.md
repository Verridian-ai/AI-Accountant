# Agent 10: Testing & Validation Agent

## Role
Run the full verification plan for Wave 23 (Multi-Tenant & Access Control). Validate tenant isolation, RBAC enforcement, subscription limits, and Cognee data isolation.

## Priority: WAVE 23 FINAL (After ALL Wave 23 agents complete)

## Wait Condition
Check for ALL marker files: `.agent-done-W23-01` through `.agent-done-W23-09` before starting.

## Verification Tasks

### 1. Compilation
- [ ] Run `cd server && npx tsc --noEmit` (zero errors)
- [ ] Run `cd client && npx tsc --noEmit` (zero errors)
- [ ] Run `docker compose config` (validates)

### 2. Schema & Migration
- [ ] Run migration 0035 against PostgreSQL:
  ```bash
  docker compose exec postgres psql -U app_user -d ai_accountant -f /docker-entrypoint-initdb.d/0035_multi_tenant.sql
  ```
- [ ] Verify 8 new tables exist: `tenants`, `tenant_members`, `tenant_invitations`, `permissions`, `role_permissions`, `subscription_plans`, `subscription_history`, `api_rate_limits`
- [ ] Verify 16 seed permissions exist: `SELECT count(*) FROM permissions` = 16
- [ ] Verify 4 subscription plans exist: `SELECT count(*) FROM subscription_plans` = 4

### 3. Tenant Isolation
- [ ] Create Tenant A: `POST /api/tenants` with name "Company A"
- [ ] Create Tenant B: `POST /api/tenants` with name "Company B"
- [ ] Add transactions to Tenant A
- [ ] Verify Tenant B cannot see Tenant A's transactions (GET returns empty)
- [ ] Verify cross-tenant API call with wrong `X-Tenant-Id` returns 403
- [ ] Verify JWT token for Tenant A rejected when used with `X-Tenant-Id: tenantB`

### 4. RBAC Enforcement
- [ ] Create user with 'viewer' role in Tenant A
- [ ] Verify viewer can `GET /api/transactions` (has `transactions.read`)
- [ ] Verify viewer CANNOT `POST /api/transactions` (lacks `transactions.write`) -- returns 403
- [ ] Verify viewer CANNOT `DELETE /api/tenants/:id/members/:userId` (lacks `members.manage`) -- returns 403
- [ ] Upgrade viewer to 'accountant' role
- [ ] Verify accountant CAN `POST /api/transactions` (has `transactions.write`)
- [ ] Verify accountant CANNOT modify permissions (lacks `settings.manage`) -- returns 403
- [ ] Verify owner can perform all operations

### 5. Permission Matrix
- [ ] `GET /api/tenants/:tenantId/permissions/matrix` returns 5 roles x 16 permissions grid
- [ ] Verify default permissions match `tenant-defaults.ts` specification
- [ ] Owner modifies bookkeeper permissions: add `tax.read`
- [ ] Verify bookkeeper now has `tax.read` permission
- [ ] Reset to defaults: verify bookkeeper loses custom `tax.read`

### 6. Subscription Limits
- [ ] Subscribe Tenant A to 'free' plan
- [ ] Verify member limit: adding 2nd member fails with `UsageLimitExceededError` (free=1 member)
- [ ] Verify account limit: creating 3rd account fails (free=2 accounts)
- [ ] Upgrade to 'starter' plan: verify member limit increases to 3
- [ ] Verify `trackUsage()` increments counters correctly
- [ ] Verify `getUsage()` returns accurate percentages

### 7. Invitation Flow
- [ ] Owner sends invitation: `POST /api/tenants/:id/invitations` with email and role
- [ ] Verify invitation created with unique token and 7-day expiry
- [ ] Accept invitation: `POST /api/invitations/accept` with token
- [ ] Verify user becomes member with correct role
- [ ] Verify expired invitation cannot be accepted (set expiry in past)
- [ ] Verify revoked invitation cannot be accepted

### 8. Cognee Isolation
- [ ] Index data for Tenant A: verify dataset name prefixed with `tenant_${tenantA}_`
- [ ] Index data for Tenant B: verify dataset name prefixed with `tenant_${tenantB}_`
- [ ] Search from Tenant A context: verify NO results from Tenant B's datasets
- [ ] Search from Tenant B context: verify NO results from Tenant A's datasets
- [ ] Admin cross-tenant search: verify results from BOTH tenants returned
- [ ] Chat endpoint: verify Cognee search is tenant-scoped

### 9. Auth & Token
- [ ] Login returns JWT with tenantId and role
- [ ] Switch tenant: `POST /api/tenants/:id/switch` returns new JWT with updated tenantId
- [ ] Verify old token still valid until expiry
- [ ] Verify `/api/auth/me` returns correct tenant context
- [ ] Verify registration creates user without tenant (needs to create or join one)

### 10. UI Components
- [ ] TenantSwitcher renders in header with tenant dropdown
- [ ] TenantSettings page loads and saves
- [ ] MemberManager lists members with role management controls
- [ ] PermissionMatrix renders 16x5 grid with checkboxes
- [ ] PlanComparison shows 4 plans with correct pricing
- [ ] UsageDashboard shows progress bars matching API data
- [ ] All components use neumorphic dark theme

### 11. Generate Verification Report
```
GOLDLEDGER WAVE 23 VERIFICATION REPORT
=======================================
Date: [timestamp]
Schema:          [PASS/FAIL] - 8 tables, seed data, FK cascades
Tenant CRUD:     [PASS/FAIL] - Create, read, update, deactivate
Tenant Isolation:[PASS/FAIL] - Cross-tenant access blocked
RBAC:            [PASS/FAIL] - 5 roles, 16 permissions enforced
Permission Matrix:[PASS/FAIL] - Custom permissions, reset to defaults
Subscriptions:   [PASS/FAIL] - Plans, limits, upgrade/downgrade/cancel
Invitations:     [PASS/FAIL] - Create, accept, expire, revoke
Cognee Isolation:[PASS/FAIL] - Tenant-prefixed datasets, cross-tenant admin
Auth & JWT:      [PASS/FAIL] - Tenant-aware tokens, switch, refresh
Rate Limiting:   [PASS/FAIL] - Per-tenant endpoint limits
API Endpoints:   [PASS/FAIL] - 26 routes accessible
UI Components:   [PASS/FAIL] - 10 components render correctly
Build:           [PASS/FAIL] - Server + Client + Docker clean
```

- [ ] Create marker file: `.agent-done-W23-10`

## Dependencies
- **Requires**: ALL Wave 23 agents (`.agent-done-W23-01` through `.agent-done-W23-09`)
- **Docker must be running**: `docker compose up -d`
