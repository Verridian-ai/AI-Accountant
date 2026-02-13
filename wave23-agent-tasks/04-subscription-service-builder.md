# Agent 4: Subscription Service Builder

## Role
Build the subscription management service with plan tiers (free/starter/professional/enterprise), usage tracking, limit enforcement, and upgrade/downgrade logic.

## Priority: WAVE 23 (After Agent 1)

## Wait Condition
Check for `.agent-done-W23-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/subscriptions.ts`
**Purpose**: Subscription management and limit enforcement
**Pattern**: Follow existing service patterns

- [ ] Create `SubscriptionService` class with methods:

  **Plan Management**:
  - `getPlans(): Promise<SubscriptionPlan[]>` -- list all active plans sorted by sort_order
  - `getPlan(planId: string): Promise<SubscriptionPlan | null>` -- single plan details
  - `getPlanByName(name: string): Promise<SubscriptionPlan | null>` -- lookup by name ('free', 'starter', etc.)

  **Subscription Lifecycle**:
  - `subscribe(tenantId, planName, billingCycle): Promise<Subscription>` -- creates subscription record in `subscription_history`, sets period dates, handles trial for non-free plans (14-day trial)
  - `upgrade(tenantId, newPlanName): Promise<Subscription>` -- prorated upgrade, creates new subscription record, deactivates old one
  - `downgrade(tenantId, newPlanName): Promise<Subscription>` -- takes effect at end of current period (`cancel_at_period_end = true` on current, new subscription starts at period end)
  - `cancel(tenantId): Promise<Subscription>` -- sets `cancel_at_period_end = true`, subscription active until period end
  - `reactivate(tenantId): Promise<Subscription>` -- reverses cancellation before period end
  - `getCurrentSubscription(tenantId): Promise<Subscription | null>` -- returns active subscription with plan details
  - `getSubscriptionHistory(tenantId): Promise<Subscription[]>` -- full history for tenant

  **Usage Tracking**:
  - `trackUsage(tenantId, metric: UsageMetric, increment?: number): Promise<UsageStatus>` -- increments usage counter in `subscription_history.usage_json`, returns current vs limit
  - `getUsage(tenantId): Promise<UsageReport>` -- returns all usage metrics with limits and percentages
  - `resetMonthlyUsage(tenantId): Promise<void>` -- resets transaction and AI query counters (called monthly by cron)

  **Limit Enforcement**:
  - `checkUsage(tenantId, metric: UsageMetric): Promise<{allowed: boolean, current: number, limit: number, percentUsed: number}>` -- checks if adding one more would exceed limit
  - `enforceLimit(tenantId, metric: UsageMetric): Promise<void>` -- throws `UsageLimitExceededError` if over limit
  - `isFeatureEnabled(tenantId, feature: string): Promise<boolean>` -- checks if feature is in plan's `features_json` array

### 2. `server/src/services/subscription-types.ts`
**Purpose**: TypeScript types for subscription system

```typescript
export interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  priceMonthlyCents: number;
  priceAnnualCents: number;
  maxMembers: number;
  maxAccounts: number;
  maxTransactionsPerMonth: number;
  maxAiQueriesPerMonth: number;
  maxStorageMb: number;
  features: string[];
  isActive: boolean;
}

export interface Subscription {
  id: string;
  tenantId: string;
  plan: SubscriptionPlan;
  status: 'active' | 'cancelled' | 'expired' | 'trialing' | 'past_due';
  billingCycle: 'monthly' | 'annual';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
  usage: UsageReport;
}

export type UsageMetric = 'members' | 'accounts' | 'transactions' | 'aiQueries' | 'storageMb';

export interface UsageReport {
  members: { current: number; limit: number; percentUsed: number };
  accounts: { current: number; limit: number; percentUsed: number };
  transactions: { current: number; limit: number; percentUsed: number };
  aiQueries: { current: number; limit: number; percentUsed: number };
  storageMb: { current: number; limit: number; percentUsed: number };
}

export class UsageLimitExceededError extends Error {
  constructor(
    public metric: UsageMetric,
    public current: number,
    public limit: number,
    public planName: string,
  ) {
    super(`${metric} limit exceeded: ${current}/${limit} on ${planName} plan. Upgrade to increase limits.`);
    this.name = 'UsageLimitExceededError';
  }
}
```

- [ ] Define all types for plans, subscriptions, usage

### 3. `server/src/services/subscription-middleware.ts`
**Purpose**: Hono middleware for enforcing subscription limits on routes

- [ ] Export `subscriptionLimitMiddleware(metric: UsageMetric): HonoMiddleware` -- extracts tenantId from `X-Tenant-Id`, calls `enforceLimit()`, returns 402 (Payment Required) with upgrade message on failure
- [ ] Export `featureGateMiddleware(feature: string): HonoMiddleware` -- checks if feature enabled for tenant's plan, returns 403 with plan comparison

## Files to MODIFY

None -- this agent only creates new files.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `subscribe()` creates subscription with correct period dates
- [ ] `upgrade()` performs prorated calculation correctly
- [ ] `downgrade()` schedules for end of period, not immediate
- [ ] `cancel()` sets cancel_at_period_end, subscription remains active until period end
- [ ] `trackUsage()` increments counters and returns accurate percentages
- [ ] `enforceLimit()` throws when limit exceeded
- [ ] `isFeatureEnabled()` correctly checks plan features
- [ ] Free plan limits: 1 member, 2 accounts, 500 tx/month, 50 AI queries, 100MB
- [ ] Enterprise plan limits: 50 members, 100 accounts, 100K tx/month, 10K AI queries, 10GB
- [ ] Create marker file: `.agent-done-W23-04`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W23-01`) for schema tables
- **Reuses**: Drizzle ORM patterns
