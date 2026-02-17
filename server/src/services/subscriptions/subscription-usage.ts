/**
 * Subscription Usage Tracking & Limit Enforcement
 * Extracted from SubscriptionService.
 */

import { db, subscriptionHistory } from '../../schema.js';
import { eq } from 'drizzle-orm';
import type { UsageMetric, UsageReport, UsageStatus, SubscriptionPlan } from './types.js';
import { parseUsageJson, metricToLimit, buildUsageReport } from './types.js';
import { getActiveSubscriptionRow, getPlan, getCurrentSubscription } from './subscription-plans.js';
import { UsageLimitExceededError } from './types.js';

// --------------------------------------------------------------------------
// USAGE TRACKING
// --------------------------------------------------------------------------

export async function trackUsage(
  tenantId: string,
  metric: UsageMetric,
  increment: number = 1,
): Promise<UsageStatus> {
  const row = await getActiveSubscriptionRow(tenantId);
  if (!row) throw new Error('No active subscription found');

  const planId = row.planId ?? row.plan_id;
  const plan = await getPlan(planId);
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

export async function getUsage(tenantId: string): Promise<UsageReport> {
  const sub = await getCurrentSubscription(tenantId);
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

export async function resetMonthlyUsage(tenantId: string): Promise<void> {
  const row = await getActiveSubscriptionRow(tenantId);
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

export async function checkUsage(tenantId: string, metric: UsageMetric): Promise<UsageStatus> {
  const row = await getActiveSubscriptionRow(tenantId);
  if (!row) {
    return { metric, current: 0, limit: 0, percentUsed: 0, allowed: false };
  }

  const planId = row.planId ?? row.plan_id;
  const plan = await getPlan(planId);
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

export async function enforceLimit(tenantId: string, metric: UsageMetric): Promise<void> {
  const status = await checkUsage(tenantId, metric);
  if (!status.allowed) {
    const sub = await getCurrentSubscription(tenantId);
    const planName = sub?.plan.displayName ?? 'current';
    throw new UsageLimitExceededError(metric, status.current, status.limit, planName);
  }
}

export async function isFeatureEnabled(tenantId: string, feature: string): Promise<boolean> {
  const sub = await getCurrentSubscription(tenantId);
  if (!sub) return false;
  return sub.plan.features.includes(feature);
}
