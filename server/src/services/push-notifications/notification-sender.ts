/**
 * Push Notification Sending & Delivery
 *
 * Handles notification dispatch and delivery to endpoints.
 */

import webpush from 'web-push';
import { db, pushSubscriptions, tenantMembers } from '../../schema.js';
import { eq, sql } from 'drizzle-orm';
import type { TenantRole } from '../tenant-types.js';
import { logger } from '../../lib/logger.js';
import type {
  NotificationPayload,
  NotificationCategory,
  SendResult,
  BulkSendResult,
} from './types.js';
import { MAX_ERROR_COUNT, DEFAULT_ICON, DEFAULT_BADGE, BULK_SEND_DELAY_MS } from './constants.js';
import { delay } from './helpers.js';
import { checkQuietHours, isNotificationEnabled } from './preference-checks.js';
import type { SubscriptionManager } from './subscription-manager.js';

export class NotificationSender {
  constructor(private manager: SubscriptionManager) {}

  /**
   * Send a notification to all active subscriptions for a user.
   * Respects quiet hours and category toggles.
   */
  async sendNotification(
    userId: string,
    tenantId: string,
    payload: NotificationPayload,
    category?: NotificationCategory,
  ): Promise<SendResult> {
    const result: SendResult = { sent: 0, failed: 0, skipped: 0, errors: [] };

    if (!this.manager.configured) {
      result.skipped = 1;
      return result;
    }

    // Check category preference
    if (category) {
      const enabled = await isNotificationEnabled(userId, tenantId, category);
      if (!enabled) {
        result.skipped = 1;
        return result;
      }
    }

    // Check quiet hours
    const inQuietHours = await checkQuietHours(userId, tenantId);
    if (inQuietHours) {
      result.skipped = 1;
      return result;
    }

    // Get all active subscriptions for the user
    const subscriptions = await this.manager.getSubscriptions(userId, tenantId);
    if (subscriptions.length === 0) {
      result.skipped = 1;
      return result;
    }

    // Deliver to each endpoint
    for (const sub of subscriptions) {
      const success = await this.deliverToEndpoint(sub.endpoint, sub.keysJson, payload);
      if (success) {
        result.sent++;
      } else {
        result.failed++;
        result.errors.push({ endpoint: sub.endpoint, error: 'Delivery failed' });
      }
    }

    return result;
  }

  /**
   * Send a notification to all members of a tenant.
   * Optionally filter by role(s).
   */
  async sendToTenant(
    tenantId: string,
    payload: NotificationPayload,
    category?: NotificationCategory,
    roles?: TenantRole[],
  ): Promise<SendResult> {
    const aggregate: SendResult = { sent: 0, failed: 0, skipped: 0, errors: [] };

    if (!this.manager.configured) {
      aggregate.skipped = 1;
      return aggregate;
    }

    // Get tenant members (optionally filtered by role)
    const membersQuery = db
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.tenantId, tenantId));

    const members = await membersQuery.all();

    for (const member of members) {
      const memberRole = ((member as Record<string, unknown>).role ?? 'viewer') as TenantRole;
      const memberUserId = String(
        (member as Record<string, unknown>).userId ??
          (member as Record<string, unknown>).user_id ??
          '',
      );

      // Filter by roles if specified
      if (roles && roles.length > 0 && !roles.includes(memberRole)) {
        aggregate.skipped++;
        continue;
      }

      const userResult = await this.sendNotification(memberUserId, tenantId, payload, category);

      aggregate.sent += userResult.sent;
      aggregate.failed += userResult.failed;
      aggregate.skipped += userResult.skipped;
      aggregate.errors.push(...userResult.errors);
    }

    return aggregate;
  }

  /**
   * Batch send notifications with rate limiting.
   */
  async sendBulk(
    notifications: Array<{
      userId: string;
      tenantId: string;
      payload: NotificationPayload;
      category?: NotificationCategory;
    }>,
  ): Promise<BulkSendResult> {
    const bulkResult: BulkSendResult = {
      totalSent: 0,
      totalFailed: 0,
      totalSkipped: 0,
      results: [],
    };

    for (const notif of notifications) {
      const result = await this.sendNotification(
        notif.userId,
        notif.tenantId,
        notif.payload,
        notif.category,
      );
      bulkResult.results.push(result);
      bulkResult.totalSent += result.sent;
      bulkResult.totalFailed += result.failed;
      bulkResult.totalSkipped += result.skipped;

      // Rate limit between sends
      if (notifications.length > 1) {
        await delay(BULK_SEND_DELAY_MS);
      }
    }

    return bulkResult;
  }

  /**
   * Deliver a notification payload to a single push endpoint.
   * Increments error_count on failure, deactivates at MAX_ERROR_COUNT.
   * Returns true on success, false on failure.
   */
  async deliverToEndpoint(
    endpoint: string,
    keys: { p256dh: string; auth: string },
    payload: NotificationPayload,
  ): Promise<boolean> {
    if (!this.manager.configured) return false;

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon ?? DEFAULT_ICON,
      badge: payload.badge ?? DEFAULT_BADGE,
      tag: payload.tag,
      data: {
        ...payload.data,
        url: payload.url,
      },
      actions: payload.actions,
      requireInteraction: payload.requireInteraction ?? false,
    });

    try {
      await webpush.sendNotification(
        {
          endpoint,
          keys: {
            p256dh: keys.p256dh,
            auth: keys.auth,
          },
        },
        pushPayload,
        { TTL: 60 * 60 }, // 1 hour time-to-live
      );

      // Update last_used_at on success
      await db
        .update(pushSubscriptions)
        .set({
          lastUsedAt: new Date().toISOString(),
          errorCount: 0,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(pushSubscriptions.endpoint, endpoint))
        .run();

      return true;
    } catch (err: unknown) {
      const statusCode = ((err as Record<string, unknown>)?.statusCode as number) ?? 0;

      // 410 Gone or 404 = subscription no longer valid -> deactivate immediately
      if (statusCode === 410 || statusCode === 404) {
        await this.manager.deactivateSubscription(endpoint);
        return false;
      }

      // Other errors -> increment error_count
      await db
        .update(pushSubscriptions)
        .set({
          errorCount: sql`${pushSubscriptions.errorCount} + 1`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(pushSubscriptions.endpoint, endpoint))
        .run();

      // Check if we should deactivate
      const sub = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, endpoint))
        .get();

      if (sub) {
        const errorCount = Number(
          (sub as Record<string, unknown>).errorCount ??
            (sub as Record<string, unknown>).error_count ??
            0,
        );
        if (errorCount >= MAX_ERROR_COUNT) {
          await this.manager.deactivateSubscription(endpoint);
        }
      }

      logger.warn(
        `[PushNotification] Delivery failed for ${endpoint}: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
      return false;
    }
  }
}
