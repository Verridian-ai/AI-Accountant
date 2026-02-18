/**
 * Subscription Service — Internal Types & Helpers
 *
 * Core type definitions for the subscription management system.
 * Helper functions for parsing DB rows into typed subscription objects.
 */

// ============================================================================
// PLAN & SUBSCRIPTION TYPES
// ============================================================================

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

// ============================================================================
// USAGE TYPES
// ============================================================================

export type UsageMetric = 'members' | 'accounts' | 'transactions' | 'aiQueries' | 'storageMb';

export interface UsageEntry {
  current: number;
  limit: number;
  percentUsed: number;
}

export interface UsageReport {
  members: UsageEntry;
  accounts: UsageEntry;
  transactions: UsageEntry;
  aiQueries: UsageEntry;
  storageMb: UsageEntry;
}

export interface UsageStatus {
  metric: UsageMetric;
  current: number;
  limit: number;
  percentUsed: number;
  allowed: boolean;
}

// ============================================================================
// RAW USAGE JSON (stored in DB)
// ============================================================================

export interface UsageJson {
  members: number;
  accounts: number;
  transactions: number;
  aiQueries: number;
  storageMb: number;
}

// ============================================================================
// ERROR CLASS
// ============================================================================

export class UsageLimitExceededError extends Error {
  constructor(
    public metric: UsageMetric,
    public current: number,
    public limit: number,
    public planName: string,
  ) {
    super(
      `${metric} limit exceeded: ${current}/${limit} on ${planName} plan. Upgrade to increase limits.`,
    );
    this.name = 'UsageLimitExceededError';
  }
}

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

export function dbPlanToSubscriptionPlan(row: Record<string, unknown>): SubscriptionPlan {
  return {
    id: String(row.id),
    name: String(row.name),
    displayName: String(row.displayName ?? row.display_name ?? ''),
    description: String(row.description ?? ''),
    priceMonthlyCents: Number(row.priceMonthlyCents ?? row.price_monthly_cents ?? 0),
    priceAnnualCents: Number(row.priceAnnualCents ?? row.price_annual_cents ?? 0),
    maxMembers: Number(row.maxMembers ?? row.max_members ?? 1),
    maxAccounts: Number(row.maxAccounts ?? row.max_accounts ?? 2),
    maxTransactionsPerMonth: Number(
      row.maxTransactionsPerMonth ?? row.max_transactions_per_month ?? 500,
    ),
    maxAiQueriesPerMonth: Number(row.maxAiQueriesPerMonth ?? row.max_ai_queries_per_month ?? 50),
    maxStorageMb: Number(row.maxStorageMb ?? row.max_storage_mb ?? 100),
    features: parseFeatures(String(row.featuresJson ?? row.features_json ?? '')),
    isActive: Boolean(row.isActive ?? row.is_active ?? true),
  };
}

export function dbRowToSubscription(
  row: Record<string, unknown>,
  plan: SubscriptionPlan,
): Subscription {
  const usage = parseUsageJson(String(row.usageJson ?? row.usage_json ?? ''));
  return {
    id: String(row.id),
    tenantId: String(row.tenantId ?? row.tenant_id),
    plan,
    status: (row.status as Subscription['status']) ?? 'active',
    billingCycle: (row.billingCycle ?? row.billing_cycle ?? 'monthly') as 'monthly' | 'annual',
    currentPeriodStart: String(row.currentPeriodStart ?? row.current_period_start),
    currentPeriodEnd: String(row.currentPeriodEnd ?? row.current_period_end),
    cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd ?? row.cancel_at_period_end),
    trialEnd: (row.trialEnd ?? row.trial_end) ? String(row.trialEnd ?? row.trial_end) : undefined,
    usage: buildUsageReport(usage, plan),
  };
}
