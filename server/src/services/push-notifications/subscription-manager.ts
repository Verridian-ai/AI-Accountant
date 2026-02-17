/**
 * Push Notification Subscription Management
 *
 * Handles VAPID configuration, subscription CRUD, and cleanup.
 */

import webpush from 'web-push';
import crypto from 'crypto';
import { db, pushSubscriptions } from '../../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';
import { config } from '../../lib/config.js';
import type { PushSubscriptionRecord, ClientPushSubscription } from '../push-notification-types.js';
import { MAX_ERROR_COUNT } from './constants.js';
import { rowToSubscription } from './helpers.js';

export class SubscriptionManager {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
  configured: boolean;

  constructor() {
    this.vapidPublicKey = config.vapidPublicKey;
    this.vapidPrivateKey = config.vapidPrivateKey;
    this.vapidSubject = config.vapidSubject;
    this.configured = false;

    this.initVapid();
  }

  /** Configure web-push with VAPID details (idempotent). */
  private initVapid(): void {
    if (this.vapidPublicKey && this.vapidPrivateKey) {
      try {
        webpush.setVapidDetails(this.vapidSubject, this.vapidPublicKey, this.vapidPrivateKey);
        this.configured = true;
      } catch (err) {
        logger.warn({ err: err }, '[PushNotification] Failed to set VAPID details:');
        this.configured = false;
      }
    } else {
      logger.warn(
        '[PushNotification] VAPID keys not configured. Push notifications disabled. ' +
          'Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT env vars.',
      );
    }
  }

  /** Returns the VAPID public key for client-side subscription */
  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }

  /** Returns whether push is properly configured */
  isConfigured(): boolean {
    return this.configured;
  }

  /** Generate a new VAPID key pair (one-time setup utility) */
  static generateVapidKeys(): { publicKey: string; privateKey: string } {
    return webpush.generateVAPIDKeys();
  }

  /**
   * Store a push subscription for a user + device.
   * Updates if the endpoint already exists (re-subscription).
   */
  async subscribe(
    userId: string,
    tenantId: string,
    subscription: ClientPushSubscription,
    deviceName?: string,
  ): Promise<void> {
    const now = new Date().toISOString();

    // Check if endpoint already exists
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
      .get();

    if (existing) {
      // Re-activate and update keys
      await db
        .update(pushSubscriptions)
        .set({
          userId,
          tenantId,
          keysJson: JSON.stringify(subscription.keys),
          deviceName:
            deviceName ?? (existing as any).deviceName ?? (existing as any).device_name ?? null,
          isActive: true,
          errorCount: 0,
          lastUsedAt: now,
          updatedAt: now,
        })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
        .run();
    } else {
      await db
        .insert(pushSubscriptions)
        .values({
          id: crypto.randomUUID(),
          userId,
          tenantId,
          endpoint: subscription.endpoint,
          keysJson: JSON.stringify(subscription.keys),
          deviceName: deviceName ?? null,
          isActive: true,
          errorCount: 0,
          lastUsedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }

  /** Remove a subscription by endpoint for a user. */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
      .run();
  }

  /** List all active subscriptions for a user in a tenant. */
  async getSubscriptions(userId: string, tenantId: string): Promise<PushSubscriptionRecord[]> {
    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.tenantId, tenantId),
          eq(pushSubscriptions.isActive, true),
        ),
      )
      .all();
    return (rows as any[]).map(rowToSubscription);
  }

  /** Deactivate a subscription (sets is_active=false). */
  async deactivateSubscription(endpoint: string): Promise<void> {
    await db
      .update(pushSubscriptions)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .run();
  }

  /** Remove all subscriptions with error_count >= MAX_ERROR_COUNT. Returns count removed. */
  async cleanupInactive(): Promise<number> {
    // Get count first since SQLite delete doesn't return count easily
    const stale = await db
      .select()
      .from(pushSubscriptions)
      .where(sql`${pushSubscriptions.errorCount} >= ${MAX_ERROR_COUNT}`)
      .all();

    if (stale.length === 0) return 0;

    await db
      .delete(pushSubscriptions)
      .where(sql`${pushSubscriptions.errorCount} >= ${MAX_ERROR_COUNT}`)
      .run();

    return stale.length;
  }
}
