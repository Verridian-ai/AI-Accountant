/**
 * Subscription Plan Management & Internal Helpers
 */

import { db, subscriptionPlans, subscriptionHistory } from '../../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import type { SubscriptionPlan, Subscription } from './types.js';
import { dbPlanToSubscriptionPlan, dbRowToSubscription } from './types.js';

// ============================================================================
// INTERNAL HELPER
// ============================================================================

export async function getActiveSubscriptionRow(tenantId: string): Promise<any> {
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

// ============================================================================
// PLAN MANAGEMENT
// ============================================================================

export async function getPlans(): Promise<SubscriptionPlan[]> {
  const rows = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(subscriptionPlans.sortOrder)
    .all();
  return rows.map(dbPlanToSubscriptionPlan);
}

export async function getPlan(planId: string): Promise<SubscriptionPlan | null> {
  const row = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId))
    .get();
  return row ? dbPlanToSubscriptionPlan(row) : null;
}

export async function getPlanByName(name: string): Promise<SubscriptionPlan | null> {
  const row = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.name, name))
    .get();
  return row ? dbPlanToSubscriptionPlan(row) : null;
}

// ============================================================================
// CURRENT SUBSCRIPTION
// ============================================================================

export async function getCurrentSubscription(tenantId: string): Promise<Subscription | null> {
  const row = await getActiveSubscriptionRow(tenantId);
  if (!row) return null;

  const planId = row.planId ?? row.plan_id;
  const plan = await getPlan(planId);
  if (!plan) return null;

  return dbRowToSubscription(row, plan);
}
