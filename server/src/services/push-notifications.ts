/**
 * Push Notification Service (Wave 24)
 *
 * Core push notification service using the web-push library with VAPID authentication.
 * Handles subscription management, notification delivery, quiet hours, and category filtering.
 *
 * Architecture:
 * - Subscriptions stored in `push_subscriptions` table (per user + device)
 * - Preferences stored in `notification_preferences` table (per user + tenant)
 * - VAPID keys read from env vars (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)
 * - Failed deliveries increment error_count; deactivated at 5 failures
 * - Quiet hours and per-category toggles respected before sending
 */

import webpush from 'web-push';
import crypto from 'crypto';
import { db, pushSubscriptions, notificationPreferences, tenantMembers } from '../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import type { TenantRole } from './tenant-types.js';
import type {
  NotificationPayload,
  NotificationCategory,
  SendResult,
  BulkSendResult,
  PushSubscriptionRecord,
  ClientPushSubscription,
} from './push-notification-types.js';
import { CATEGORY_TO_COLUMN } from './push-notification-types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum errors before a subscription is deactivated */
const MAX_ERROR_COUNT = 5;

/** Default notification icon */
const DEFAULT_ICON = '/icons/icon-192.png';

/** Default notification badge */
const DEFAULT_BADGE = '/icons/badge-72.png';

/** Rate limit: ms between bulk sends (per notification) */
const BULK_SEND_DELAY_MS = 50;

// ============================================================================
// HELPERS
// ============================================================================

/** Parse keys JSON from DB (stored as text) */
function parseKeysJson(raw: unknown): { p256dh: string; auth: string } {
  if (!raw) return { p256dh: '', auth: '' };
  if (typeof raw === 'object') return raw as { p256dh: string; auth: string };
  try {
    return JSON.parse(raw as string);
  } catch {
    return { p256dh: '', auth: '' };
  }
}

/** Convert raw DB row to PushSubscriptionRecord */
function rowToSubscription(row: any): PushSubscriptionRecord {
  return {
    id: row.id,
    userId: row.userId ?? row.user_id,
    tenantId: row.tenantId ?? row.tenant_id,
    endpoint: row.endpoint,
    keysJson: parseKeysJson(row.keysJson ?? row.keys_json),
    deviceName: row.deviceName ?? row.device_name ?? undefined,
    isActive: Boolean(row.isActive ?? row.is_active ?? true),
    lastUsedAt: row.lastUsedAt ?? row.last_used_at ?? undefined,
    errorCount: Number(row.errorCount ?? row.error_count ?? 0),
  };
}

/**
 * Get current time as HH:MM in the given IANA timezone.
 * Falls back to Australia/Sydney if the timezone is invalid.
 */
function getCurrentTimeInTimezone(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(new Date());
  } catch {
    const formatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(new Date());
  }
}

/**
 * Check if a HH:MM time is within a quiet window.
 * Handles overnight ranges (e.g., 22:00 → 07:00).
 */
function isTimeInRange(current: string, start: string, end: string): boolean {
  if (start <= end) {
    // Same-day range: e.g., 09:00 → 17:00
    return current >= start && current < end;
  }
  // Overnight range: e.g., 22:00 → 07:00
  return current >= start || current < end;
}

/** Small delay helper for rate-limited bulk sends */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// PUSH NOTIFICATION SERVICE
// ============================================================================

export class PushNotificationService {
  private vapidPublicKey: string;
  private vapidPrivateKey: string;
  private vapidSubject: string;
  private configured: boolean;

  constructor() {
    this.vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? '';
    this.vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? '';
    this.vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@goldledger.com.au';
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
        console.warn('[PushNotification] Failed to set VAPID details:', err);
        this.configured = false;
      }
    } else {
      console.warn(
        '[PushNotification] VAPID keys not configured. Push notifications disabled. ' +
          'Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT env vars.',
      );
    }
  }

  // --------------------------------------------------------------------------
  // VAPID CONFIGURATION
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // SUBSCRIPTION MANAGEMENT
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // SENDING NOTIFICATIONS
  // --------------------------------------------------------------------------

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

    if (!this.configured) {
      result.skipped = 1;
      return result;
    }

    // Check category preference
    if (category) {
      const enabled = await this.isNotificationEnabled(userId, tenantId, category);
      if (!enabled) {
        result.skipped = 1;
        return result;
      }
    }

    // Check quiet hours
    const inQuietHours = await this.checkQuietHours(userId, tenantId);
    if (inQuietHours) {
      result.skipped = 1;
      return result;
    }

    // Get all active subscriptions for the user
    const subscriptions = await this.getSubscriptions(userId, tenantId);
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

    if (!this.configured) {
      aggregate.skipped = 1;
      return aggregate;
    }

    // Get tenant members (optionally filtered by role)
    let membersQuery = db.select().from(tenantMembers).where(eq(tenantMembers.tenantId, tenantId));

    const members = await membersQuery.all();

    for (const member of members as any[]) {
      const memberRole = (member.role ?? member.role) as TenantRole;
      const memberUserId = member.userId ?? member.user_id;

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

  // --------------------------------------------------------------------------
  // DELIVERY
  // --------------------------------------------------------------------------

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
    if (!this.configured) return false;

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
    } catch (err: any) {
      const statusCode = err?.statusCode ?? 0;

      // 410 Gone or 404 = subscription no longer valid → deactivate immediately
      if (statusCode === 410 || statusCode === 404) {
        await this.deactivateSubscription(endpoint);
        return false;
      }

      // Other errors → increment error_count
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
        const errorCount = Number((sub as any).errorCount ?? (sub as any).error_count ?? 0);
        if (errorCount >= MAX_ERROR_COUNT) {
          await this.deactivateSubscription(endpoint);
        }
      }

      console.warn(
        `[PushNotification] Delivery failed for ${endpoint}: ${err?.message ?? 'Unknown error'}`,
      );
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // PREFERENCE CHECKS
  // --------------------------------------------------------------------------

  /**
   * Returns true if the user is currently in quiet hours.
   * If no preferences exist, returns false (no quiet hours).
   */
  async checkQuietHours(userId: string, tenantId: string): Promise<boolean> {
    const prefs = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.tenantId, tenantId),
        ),
      )
      .get();

    if (!prefs) return false;

    const row = prefs as any;
    const start = row.quietHoursStart ?? row.quiet_hours_start;
    const end = row.quietHoursEnd ?? row.quiet_hours_end;
    const timezone = row.timezone ?? 'Australia/Sydney';

    if (!start || !end) return false;

    const currentTime = getCurrentTimeInTimezone(timezone);
    return isTimeInRange(currentTime, start, end);
  }

  /**
   * Check if a notification category is enabled for a user.
   * Returns true if enabled (or if no preferences exist — defaults to on).
   * Also checks the master push_enabled toggle.
   */
  async isNotificationEnabled(
    userId: string,
    tenantId: string,
    category: NotificationCategory,
  ): Promise<boolean> {
    const prefs = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.tenantId, tenantId),
        ),
      )
      .get();

    // No preferences row = all defaults = enabled
    if (!prefs) return true;

    const row = prefs as any;

    // Check master push toggle
    const pushEnabled = row.pushEnabled ?? row.push_enabled;
    if (pushEnabled === false || pushEnabled === 0) return false;

    // Check category-specific toggle
    const columnName = CATEGORY_TO_COLUMN[category];
    // Try camelCase first (Drizzle mapping), then snake_case (raw PG)
    const snakeColumn = category; // e.g., 'transaction_alerts'
    const value = row[columnName] ?? row[snakeColumn];

    // Default to true if column not found
    if (value === undefined || value === null) return true;
    return Boolean(value);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const pushNotificationService = new PushNotificationService();
