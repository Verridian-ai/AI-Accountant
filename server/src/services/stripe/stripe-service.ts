/**
 * Stripe Service — Core class with payment, billing, and subscription operations
 *
 * Delegates webhook handling to ./webhooks.ts and limit checks to ./limits.ts
 * to stay under 300 lines while preserving the public API.
 */

import Stripe from 'stripe';
import { db, subscriptions } from '../../schema.js';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import { logger } from '../../lib/logger.js';
import { config } from '../../lib/config.js';
import { PLAN_CONFIG } from './config.js';
import type {
  PlanType,
  PlanFeatures,
  PlanLimits,
  SubscriptionStatus,
  WebhookResult,
} from './types.js';
import { handleWebhookEvent } from './webhooks.js';
import {
  getSubscriptionStatus as _getSubscriptionStatus,
  checkStatementLimit as _checkStatementLimit,
  incrementStatementUsage as _incrementStatementUsage,
  checkAccountLimit as _checkAccountLimit,
  checkHistoryAccess as _checkHistoryAccess,
  getPlanFeatures as _getPlanFeatures,
  getPlanLimits as _getPlanLimits,
  checkFeatureAccess as _checkFeatureAccess,
} from './limits.js';

// Initialize Stripe client
const stripeSecretKey = config.stripeSecretKey;
if (!stripeSecretKey) {
  logger.error(
    '[StripeService] STRIPE_SECRET_KEY is not configured. Payment features will be unavailable.',
  );
}
const stripe = new Stripe(stripeSecretKey || 'sk_placeholder_not_configured');

export { stripe, stripeSecretKey };

export class StripeService {
  async createCustomer(userId: string, email: string): Promise<string> {
    const customer = await stripe.customers.create({ email, metadata: { userId } });

    const existing = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .get();

    const now = new Date().toISOString();

    if (existing) {
      await db
        .update(subscriptions)
        .set({ stripeCustomerId: customer.id, updatedAt: now })
        .where(eq(subscriptions.id, existing.id));
    } else {
      await db.insert(subscriptions).values({
        id: crypto.randomUUID(),
        userId,
        stripeCustomerId: customer.id,
        plan: 'free',
        status: 'active',
        statementsThisMonth: 0,
        statementsLimit: PLAN_CONFIG.free.limits.statementsPerMonth,
        accountsLimit: PLAN_CONFIG.free.limits.maxAccounts,
        teamSeatsLimit: PLAN_CONFIG.free.limits.teamSeats,
        createdAt: now,
        updatedAt: now,
      });
    }
    return customer.id;
  }

  private validateRedirectUrl(url: string): boolean {
    const appUrl = config.appUrl;
    try {
      const parsedUrl = new URL(url);
      const parsedAppUrl = new URL(appUrl);
      return parsedUrl.origin === parsedAppUrl.origin;
    } catch {
      return false;
    }
  }

  async createCheckoutSession(
    userId: string,
    priceId: string,
    successUrl: string = `${process.env.APP_URL || 'http://localhost:5173'}/settings/billing?success=true`,
    cancelUrl: string = `${process.env.APP_URL || 'http://localhost:5173'}/settings/billing?canceled=true`,
  ): Promise<{ sessionId: string; url: string }> {
    if (!this.validateRedirectUrl(successUrl)) {
      throw new Error('Invalid success URL: must be same origin as application');
    }
    if (!this.validateRedirectUrl(cancelUrl)) {
      throw new Error('Invalid cancel URL: must be same origin as application');
    }

    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .get();

    if (!subscription?.stripeCustomerId) {
      throw new Error('No Stripe customer found for user. Please create a customer first.');
    }

    const session = await stripe.checkout.sessions.create({
      customer: subscription.stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId },
      subscription_data: { metadata: { userId } },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    return { sessionId: session.id, url: session.url || '' };
  }

  async handleWebhook(event: Stripe.Event): Promise<WebhookResult> {
    return handleWebhookEvent(event, stripe, config);
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelImmediately: boolean = false,
  ): Promise<void> {
    if (cancelImmediately) {
      await stripe.subscriptions.cancel(subscriptionId);
    } else {
      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    }
    const now = new Date().toISOString();
    await db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: !cancelImmediately,
        cancelledAt: cancelImmediately ? now : null,
        status: cancelImmediately ? 'cancelled' : 'active',
        updatedAt: now,
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
  }

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    return _getSubscriptionStatus(userId);
  }

  async updatePaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  async createBillingPortalSession(
    customerId: string,
    returnUrl: string = `${process.env.APP_URL || 'http://localhost:5173'}/settings/billing`,
  ): Promise<{ url: string }> {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  async checkStatementLimit(userId: string) {
    return _checkStatementLimit(userId);
  }
  async incrementStatementUsage(userId: string) {
    return _incrementStatementUsage(userId);
  }
  async checkAccountLimit(userId: string) {
    return _checkAccountLimit(userId);
  }
  async checkHistoryAccess(userId: string, requestedDate: Date) {
    return _checkHistoryAccess(userId, requestedDate);
  }
  getPlanFeatures(plan: PlanType): PlanFeatures {
    return _getPlanFeatures(plan);
  }
  getPlanLimits(plan: PlanType): PlanLimits {
    return _getPlanLimits(plan);
  }
  async checkFeatureAccess(userId: string, feature: keyof PlanFeatures) {
    return _checkFeatureAccess(userId, feature);
  }

  static constructEventFromPayload(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string,
  ): Stripe.Event {
    if (!stripeSecretKey) {
      throw new Error('Stripe is not configured. Cannot verify webhook signature.');
    }
    if (!webhookSecret) {
      throw new Error('Webhook secret is not provided. Cannot verify webhook signature.');
    }
    if (!signature) {
      throw new Error('Webhook signature is missing from request.');
    }
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  async getCustomerPortalUrl(userId: string): Promise<string | null> {
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .get();
    if (!subscription?.stripeCustomerId) return null;
    const session = await this.createBillingPortalSession(subscription.stripeCustomerId);
    return session.url;
  }

  async ensureSubscription(userId: string): Promise<void> {
    const existing = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .get();
    if (!existing) {
      const now = new Date().toISOString();
      await db.insert(subscriptions).values({
        id: crypto.randomUUID(),
        userId,
        plan: 'free',
        status: 'active',
        statementsThisMonth: 0,
        statementsLimit: PLAN_CONFIG.free.limits.statementsPerMonth,
        accountsLimit: PLAN_CONFIG.free.limits.maxAccounts,
        teamSeatsLimit: PLAN_CONFIG.free.limits.teamSeats,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

// Export singleton instance
export const stripeService = new StripeService();
