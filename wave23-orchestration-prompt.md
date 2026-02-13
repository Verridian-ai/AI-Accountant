# Wave 23 — Multi-Tenant & Access Control — Orchestration Prompt

You are the **Team Lead** for Wave 23: Multi-Tenant & Access Control. You coordinate 10 specialized agents to add full multi-tenant isolation, role-based access control (RBAC), and subscription tiers to GoldLedger.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Docker research**: `wave0-research/R09-docker-infrastructure.md` (Wave 24 is the infrastructure inflection point)
- **Frontend research**: `wave0-research/R07-frontend-architecture.md`
- **Existing auth**: Basic JWT auth in server/src/services/admin-auth.ts (Wave 20)

## Current State (After Wave 22)
- 25 Claude agents
- Admin dashboard with user management (Wave 20)
- Custom dashboards with Recharts (Wave 22)
- Basic JWT auth exists but no tenant isolation
- No role-based access control
- No subscription/billing model
- 24 migrations (0009–0034) applied

## Dependencies
- **Requires**: Wave 20 (admin + user management)
- **Estimated Complexity**: CRITICAL (architecture-level change)

## Database Schema Changes

### New Tables (8 tables)
| Table | Columns |
|-------|---------|
| `tenants` | id, name, slug, domain, plan (free/starter/professional/enterprise), status (active/suspended/cancelled), maxUsers, maxEntities, maxStorage, billingEmail, createdAt |
| `tenant_members` | id, tenantId, userId, role (owner/admin/accountant/bookkeeper/viewer), invitedBy, joinedAt, status (active/suspended) |
| `tenant_invitations` | id, tenantId, email, role, token, expiresAt, acceptedAt, invitedBy |
| `permissions` | id, name, description, module, action (create/read/update/delete/admin) |
| `role_permissions` | id, role, permissionId |
| `subscription_plans` | id, name, monthlyPrice, annualPrice, features (JSON), maxUsers, maxEntities, maxAgentCalls, maxStorage, isActive |
| `subscription_history` | id, tenantId, planId, startDate, endDate, status (active/cancelled/expired), paymentMethod, billingCycleDay |
| `api_rate_limits` | id, tenantId, endpoint, maxRequests, windowSeconds, currentCount, windowStart |

**Migration**: `docker/migrations/0035_multi_tenant.sql`

## API Endpoints (26 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/tenants | Create tenant (signup) |
| GET | /api/tenants/current | Get current tenant |
| PATCH | /api/tenants/current | Update tenant settings |
| GET | /api/tenants/current/members | List tenant members |
| POST | /api/tenants/current/members | Add member |
| PATCH | /api/tenants/current/members/:id | Update member role |
| DELETE | /api/tenants/current/members/:id | Remove member |
| POST | /api/tenants/current/invite | Send invitation |
| POST | /api/tenants/accept-invite/:token | Accept invitation |
| GET | /api/tenants/current/roles | List available roles |
| GET | /api/tenants/current/permissions | Get role-permission matrix |
| PATCH | /api/tenants/current/permissions | Update role permissions |
| GET | /api/subscriptions/plans | List available plans |
| GET | /api/subscriptions/current | Current subscription detail |
| POST | /api/subscriptions/upgrade | Upgrade plan |
| POST | /api/subscriptions/downgrade | Downgrade plan |
| POST | /api/subscriptions/cancel | Cancel subscription |
| GET | /api/subscriptions/usage | Current usage vs plan limits |
| GET | /api/subscriptions/history | Subscription history |
| POST | /api/auth/login | Enhanced: tenant-aware login |
| POST | /api/auth/register | Enhanced: create tenant + user |
| POST | /api/auth/switch-tenant | Switch active tenant |
| GET | /api/auth/tenants | List user's tenants |
| POST | /api/auth/refresh | Refresh JWT with tenant context |
| GET | /api/rate-limits | Current rate limit status |
| GET | /api/admin/tenants | (Admin) List all tenants |

## UI Components
### `client/src/features/tenant/` — New feature folder
- TenantSettings.tsx — Tenant profile and settings
- MemberManagement.tsx — Team members with role assignment
- InviteMembers.tsx — Email invitation form
- RoleEditor.tsx — Customize role permissions
- TenantSwitcher.tsx — Switch between tenants (header dropdown)

### `client/src/features/subscription/` — New feature folder
- SubscriptionPlans.tsx — Plan comparison cards
- CurrentPlan.tsx — Current plan with usage meters
- UsageDashboard.tsx — Usage vs limits visualization
- UpgradeFlow.tsx — Upgrade confirmation with feature comparison
- BillingHistory.tsx — Subscription and payment history

### Updates to Existing Components
- App.tsx — Wrap with TenantContext provider
- All API calls — Add `X-Tenant-Id` header
- BottomNavigation.tsx — Show tenant name
- AdminDashboard.tsx — Add tenant management for super_admin

**Navigation**: Settings → Tenant Settings (no new tab)

## New Claude Agents (1)
1. **`tenant_routing_agent`** — Routes agent queries to correct tenant context, enforces data isolation, manages cross-tenant operations for admin. Tools: `resolve_tenant`, `enforce_isolation`, `check_permissions`, `check_rate_limit`.

## Cognee Integration
- **Tenant isolation**: Prefix all Cognee datasets with tenant ID: `{tenantId}_transactions`, `{tenantId}_invoices`, etc.
- **Namespace partitioning**: Each tenant gets isolated Cognee namespace
- **Admin access**: Super admin can query across all tenant namespaces

## Testing Criteria
- [ ] Tenant creation generates isolated namespace
- [ ] Member invitation sends email with valid token
- [ ] Role-based access: bookkeeper cannot access admin endpoints
- [ ] Tenant data isolation: User A cannot see User B's data
- [ ] JWT includes tenant context and role
- [ ] Subscription plan enforces user limits
- [ ] Rate limiting enforces per-tenant API limits
- [ ] Tenant switcher changes context for multi-tenant users
- [ ] Cognee datasets are tenant-isolated
- [ ] Admin can view all tenants
- [ ] Downgrade prevents access to premium features
- [ ] `cd server && npx tsc --noEmit` passes clean

## Team Structure — 10 Agents

### Agent 1: tenant-schema-builder [PRIORITY: WAVE 1]
**Task file**: `wave23-agent-tasks/01-tenant-schema-builder.md`

### Agent 2: tenant-service-builder [PRIORITY: WAVE 1]
**Task file**: `wave23-agent-tasks/02-tenant-service-builder.md`
**Creates**: server/src/services/tenant.ts

### Agent 3: rbac-service-builder [PRIORITY: WAVE 1]
**Task file**: `wave23-agent-tasks/03-rbac-service-builder.md`
**Creates**: server/src/services/rbac.ts

### Agent 4: subscription-service-builder [DEPENDS ON: Agent 1]
**Task file**: `wave23-agent-tasks/04-subscription-service-builder.md`
**Creates**: server/src/services/subscriptions.ts

### Agent 5: tenant-agent-builder [DEPENDS ON: Agents 2, 3]
**Task file**: `wave23-agent-tasks/05-tenant-agent-builder.md`
**Creates**: server/src/services/claude/agents/tenant-routing-agent.ts

### Agent 6: auth-upgrade-builder [DEPENDS ON: Agents 2, 3]
**Task file**: `wave23-agent-tasks/06-auth-upgrade-builder.md`
**Modifies**: admin-auth.ts → tenant-aware auth

### Agent 7: api-endpoints-builder [DEPENDS ON: Agents 2, 3, 4, 5, 6]
**Task file**: `wave23-agent-tasks/07-api-endpoints-builder.md`

### Agent 8: ui-tenant-builder [DEPENDS ON: Agent 7]
**Task file**: `wave23-agent-tasks/08-ui-tenant-builder.md`

### Agent 9: cognee-isolation-builder [DEPENDS ON: Agent 2]
**Task file**: `wave23-agent-tasks/09-cognee-isolation-builder.md`
**Modifies**: cognee_client.ts for tenant-prefixed datasets

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Task file**: `wave23-agent-tasks/10-testing-validation-agent.md`

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 5 + Agent 6
Sub-wave 3 (After 2):  Agent 7 + Agent 9
Sub-wave 4 (After 3):  Agent 8
Sub-wave 5 (After 4):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates. Read each agent's task file from `wave23-agent-tasks/`.
