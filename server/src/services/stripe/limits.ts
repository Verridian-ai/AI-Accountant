/**
 * Stripe Plan Limit Enforcement
 *
 * Helpers for checking statement limits, account limits,
 * history access, feature access, and usage tracking.
 */

import { db, subscriptions, accounts } from '../../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import { PLAN_CONFIG } from './config.js';
import type { PlanType, PlanFeatures, PlanLimits, SubscriptionStatus } from './types.js';

/**
 * Plan limit enforcement methods — mixed into StripeService at runtime.
 * Exported separately to keep file sizes under 300 lines.
 */

/**
 * Get subscription status for a user
 */
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .get();

  // Get account count
  const accountsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .get();

  const accountsCount = accountsResult?.count || 0;

  if (!subscription) {
    // Return default free plan status
    return {
      plan: 'free',
      status: 'active',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      limits: PLAN_CONFIG.free.limits,
      features: PLAN_CONFIG.free.features,
      usage: {
        statementsThisMonth: 0,
        accountsCount,
      },
    };
  }

  const plan = (subscription.plan as PlanType) || 'free';
  const planConfig = PLAN_CONFIG[plan];

  return {
    plan,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
    limits: planConfig.limits,
    features: planConfig.features,
    usage: {
      statementsThisMonth: subscription.statementsThisMonth || 0,
      accountsCount,
    },
  };
}

/**
 * Check if user can upload more statements this month
 */
export async function checkStatementLimit(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  message?: string;
}> {
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .get();

  const used = subscription?.statementsThisMonth || 0;
  const limit = subscription?.statementsLimit || PLAN_CONFIG.free.limits.statementsPerMonth;

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, used, limit };
  }

  const allowed = used < limit;

  return {
    allowed,
    used,
    limit,
    message: allowed
      ? undefined
      : `Monthly statement limit reached (${used}/${limit}). Upgrade your plan for more.`,
  };
}

/**
 * Increment statement usage count
 */
export async function incrementStatementUsage(userId: string): Promise<void> {
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .get();

  const now = new Date().toISOString();

  if (subscription) {
    await db
      .update(subscriptions)
      .set({
        statementsThisMonth: (subscription.statementsThisMonth || 0) + 1,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, subscription.id));
  } else {
    // Create a free subscription if none exists
    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      userId,
      plan: 'free',
      status: 'active',
      statementsThisMonth: 1,
      statementsLimit: PLAN_CONFIG.free.limits.statementsPerMonth,
      accountsLimit: PLAN_CONFIG.free.limits.maxAccounts,
      teamSeatsLimit: PLAN_CONFIG.free.limits.teamSeats,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Check if user can add more accounts
 */
export async function checkAccountLimit(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  message?: string;
}> {
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .get();

  const limit = subscription?.accountsLimit || PLAN_CONFIG.free.limits.maxAccounts;

  // Count current accounts
  const accountsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)))
    .get();

  const used = accountsResult?.count || 0;

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, used, limit };
  }

  const allowed = used < limit;

  return {
    allowed,
    used,
    limit,
    message: allowed
      ? undefined
      : `Account limit reached (${used}/${limit}). Upgrade your plan for more accounts.`,
  };
}

/**
 * Check if user's data access is within their history limit
 */
export async function checkHistoryAccess(
  userId: string,
  requestedDate: Date,
): Promise<{
  allowed: boolean;
  historyMonths: number;
  cutoffDate: Date;
  message?: string;
}> {
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .get();

  const plan = (subscription?.plan as PlanType) || 'free';
  const historyMonths = PLAN_CONFIG[plan].limits.historyMonths;

  // -1 means unlimited
  if (historyMonths === -1) {
    return {
      allowed: true,
      historyMonths,
      cutoffDate: new Date(0), // Beginning of time
    };
  }

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - historyMonths);

  const allowed = requestedDate >= cutoffDate;

  return {
    allowed,
    historyMonths,
    cutoffDate,
    message: allowed
      ? undefined
      : `Data access limited to ${historyMonths} months of history. Upgrade for longer access.`,
  };
}

/**
 * Get features available for a plan
 */
export function getPlanFeatures(plan: PlanType): PlanFeatures {
  return PLAN_CONFIG[plan]?.features || PLAN_CONFIG.free.features;
}

/**
 * Get limits for a plan
 */
export function getPlanLimits(plan: PlanType): PlanLimits {
  return PLAN_CONFIG[plan]?.limits || PLAN_CONFIG.free.limits;
}

/**
 * Check if a specific feature is available for a user
 */
export async function checkFeatureAccess(
  userId: string,
  feature: keyof PlanFeatures,
): Promise<boolean> {
  const status = await getSubscriptionStatus(userId);
  return status.features[feature] as boolean;
}
