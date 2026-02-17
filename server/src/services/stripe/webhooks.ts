/**
 * Stripe Webhook Event Handlers
 *
 * Processes Stripe webhook events: checkout completion,
 * subscription updates/deletions, invoice payment success/failure.
 */

import type Stripe from 'stripe';
import { db, subscriptions } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { PLAN_CONFIG } from './config.js';
import type { PlanType, WebhookResult } from './types.js';

/**
 * Determine plan from Stripe price ID
 */
function getPlanFromPriceId(
  priceId: string,
  cfg: { stripeBusinessPriceId?: string; stripeProPriceId?: string },
): PlanType {
  if (priceId === cfg.stripeBusinessPriceId) return 'business';
  if (priceId === cfg.stripeProPriceId) return 'pro';
  return 'free';
}

/**
 * Map Stripe status to our internal status
 */
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  const statusMap: Record<Stripe.Subscription.Status, string> = {
    active: 'active',
    past_due: 'past_due',
    unpaid: 'unpaid',
    canceled: 'cancelled',
    incomplete: 'active',
    incomplete_expired: 'cancelled',
    trialing: 'active',
    paused: 'active',
  };
  return statusMap[stripeStatus] || 'active';
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  stripeClient: Stripe,
  cfg: { stripeBusinessPriceId?: string; stripeProPriceId?: string },
): Promise<WebhookResult> {
  const userId = session.metadata?.userId;
  if (!userId) return { success: false, message: 'No userId in session metadata' };

  const subscriptionId = session.subscription as string;
  if (!subscriptionId) return { success: false, message: 'No subscription ID in session' };

  const stripeSubscription = await stripeClient.subscriptions.retrieve(subscriptionId);
  const priceId = stripeSubscription.items.data[0]?.price.id;
  const plan = getPlanFromPriceId(priceId, cfg);
  const planConfig = PLAN_CONFIG[plan];
  const now = new Date().toISOString();

  const currentPeriodStart = (stripeSubscription as unknown as { current_period_start: number })
    .current_period_start;
  const currentPeriodEnd = (stripeSubscription as unknown as { current_period_end: number })
    .current_period_end;

  await db
    .update(subscriptions)
    .set({
      stripeSubscriptionId: subscriptionId,
      plan,
      status: 'active',
      currentPeriodStart: currentPeriodStart
        ? new Date(currentPeriodStart * 1000).toISOString()
        : null,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      statementsLimit: planConfig.limits.statementsPerMonth,
      accountsLimit: planConfig.limits.maxAccounts,
      teamSeatsLimit: planConfig.limits.teamSeats,
      cancelAtPeriodEnd: false,
      updatedAt: now,
    })
    .where(eq(subscriptions.userId, userId));

  return {
    success: true,
    message: `Subscription activated: ${plan}`,
    data: { userId, plan, subscriptionId },
  };
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  cfg: { stripeBusinessPriceId?: string; stripeProPriceId?: string },
): Promise<WebhookResult> {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    const existingSub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
      .get();
    if (!existingSub) return { success: false, message: 'No user found for subscription' };
  }

  const priceId = subscription.items.data[0]?.price.id;
  const plan = getPlanFromPriceId(priceId, cfg);
  const planConfig = PLAN_CONFIG[plan];
  const now = new Date().toISOString();
  const status = mapStripeStatus(subscription.status);

  const currentPeriodStart = (subscription as unknown as { current_period_start: number })
    .current_period_start;
  const currentPeriodEnd = (subscription as unknown as { current_period_end: number })
    .current_period_end;

  await db
    .update(subscriptions)
    .set({
      plan,
      status,
      currentPeriodStart: currentPeriodStart
        ? new Date(currentPeriodStart * 1000).toISOString()
        : null,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      statementsLimit: planConfig.limits.statementsPerMonth,
      accountsLimit: planConfig.limits.maxAccounts,
      teamSeatsLimit: planConfig.limits.teamSeats,
      updatedAt: now,
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  return {
    success: true,
    message: `Subscription updated: ${plan} (${status})`,
    data: { plan, status },
  };
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<WebhookResult> {
  const now = new Date().toISOString();
  await db
    .update(subscriptions)
    .set({
      plan: 'free',
      status: 'cancelled',
      cancelledAt: now,
      stripeSubscriptionId: null,
      statementsLimit: PLAN_CONFIG.free.limits.statementsPerMonth,
      accountsLimit: PLAN_CONFIG.free.limits.maxAccounts,
      teamSeatsLimit: PLAN_CONFIG.free.limits.teamSeats,
      updatedAt: now,
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  return { success: true, message: 'Subscription cancelled, reverted to free plan' };
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | undefined {
  const invoiceWithSub = invoice as unknown as { subscription?: string | { id: string } | null };
  return typeof invoiceWithSub.subscription === 'string'
    ? invoiceWithSub.subscription
    : invoiceWithSub.subscription?.id;
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<WebhookResult> {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return { success: true, message: 'No subscription on invoice' };

  const now = new Date().toISOString();
  await db
    .update(subscriptions)
    .set({ statementsThisMonth: 0, status: 'active', updatedAt: now })
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

  return {
    success: true,
    message: 'Payment succeeded, usage reset',
    data: { invoiceId: invoice.id },
  };
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<WebhookResult> {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return { success: true, message: 'No subscription on invoice' };

  const now = new Date().toISOString();
  await db
    .update(subscriptions)
    .set({ status: 'past_due', updatedAt: now })
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

  return {
    success: true,
    message: 'Payment failed, subscription marked as past_due',
    data: { invoiceId: invoice.id },
  };
}

/**
 * Handle Stripe webhook events — dispatches to specific handlers.
 */
export async function handleWebhookEvent(
  event: Stripe.Event,
  stripeClient: Stripe,
  cfg: { stripeBusinessPriceId?: string; stripeProPriceId?: string },
): Promise<WebhookResult> {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(
        event.data.object as Stripe.Checkout.Session,
        stripeClient,
        cfg,
      );
    case 'customer.subscription.updated':
      return handleSubscriptionUpdated(event.data.object as Stripe.Subscription, cfg);
    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    case 'invoice.payment_succeeded':
      return handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
    default:
      return { success: true, message: `Unhandled event type: ${event.type}` };
  }
}
