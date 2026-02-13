/**
 * Subscription Types
 * TypeScript types for the subscription management system.
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
