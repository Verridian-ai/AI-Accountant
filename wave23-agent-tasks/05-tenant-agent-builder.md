# Agent 5: Tenant Agent Builder

## Role
Build a `tenant_routing_agent` Claude agent that handles tenant resolution, data isolation enforcement, permission checking, and rate limiting within the AI agent framework.

## Priority: WAVE 23 (After Agents 2, 3, 4)

## Wait Condition
Check for `.agent-done-W23-02`, `.agent-done-W23-03`, `.agent-done-W23-04` marker files before starting.

## Files to CREATE

### 1. `server/src/services/claude/agents/tenant-routing.ts`
**Purpose**: Claude agent for tenant-aware request routing and enforcement
**Pattern**: Follow existing agent pattern at `server/src/services/claude/agents/budget-analyzer.ts`

- [ ] Create `TenantRoutingAgent extends ClaudeAgent<TenantRoutingInput, TenantRoutingOutput>`:
  - System prompt: "You are a tenant isolation and access control agent. Your job is to resolve tenant context, enforce data isolation boundaries, check permissions, and enforce rate limits. You must never allow cross-tenant data access unless the user has explicit admin privileges across tenants."
  - 4 tools:

  **Tool 1: `resolve_tenant`**
  - Input: `{ userId: string, tenantId?: string, slug?: string }`
  - Behavior: Resolves the active tenant for a user. If tenantId provided, validates membership. If slug provided, resolves to tenantId first. Returns full TenantContext.
  - Handler: Calls `TenantService.getTenantContext()` or `TenantService.getTenantBySlug()`

  **Tool 2: `enforce_isolation`**
  - Input: `{ tenantId: string, resourceType: string, resourceIds: string[] }`
  - Behavior: Verifies all requested resources belong to the specified tenant. Checks transactions, accounts, statements, etc. against tenant ownership. Returns list of violations if any resources belong to a different tenant.
  - Handler: Queries resource tables with tenant_id filter, flags mismatches

  **Tool 3: `check_permissions`**
  - Input: `{ tenantId: string, userId: string, permissions: string[] }`
  - Behavior: Batch checks all requested permissions for the user in the tenant. Returns granted/denied for each permission.
  - Handler: Calls `RBACService.checkPermissions()`

  **Tool 4: `check_rate_limit`**
  - Input: `{ tenantId: string, endpoint: string }`
  - Behavior: Checks if the tenant has exceeded their rate limit for the specified endpoint pattern. Returns current count, limit, and whether the request should be allowed.
  - Handler: Reads from `api_rate_limits` table, checks against in-memory counter (sliding window)

### 2. `server/src/services/claude/agents/tenant-routing-types.ts`
**Purpose**: Types for tenant routing agent

```typescript
export interface TenantRoutingInput {
  userId: string;
  tenantId?: string;
  tenantSlug?: string;
  requestedPermissions?: string[];
  requestedResources?: { type: string; ids: string[] }[];
  endpoint?: string;
}

export interface TenantRoutingOutput {
  tenantContext: TenantContext;
  permissionsGranted: Record<string, boolean>;
  isolationViolations: Array<{ resourceType: string; resourceId: string; reason: string }>;
  rateLimitStatus: { allowed: boolean; remaining: number; resetAt: string };
}
```

### 3. `server/src/services/rate-limiter.ts`
**Purpose**: Tenant-aware rate limiting with sliding window

- [ ] Create `TenantRateLimiter` class:
  - `checkLimit(tenantId, endpoint): Promise<RateLimitResult>` -- sliding window counter using in-memory Map
  - `incrementCounter(tenantId, endpoint): void` -- increment request count
  - `getRateLimits(tenantId): Promise<RateLimit[]>` -- fetch limits from `api_rate_limits` table
  - `resetCounters(): void` -- periodic cleanup of expired windows
- [ ] Sliding window algorithm: track timestamps of last N requests per minute/hour/day
- [ ] Burst detection: if burst_limit requests arrive within 1 second, throttle

## Files to MODIFY

### 4. `server/src/services/claude/types.ts`
- [ ] Add `'tenant_routing'` to `AgentType` union (line ~21)
- [ ] Add `TenantRoutingInput` and `TenantRoutingOutput` interfaces

### 5. `server/src/services/claude/config.ts`
- [ ] Add `tenant_routing` to `AGENT_TOKEN_BUDGETS`: 30K input, 4K output, 8 tool calls
- [ ] Add `tenant_routing` to `AGENT_MODELS`: Haiku (fast, low-cost for routing decisions)

### 6. `server/src/services/claude/orchestrator.ts`
- [ ] Add import for `TenantRoutingAgent`
- [ ] Add as first-pass agent: before dispatching to any other agent, run tenant_routing to establish context and enforce isolation

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `resolve_tenant` tool correctly resolves tenant context from userId
- [ ] `enforce_isolation` detects cross-tenant resource access and flags violations
- [ ] `check_permissions` returns correct granted/denied for each permission
- [ ] `check_rate_limit` correctly tracks and enforces rate limits per tenant
- [ ] Agent registered in types.ts and config.ts
- [ ] Orchestrator calls tenant_routing before other agents
- [ ] Create marker file: `.agent-done-W23-05`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-W23-02`) for TenantService, Agent 3 (`.agent-done-W23-03`) for RBACService, Agent 4 (`.agent-done-W23-04`) for SubscriptionService
- **Reuses**: ClaudeAgent base class, orchestrator patterns
