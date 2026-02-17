/**
 * Subscription Lifecycle Operations
 * Subscribe, upgrade, downgrade, cancel, reactivate.
 */

import { db, subscriptionHistory } from '../../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import type { Subscription, UsageJson } from './types.js';
import { MONTHLY_DAYS, ANNUAL_DAYS, TRIAL_DAYS, addDays, dbRowToSubscription } from './types.js';
import {
  getActiveSubscriptionRow,
  getPlanByName,
  getPlan,
  getCurrentSubscription,
} from './subscription-plans.js';

export async function subscribe(
  tenantId: string,
  planName: string,
  billingCycle: 'monthly' | 'annual' = 'monthly',
): Promise<Subscription> {
  const plan = await getPlanByName(planName);
  if (!plan) throw new Error(`Plan not found: ${planName}`);

  // Cancel any existing active subscription
  const existing = await getActiveSubscriptionRow(tenantId);
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

export async function upgrade(tenantId: string, newPlanName: string): Promise<Subscription> {
  const current = await getCurrentSubscription(tenantId);
  if (!current) throw new Error('No active subscription to upgrade');

  const newPlan = await getPlanByName(newPlanName);
  if (!newPlan) throw new Error(`Plan not found: ${newPlanName}`);

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

export async function downgrade(tenantId: string, newPlanName: string): Promise<Subscription> {
  const current = await getCurrentSubscription(tenantId);
  if (!current) throw new Error('No active subscription to downgrade');

  const newPlan = await getPlanByName(newPlanName);
  if (!newPlan) throw new Error(`Plan not found: ${newPlanName}`);

  const activeRow = await getActiveSubscriptionRow(tenantId);
  if (activeRow) {
    await db
      .update(subscriptionHistory)
      .set({ cancelAtPeriodEnd: true, updatedAt: new Date().toISOString() })
      .where(eq(subscriptionHistory.id, activeRow.id))
      .run();
  }

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
  return { ...current, cancelAtPeriodEnd: true };
}

export async function cancel(tenantId: string): Promise<Subscription> {
  const current = await getCurrentSubscription(tenantId);
  if (!current) throw new Error('No active subscription to cancel');

  const activeRow = await getActiveSubscriptionRow(tenantId);
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

  return { ...current, cancelAtPeriodEnd: true };
}

export async function reactivate(tenantId: string): Promise<Subscription> {
  const activeRow = await getActiveSubscriptionRow(tenantId);
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

  const plan = await getPlan(activeRow.planId ?? activeRow.plan_id);
  if (!plan) throw new Error('Associated plan not found');

  return dbRowToSubscription({ ...activeRow, cancelAtPeriodEnd: false, cancelledAt: null }, plan);
}

export async function getSubscriptionHistory(tenantId: string): Promise<Subscription[]> {
  const rows = await db
    .select()
    .from(subscriptionHistory)
    .where(eq(subscriptionHistory.tenantId, tenantId))
    .orderBy(desc(subscriptionHistory.createdAt))
    .all();

  const results: Subscription[] = [];
  for (const row of rows) {
    const planId = row.planId ?? (row as any).plan_id;
    const plan = await getPlan(planId);
    if (plan) {
      results.push(dbRowToSubscription(row, plan));
    }
  }
  return results;
}
