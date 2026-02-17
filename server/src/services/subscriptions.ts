/**
 * Subscription Service
 * Plan management, subscription lifecycle, usage tracking, and limit enforcement.
 */

import { db, subscriptionPlans, subscriptionHistory } from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import type {
  SubscriptionPlan,
  Subscription,
  UsageMetric,
  UsageReport,
  UsageStatus,
  UsageJson,
} from './subscription-types.js';
import { UsageLimitExceededError } from './subscription-types.js';

// ============================================================================
// HELPERS
// ============================================================================

const MONTHLY_DAYS = 30;
const ANNUAL_DAYS = 365;
const TRIAL_DAYS = 14;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function parseUsageJson(raw: string | null | undefined): UsageJson {
  const defaults: UsageJson = {
    members: 0,
    accounts: 0,
    transactions: 0,
    aiQueries: 0,
    storageMb: 0,
  };
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw) as Partial<UsageJson>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function metricToLimit(plan: SubscriptionPlan, metric: UsageMetric): number {
  switch (metric) {
    case 'members':
      return plan.maxMembers;
    case 'accounts':
      return plan.maxAccounts;
    case 'transactions':
      return plan.maxTransactionsPerMonth;
    case 'aiQueries':
      return plan.maxAiQueriesPerMonth;
    case 'storageMb':
      return plan.maxStorageMb;
  }
}

function buildUsageReport(usage: UsageJson, plan: SubscriptionPlan): UsageReport {
  const entry = (current: number, limit: number) => ({
    current,
    limit,
    percentUsed: limit > 0 ? Math.round((current / limit) * 100) : 0,
  });
  return {
    members: entry(usage.members, plan.maxMembers),
    accounts: entry(usage.accounts, plan.maxAccounts),
    transactions: entry(usage.transactions, plan.maxTransactionsPerMonth),
    aiQueries: entry(usage.aiQueries, plan.maxAiQueriesPerMonth),
    storageMb: entry(usage.storageMb, plan.maxStorageMb),
  };
}

function dbPlanToSubscriptionPlan(row: Record<string, unknown>): SubscriptionPlan {
  return {
    id: row.id as string,
    name: row.name as string,
    displayName: (row.displayName ?? row.display_name ?? '') as string,
    description: (row.description ?? '') as string,
    priceMonthlyCents: (row.priceMonthlyCents ?? row.price_monthly_cents ?? 0) as number,
    priceAnnualCents: (row.priceAnnualCents ?? row.price_annual_cents ?? 0) as number,
    maxMembers: (row.maxMembers ?? row.max_members ?? 1) as number,
    maxAccounts: (row.maxAccounts ?? row.max_accounts ?? 2) as number,
    maxTransactionsPerMonth: (row.maxTransactionsPerMonth ?? row.max_transactions_per_month ?? 500) as number,
    maxAiQueriesPerMonth: (row.maxAiQueriesPerMonth ?? row.max_ai_queries_per_month ?? 50) as number,
    maxStorageMb: (row.maxStorageMb ?? row.max_storage_mb ?? 100) as number,
    features: parseFeatures((row.featuresJson ?? row.features_json) as string | null | undefined),
    isActive: (row.isActive ?? row.is_active ?? true) as boolean,
  };
}

function parseFeatures(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function dbRowToSubscription(row: Record<string, unknown>, plan: SubscriptionPlan): Subscription {
  const usage = parseUsageJson((row.usageJson ?? row.usage_json) as string | null | undefined);
  return {
    id: row.id as string,
    tenantId: (row.tenantId ?? row.tenant_id) as string,
    plan,
    status: row.status as 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired',
    billingCycle: (row.billingCycle ?? row.billing_cycle ?? 'monthly') as 'monthly' | 'annual',
    currentPeriodStart: (row.currentPeriodStart ?? row.current_period_start) as string,
    currentPeriodEnd: (row.currentPeriodEnd ?? row.current_period_end) as string,
    cancelAtPeriodEnd: !!(row.cancelAtPeriodEnd ?? row.cancel_at_period_end),
    trialEnd: (row.trialEnd ?? row.trial_end ?? undefined) as string | undefined,
    usage: buildUsageReport(usage, plan),
  };
}

// ============================================================================
// SUBSCRIPTION SERVICE
// ============================================================================

export class SubscriptionService {
  // --------------------------------------------------------------------------
  // PLAN MANAGEMENT
  // --------------------------------------------------------------------------

  async getPlans(): Promise<SubscriptionPlan[]> {
    const rows = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.sortOrder)
      .all();
    return rows.map(dbPlanToSubscriptionPlan);
  }

  async getPlan(planId: string): Promise<SubscriptionPlan | null> {
    const row = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .get();
    return row ? dbPlanToSubscriptionPlan(row) : null;
  }

  async getPlanByName(name: string): Promise<SubscriptionPlan | null> {
    const row = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, name))
      .get();
    return row ? dbPlanToSubscriptionPlan(row) : null;
  }

  // --------------------------------------------------------------------------
  // SUBSCRIPTION LIFECYCLE
  // --------------------------------------------------------------------------

  async subscribe(
    tenantId: string,
    planName: string,
    billingCycle: 'monthly' | 'annual' = 'monthly',
  ): Promise<Subscription> {
    const plan = await this.getPlanByName(planName);
    if (!plan) throw new Error(`Plan not found: ${planName}`);

    // Cancel any existing active subscription
    const existing = await this._getActiveSubscriptionRow(tenantId);
    if (existing) {
      await db
        .update(subscriptionHistory)
        .set({
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(subscriptionHistory.id, existing.id))
        .run();
    }

    const now = new Date();
    const periodDays = billingCycle === 'annual' ? ANNUAL_DAYS : MONTHLY_DAYS;
    const periodEnd = addDays(now, periodDays);

    const isFree = plan.priceMonthlyCents === 0 && plan.priceAnnualCents === 0;
    const status = isFree ? 'active' : 'trialing';
    const trialEnd = isFree ? null : addDays(now, TRIAL_DAYS).toISOString();

    const id = crypto.randomUUID();
    const record = {
      id,
      tenantId,
      planId: plan.id,
      status,
      billingCycle,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      trialEnd,
      usageJson: JSON.stringify({
        members: 0,
        accounts: 0,
        transactions: 0,
        aiQueries: 0,
        storageMb: 0,
      }),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await db.insert(subscriptionHistory).values(record).run();

    return dbRowToSubscription(record, plan);
  }

  async upgrade(tenantId: string, newPlanName: string): Promise<Subscription> {
    const current = await this.getCurrentSubscription(tenantId);
    if (!current) throw new Error('No active subscription to upgrade');

    const newPlan = await this.getPlanByName(newPlanName);
    if (!newPlan) throw new Error(`Plan not found: ${newPlanName}`);

    // End current subscription immediately
    await db
      .update(subscriptionHistory)
      .set({
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(subscriptionHistory.tenantId, tenantId),
          eq(subscriptionHistory.status, current.status),
        ),
      )
      .run();

    // Create new subscription effective immediately, carrying over usage
    const now = new Date();
    const periodDays = current.billingCycle === 'annual' ? ANNUAL_DAYS : MONTHLY_DAYS;
    const periodEnd = addDays(now, periodDays);

    const id = crypto.randomUUID();
    const usageRaw: UsageJson = {
      members: current.usage.members.current,
      accounts: current.usage.accounts.current,
      transactions: current.usage.transactions.current,
      aiQueries: current.usage.aiQueries.current,
      storageMb: current.usage.storageMb.current,
    };

    const record = {
      id,
      tenantId,
      planId: newPlan.id,
      status: 'active' as const,
      billingCycle: current.billingCycle,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      trialEnd: null,
      usageJson: JSON.stringify(usageRaw),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await db.insert(subscriptionHistory).values(record).run();

    return dbRowToSubscription(record, newPlan);
  }

  async downgrade(tenantId: string, newPlanName: string): Promise<Subscription> {
    const current = await this.getCurrentSubscription(tenantId);
    if (!current) throw new Error('No active subscription to downgrade');

    const newPlan = await this.getPlanByName(newPlanName);
    if (!newPlan) throw new Error(`Plan not found: ${newPlanName}`);

    // Mark current subscription to end at period end
    const activeRow = await this._getActiveSubscriptionRow(tenantId);
    if (activeRow) {
      await db
        .update(subscriptionHistory)
        .set({ cancelAtPeriodEnd: true, updatedAt: new Date().toISOString() })
        .where(eq(subscriptionHistory.id, activeRow.id))
        .run();
    }

    // Schedule new subscription to start at current period end
    const periodStart = new Date(current.currentPeriodEnd);
    const periodDays = current.billingCycle === 'annual' ? ANNUAL_DAYS : MONTHLY_DAYS;
    const periodEnd = addDays(periodStart, periodDays);

    const id = crypto.randomUUID();
    const record = {
      id,
      tenantId,
      planId: newPlan.id,
      status: 'active' as const,
      billingCycle: current.billingCycle,
      currentPeriodStart: periodStart.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      trialEnd: null,
      usageJson: JSON.stringify({
        members: 0,
        accounts: 0,
        transactions: 0,
        aiQueries: 0,
        storageMb: 0,
      }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.insert(subscriptionHistory).values(record).run();

    // Return the current subscription (still active until period end) with updated flag
    return {
      ...current,
      cancelAtPeriodEnd: true,
    };
  }

  async cancel(tenantId: string): Promise<Subscription> {
    const current = await this.getCurrentSubscription(tenantId);
    if (!current) throw new Error('No active subscription to cancel');

    const activeRow = await this._getActiveSubscriptionRow(tenantId);
    if (activeRow) {
      await db
        .update(subscriptionHistory)
        .set({
          cancelAtPeriodEnd: true,
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(subscriptionHistory.id, activeRow.id))
        .run();
    }

    return {
      ...current,
      cancelAtPeriodEnd: true,
    };
  }

  async reactivate(tenantId: string): Promise<Subscription> {
    const activeRow = await this._getActiveSubscriptionRow(tenantId);
    if (!activeRow) throw new Error('No active subscription to reactivate');

    const isCancelling = activeRow.cancelAtPeriodEnd ?? activeRow.cancel_at_period_end;
    if (!isCancelling) throw new Error('Subscription is not scheduled for cancellation');

    await db
      .update(subscriptionHistory)
      .set({
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(subscriptionHistory.id, activeRow.id))
      .run();

    const plan = await this.getPlan(activeRow.planId ?? activeRow.plan_id);
    if (!plan) throw new Error('Associated plan not found');

    return dbRowToSubscription({ ...activeRow, cancelAtPeriodEnd: false, cancelledAt: null }, plan);
  }

  async getCurrentSubscription(tenantId: string): Promise<Subscription | null> {
    const row = await this._getActiveSubscriptionRow(tenantId);
    if (!row) return null;

    const planId = row.planId ?? row.plan_id;
    const plan = await this.getPlan(planId);
    if (!plan) return null;

    return dbRowToSubscription(row, plan);
  }

  async getSubscriptionHistory(tenantId: string): Promise<Subscription[]> {
    const rows = await db
      .select()
      .from(subscriptionHistory)
      .where(eq(subscriptionHistory.tenantId, tenantId))
      .orderBy(desc(subscriptionHistory.createdAt))
      .all();

    const results: Subscription[] = [];
    for (const row of rows) {
      const planId = row.planId ?? (row as Record<string, unknown>).plan_id;
      const plan = await this.getPlan(planId);
      if (plan) {
        results.push(dbRowToSubscription(row, plan));
      }
    }
    return results;
  }

  // --------------------------------------------------------------------------
  // USAGE TRACKING
  // --------------------------------------------------------------------------

  async trackUsage(
    tenantId: string,
    metric: UsageMetric,
    increment: number = 1,
  ): Promise<UsageStatus> {
    const row = await this._getActiveSubscriptionRow(tenantId);
    if (!row) throw new Error('No active subscription found');

    const planId = row.planId ?? row.plan_id;
    const plan = await this.getPlan(planId);
    if (!plan) throw new Error('Associated plan not found');

    const usage = parseUsageJson(row.usageJson ?? row.usage_json);
    usage[metric] = (usage[metric] ?? 0) + increment;

    await db
      .update(subscriptionHistory)
      .set({ usageJson: JSON.stringify(usage), updatedAt: new Date().toISOString() })
      .where(eq(subscriptionHistory.id, row.id))
      .run();

    const limit = metricToLimit(plan, metric);
    return {
      metric,
      current: usage[metric],
      limit,
      percentUsed: limit > 0 ? Math.round((usage[metric] / limit) * 100) : 0,
      allowed: usage[metric] <= limit,
    };
  }

  async getUsage(tenantId: string): Promise<UsageReport> {
    const sub = await this.getCurrentSubscription(tenantId);
    if (!sub) {
      // Return zeroed report with free-tier defaults
      return buildUsageReport(
        { members: 0, accounts: 0, transactions: 0, aiQueries: 0, storageMb: 0 },
        {
          maxMembers: 1,
          maxAccounts: 2,
          maxTransactionsPerMonth: 500,
          maxAiQueriesPerMonth: 50,
          maxStorageMb: 100,
        } as SubscriptionPlan,
      );
    }
    return sub.usage;
  }

  async resetMonthlyUsage(tenantId: string): Promise<void> {
    const row = await this._getActiveSubscriptionRow(tenantId);
    if (!row) return;

    const usage = parseUsageJson(row.usageJson ?? row.usage_json);
    // Reset per-month counters; members/accounts/storage persist
    usage.transactions = 0;
    usage.aiQueries = 0;

    await db
      .update(subscriptionHistory)
      .set({ usageJson: JSON.stringify(usage), updatedAt: new Date().toISOString() })
      .where(eq(subscriptionHistory.id, row.id))
      .run();
  }

  // --------------------------------------------------------------------------
  // LIMIT ENFORCEMENT
  // --------------------------------------------------------------------------

  async checkUsage(tenantId: string, metric: UsageMetric): Promise<UsageStatus> {
    const row = await this._getActiveSubscriptionRow(tenantId);
    if (!row) {
      return { metric, current: 0, limit: 0, percentUsed: 0, allowed: false };
    }

    const planId = row.planId ?? row.plan_id;
    const plan = await this.getPlan(planId);
    if (!plan) {
      return { metric, current: 0, limit: 0, percentUsed: 0, allowed: false };
    }

    const usage = parseUsageJson(row.usageJson ?? row.usage_json);
    const current = usage[metric] ?? 0;
    const limit = metricToLimit(plan, metric);

    return {
      metric,
      current,
      limit,
      percentUsed: limit > 0 ? Math.round((current / limit) * 100) : 0,
      allowed: current < limit,
    };
  }

  async enforceLimit(tenantId: string, metric: UsageMetric): Promise<void> {
    const status = await this.checkUsage(tenantId, metric);
    if (!status.allowed) {
      const sub = await this.getCurrentSubscription(tenantId);
      const planName = sub?.plan.displayName ?? 'current';
      throw new UsageLimitExceededError(metric, status.current, status.limit, planName);
    }
  }

  async isFeatureEnabled(tenantId: string, feature: string): Promise<boolean> {
    const sub = await this.getCurrentSubscription(tenantId);
    if (!sub) return false;
    return sub.plan.features.includes(feature);
  }

  // --------------------------------------------------------------------------
  // INTERNAL HELPERS
  // --------------------------------------------------------------------------

  private async _getActiveSubscriptionRow(tenantId: string): Promise<any> {
    // Look for active or trialing subscriptions
    const active = await db
      .select()
      .from(subscriptionHistory)
      .where(
        and(eq(subscriptionHistory.tenantId, tenantId), eq(subscriptionHistory.status, 'active')),
      )
      .orderBy(desc(subscriptionHistory.createdAt))
      .get();
    if (active) return active;

    // Fall back to trialing
    const trialing = await db
      .select()
      .from(subscriptionHistory)
      .where(
        and(eq(subscriptionHistory.tenantId, tenantId), eq(subscriptionHistory.status, 'trialing')),
      )
      .orderBy(desc(subscriptionHistory.createdAt))
      .get();
    return trialing ?? null;
  }
}

// Singleton export
export const subscriptionService = new SubscriptionService();
