/**
 * Subscription Service — Internal Types & Helpers
 *
 * Helper functions for parsing DB rows into typed subscription objects.
 * Re-exports all types from subscription-types.ts for convenience.
 */

export type {
  SubscriptionPlan,
  Subscription,
  UsageMetric,
  UsageReport,
  UsageStatus,
  UsageJson,
} from '../subscription-types.js';

export { UsageLimitExceededError } from '../subscription-types.js';

import type {
  SubscriptionPlan,
  Subscription,
  UsageMetric,
  UsageReport,
  UsageJson,
} from '../subscription-types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export const MONTHLY_DAYS = 30;
export const ANNUAL_DAYS = 365;
export const TRIAL_DAYS = 14;

// ============================================================================
// HELPERS
// ============================================================================

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function parseUsageJson(raw: string | null | undefined): UsageJson {
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

export function metricToLimit(plan: SubscriptionPlan, metric: UsageMetric): number {
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

export function buildUsageReport(usage: UsageJson, plan: SubscriptionPlan): UsageReport {
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

function parseFeatures(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function dbPlanToSubscriptionPlan(row: any): SubscriptionPlan {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName ?? row.display_name ?? '',
    description: row.description ?? '',
    priceMonthlyCents: row.priceMonthlyCents ?? row.price_monthly_cents ?? 0,
    priceAnnualCents: row.priceAnnualCents ?? row.price_annual_cents ?? 0,
    maxMembers: row.maxMembers ?? row.max_members ?? 1,
    maxAccounts: row.maxAccounts ?? row.max_accounts ?? 2,
    maxTransactionsPerMonth: row.maxTransactionsPerMonth ?? row.max_transactions_per_month ?? 500,
    maxAiQueriesPerMonth: row.maxAiQueriesPerMonth ?? row.max_ai_queries_per_month ?? 50,
    maxStorageMb: row.maxStorageMb ?? row.max_storage_mb ?? 100,
    features: parseFeatures(row.featuresJson ?? row.features_json),
    isActive: row.isActive ?? row.is_active ?? true,
  };
}

export function dbRowToSubscription(row: any, plan: SubscriptionPlan): Subscription {
  const usage = parseUsageJson(row.usageJson ?? row.usage_json);
  return {
    id: row.id,
    tenantId: row.tenantId ?? row.tenant_id,
    plan,
    status: row.status,
    billingCycle: row.billingCycle ?? row.billing_cycle ?? 'monthly',
    currentPeriodStart: row.currentPeriodStart ?? row.current_period_start,
    currentPeriodEnd: row.currentPeriodEnd ?? row.current_period_end,
    cancelAtPeriodEnd: !!(row.cancelAtPeriodEnd ?? row.cancel_at_period_end),
    trialEnd: row.trialEnd ?? row.trial_end ?? undefined,
    usage: buildUsageReport(usage, plan),
  };
}
