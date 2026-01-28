import Stripe from 'stripe';
import { db, subscriptions, accounts } from '../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import * as crypto from 'crypto';

// Initialize Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    console.error('[StripeService] STRIPE_SECRET_KEY is not configured. Payment features will be unavailable.');
}
const stripe = new Stripe(stripeSecretKey || 'sk_placeholder_not_configured');

// Plan configuration
export const PLAN_CONFIG = {
    free: {
        name: 'Free',
        price: 0,
        priceId: null,
        limits: {
            statementsPerMonth: 5,
            historyMonths: 6,
            maxAccounts: 2,
            teamSeats: 0,
        },
        features: {
            basicParsing: true,
            advancedCategorization: false,
            taxReporting: false,
            multiBank: false,
            apiAccess: false,
            prioritySupport: false,
            customCategories: false,
            exportFormats: ['csv'],
            ragSearch: false,
        },
    },
    pro: {
        name: 'Pro',
        price: 2900, // $29/month in cents
        priceId: process.env.STRIPE_PRO_PRICE_ID || '',
        limits: {
            statementsPerMonth: 50,
            historyMonths: 24, // 2 years
            maxAccounts: 10,
            teamSeats: 0,
        },
        features: {
            basicParsing: true,
            advancedCategorization: true,
            taxReporting: true,
            multiBank: true,
            apiAccess: false,
            prioritySupport: false,
            customCategories: true,
            exportFormats: ['csv', 'xlsx', 'pdf'],
            ragSearch: true,
        },
    },
    business: {
        name: 'Business',
        price: 7900, // $79/month in cents
        priceId: process.env.STRIPE_BUSINESS_PRICE_ID || '',
        limits: {
            statementsPerMonth: -1, // Unlimited
            historyMonths: -1, // Unlimited
            maxAccounts: -1, // Unlimited
            teamSeats: 5,
        },
        features: {
            basicParsing: true,
            advancedCategorization: true,
            taxReporting: true,
            multiBank: true,
            apiAccess: true,
            prioritySupport: true,
            customCategories: true,
            exportFormats: ['csv', 'xlsx', 'pdf', 'json'],
            ragSearch: true,
        },
    },
} as const;

export type PlanType = keyof typeof PLAN_CONFIG;
export type PlanFeatures = typeof PLAN_CONFIG[PlanType]['features'];
export type PlanLimits = typeof PLAN_CONFIG[PlanType]['limits'];

export interface SubscriptionStatus {
    plan: PlanType;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    limits: PlanLimits;
    features: PlanFeatures;
    usage: {
        statementsThisMonth: number;
        accountsCount: number;
    };
}

export interface WebhookResult {
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
}

export class StripeService {

    /**
     * Create a new Stripe customer for a user
     */
    async createCustomer(userId: string, email: string): Promise<string> {
        const customer = await stripe.customers.create({
            email,
            metadata: {
                userId,
            },
        });

        // Update or create subscription record with Stripe customer ID
        const existing = await db.select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, userId))
            .get();

        const now = new Date().toISOString();

        if (existing) {
            await db.update(subscriptions)
                .set({
                    stripeCustomerId: customer.id,
                    updatedAt: now,
                })
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

    /**
     * Validate that a URL is safe for redirect (prevents open redirect attacks)
     */
    private validateRedirectUrl(url: string): boolean {
        const appUrl = process.env.APP_URL || 'http://localhost:5173';
        try {
            const parsedUrl = new URL(url);
            const parsedAppUrl = new URL(appUrl);
            // Only allow redirects to the same origin as APP_URL
            return parsedUrl.origin === parsedAppUrl.origin;
        } catch {
            return false;
        }
    }

    /**
     * Create a Stripe Checkout session for subscription
     */
    async createCheckoutSession(
        userId: string,
        priceId: string,
        successUrl: string = `${process.env.APP_URL || 'http://localhost:5173'}/settings/billing?success=true`,
        cancelUrl: string = `${process.env.APP_URL || 'http://localhost:5173'}/settings/billing?canceled=true`
    ): Promise<{ sessionId: string; url: string }> {
        // Validate redirect URLs to prevent open redirect attacks
        if (!this.validateRedirectUrl(successUrl)) {
            throw new Error('Invalid success URL: must be same origin as application');
        }
        if (!this.validateRedirectUrl(cancelUrl)) {
            throw new Error('Invalid cancel URL: must be same origin as application');
        }

        // Get or create Stripe customer
        const subscription = await db.select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, userId))
            .get();

        if (!subscription?.stripeCustomerId) {
            throw new Error('No Stripe customer found for user. Please create a customer first.');
        }

        const session = await stripe.checkout.sessions.create({
            customer: subscription.stripeCustomerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                userId,
            },
            subscription_data: {
                metadata: {
                    userId,
                },
            },
            allow_promotion_codes: true,
            billing_address_collection: 'required',
        });

        return {
            sessionId: session.id,
            url: session.url || '',
        };
    }

    /**
     * Handle Stripe webhook events
     */
    async handleWebhook(event: Stripe.Event): Promise<WebhookResult> {
        switch (event.type) {
            case 'checkout.session.completed':
                return this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);

            case 'customer.subscription.updated':
                return this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);

            case 'customer.subscription.deleted':
                return this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);

            case 'invoice.payment_succeeded':
                return this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);

            case 'invoice.payment_failed':
                return this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);

            default:
                return {
                    success: true,
                    message: `Unhandled event type: ${event.type}`,
                };
        }
    }

    /**
     * Handle checkout.session.completed event
     */
    private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<WebhookResult> {
        const userId = session.metadata?.userId;
        if (!userId) {
            return { success: false, message: 'No userId in session metadata' };
        }

        const subscriptionId = session.subscription as string;
        if (!subscriptionId) {
            return { success: false, message: 'No subscription ID in session' };
        }

        // Fetch the full subscription details
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = stripeSubscription.items.data[0]?.price.id;

        // Determine plan from price ID
        const plan = this.getPlanFromPriceId(priceId);
        const planConfig = PLAN_CONFIG[plan];

        const now = new Date().toISOString();

        // Get billing cycle dates from the subscription
        const currentPeriodStart = (stripeSubscription as unknown as { current_period_start: number }).current_period_start;
        const currentPeriodEnd = (stripeSubscription as unknown as { current_period_end: number }).current_period_end;

        await db.update(subscriptions)
            .set({
                stripeSubscriptionId: subscriptionId,
                plan,
                status: 'active',
                currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart * 1000).toISOString() : null,
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

    /**
     * Handle customer.subscription.updated event
     */
    private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<WebhookResult> {
        const userId = subscription.metadata?.userId;
        if (!userId) {
            // Try to find by customer ID
            const existingSub = await db.select()
                .from(subscriptions)
                .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
                .get();

            if (!existingSub) {
                return { success: false, message: 'No user found for subscription' };
            }
        }

        const priceId = subscription.items.data[0]?.price.id;
        const plan = this.getPlanFromPriceId(priceId);
        const planConfig = PLAN_CONFIG[plan];

        const now = new Date().toISOString();
        const status = this.mapStripeStatus(subscription.status);

        // Get billing cycle dates from the subscription
        const currentPeriodStart = (subscription as unknown as { current_period_start: number }).current_period_start;
        const currentPeriodEnd = (subscription as unknown as { current_period_end: number }).current_period_end;

        await db.update(subscriptions)
            .set({
                plan,
                status,
                currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart * 1000).toISOString() : null,
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

    /**
     * Handle customer.subscription.deleted event
     */
    private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<WebhookResult> {
        const now = new Date().toISOString();

        // Revert to free plan
        await db.update(subscriptions)
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

        return {
            success: true,
            message: 'Subscription cancelled, reverted to free plan',
        };
    }

    /**
     * Handle invoice.payment_succeeded event
     */
    private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<WebhookResult> {
        // Get subscription ID from invoice - handle different possible shapes
        const invoiceWithSub = invoice as unknown as { subscription?: string | { id: string } | null };
        const subscriptionId = typeof invoiceWithSub.subscription === 'string'
            ? invoiceWithSub.subscription
            : invoiceWithSub.subscription?.id;

        if (!subscriptionId) {
            return { success: true, message: 'No subscription on invoice' };
        }

        const now = new Date().toISOString();

        // Reset monthly statement count on successful renewal
        await db.update(subscriptions)
            .set({
                statementsThisMonth: 0,
                status: 'active',
                updatedAt: now,
            })
            .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

        return {
            success: true,
            message: 'Payment succeeded, usage reset',
            data: { invoiceId: invoice.id },
        };
    }

    /**
     * Handle invoice.payment_failed event
     */
    private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<WebhookResult> {
        // Get subscription ID from invoice - handle different possible shapes
        const invoiceWithSub = invoice as unknown as { subscription?: string | { id: string } | null };
        const subscriptionId = typeof invoiceWithSub.subscription === 'string'
            ? invoiceWithSub.subscription
            : invoiceWithSub.subscription?.id;

        if (!subscriptionId) {
            return { success: true, message: 'No subscription on invoice' };
        }

        const now = new Date().toISOString();

        await db.update(subscriptions)
            .set({
                status: 'past_due',
                updatedAt: now,
            })
            .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

        return {
            success: true,
            message: 'Payment failed, subscription marked as past_due',
            data: { invoiceId: invoice.id },
        };
    }

    /**
     * Cancel a subscription
     */
    async cancelSubscription(subscriptionId: string, cancelImmediately: boolean = false): Promise<void> {
        if (cancelImmediately) {
            await stripe.subscriptions.cancel(subscriptionId);
        } else {
            await stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: true,
            });
        }

        const now = new Date().toISOString();

        await db.update(subscriptions)
            .set({
                cancelAtPeriodEnd: !cancelImmediately,
                cancelledAt: cancelImmediately ? now : null,
                status: cancelImmediately ? 'cancelled' : 'active',
                updatedAt: now,
            })
            .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
    }

    /**
     * Get subscription status for a user
     */
    async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
        const subscription = await db.select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, userId))
            .get();

        // Get account count
        const accountsResult = await db.select({ count: sql<number>`count(*)` })
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
     * Update payment method for a customer
     */
    async updatePaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
        // Attach the payment method to the customer
        await stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId,
        });

        // Set as default payment method
        await stripe.customers.update(customerId, {
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        });
    }

    /**
     * Create a billing portal session for subscription management
     */
    async createBillingPortalSession(
        customerId: string,
        returnUrl: string = `${process.env.APP_URL || 'http://localhost:5173'}/settings/billing`
    ): Promise<{ url: string }> {
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });

        return { url: session.url };
    }

    // =========================================================================
    // PLAN LIMIT ENFORCEMENT HELPERS
    // =========================================================================

    /**
     * Check if user can upload more statements this month
     */
    async checkStatementLimit(userId: string): Promise<{
        allowed: boolean;
        used: number;
        limit: number;
        message?: string;
    }> {
        const subscription = await db.select()
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
            message: allowed ? undefined : `Monthly statement limit reached (${used}/${limit}). Upgrade your plan for more.`,
        };
    }

    /**
     * Increment statement usage count
     */
    async incrementStatementUsage(userId: string): Promise<void> {
        const subscription = await db.select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, userId))
            .get();

        const now = new Date().toISOString();

        if (subscription) {
            await db.update(subscriptions)
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
    async checkAccountLimit(userId: string): Promise<{
        allowed: boolean;
        used: number;
        limit: number;
        message?: string;
    }> {
        const subscription = await db.select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, userId))
            .get();

        const limit = subscription?.accountsLimit || PLAN_CONFIG.free.limits.maxAccounts;

        // Count current accounts
        const accountsResult = await db.select({ count: sql<number>`count(*)` })
            .from(accounts)
            .where(and(
                eq(accounts.userId, userId),
                eq(accounts.isActive, true)
            ))
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
            message: allowed ? undefined : `Account limit reached (${used}/${limit}). Upgrade your plan for more accounts.`,
        };
    }

    /**
     * Check if user's data access is within their history limit
     */
    async checkHistoryAccess(userId: string, requestedDate: Date): Promise<{
        allowed: boolean;
        historyMonths: number;
        cutoffDate: Date;
        message?: string;
    }> {
        const subscription = await db.select()
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
            message: allowed ? undefined : `Data access limited to ${historyMonths} months of history. Upgrade for longer access.`,
        };
    }

    /**
     * Get features available for a plan
     */
    getPlanFeatures(plan: PlanType): PlanFeatures {
        return PLAN_CONFIG[plan]?.features || PLAN_CONFIG.free.features;
    }

    /**
     * Get limits for a plan
     */
    getPlanLimits(plan: PlanType): PlanLimits {
        return PLAN_CONFIG[plan]?.limits || PLAN_CONFIG.free.limits;
    }

    /**
     * Check if a specific feature is available for a user
     */
    async checkFeatureAccess(userId: string, feature: keyof PlanFeatures): Promise<boolean> {
        const status = await this.getSubscriptionStatus(userId);
        return status.features[feature] as boolean;
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Map Stripe status to our internal status
     */
    private mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
        const statusMap: Record<Stripe.Subscription.Status, string> = {
            active: 'active',
            past_due: 'past_due',
            unpaid: 'unpaid',
            canceled: 'cancelled',
            incomplete: 'active', // Treat as active, payment is pending
            incomplete_expired: 'cancelled',
            trialing: 'active',
            paused: 'active', // Paused subscriptions are still technically active
        };
        return statusMap[stripeStatus] || 'active';
    }

    /**
     * Determine plan from Stripe price ID
     */
    private getPlanFromPriceId(priceId: string): PlanType {
        if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) {
            return 'business';
        }
        if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
            return 'pro';
        }
        return 'free';
    }

    /**
     * Verify webhook signature
     * @throws Error if Stripe is not configured or signature is invalid
     */
    static constructEventFromPayload(
        payload: string | Buffer,
        signature: string,
        webhookSecret: string
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

    /**
     * Get Stripe customer portal URL
     */
    async getCustomerPortalUrl(userId: string): Promise<string | null> {
        const subscription = await db.select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, userId))
            .get();

        if (!subscription?.stripeCustomerId) {
            return null;
        }

        const session = await this.createBillingPortalSession(subscription.stripeCustomerId);
        return session.url;
    }

    /**
     * Get or create subscription for user
     */
    async ensureSubscription(userId: string): Promise<void> {
        const existing = await db.select()
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
