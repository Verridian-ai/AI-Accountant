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

import type { TenantRole } from '../tenant-types.js';
import type {
  NotificationPayload,
  NotificationCategory,
  SendResult,
  BulkSendResult,
  PushSubscriptionRecord,
  ClientPushSubscription,
} from './types.js';
import { SubscriptionManager } from './subscription-manager.js';
import { NotificationSender } from './notification-sender.js';
import {
  checkQuietHours as _checkQuietHours,
  isNotificationEnabled as _isNotificationEnabled,
} from './preference-checks.js';

export class PushNotificationService {
  private subscriptionManager: SubscriptionManager;
  private sender: NotificationSender;

  constructor() {
    this.subscriptionManager = new SubscriptionManager();
    this.sender = new NotificationSender(this.subscriptionManager);
  }

  // -- VAPID CONFIGURATION --
  getVapidPublicKey(): string {
    return this.subscriptionManager.getVapidPublicKey();
  }

  isConfigured(): boolean {
    return this.subscriptionManager.isConfigured();
  }

  static generateVapidKeys(): { publicKey: string; privateKey: string } {
    return SubscriptionManager.generateVapidKeys();
  }

  // -- SUBSCRIPTION MANAGEMENT --
  async subscribe(
    userId: string,
    tenantId: string,
    subscription: ClientPushSubscription,
    deviceName?: string,
  ): Promise<void> {
    return this.subscriptionManager.subscribe(userId, tenantId, subscription, deviceName);
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    return this.subscriptionManager.unsubscribe(userId, endpoint);
  }

  async getSubscriptions(userId: string, tenantId: string): Promise<PushSubscriptionRecord[]> {
    return this.subscriptionManager.getSubscriptions(userId, tenantId);
  }

  async deactivateSubscription(endpoint: string): Promise<void> {
    return this.subscriptionManager.deactivateSubscription(endpoint);
  }

  async cleanupInactive(): Promise<number> {
    return this.subscriptionManager.cleanupInactive();
  }

  // -- SENDING NOTIFICATIONS --
  async sendNotification(
    userId: string,
    tenantId: string,
    payload: NotificationPayload,
    category?: NotificationCategory,
  ): Promise<SendResult> {
    return this.sender.sendNotification(userId, tenantId, payload, category);
  }

  async sendToTenant(
    tenantId: string,
    payload: NotificationPayload,
    category?: NotificationCategory,
    roles?: TenantRole[],
  ): Promise<SendResult> {
    return this.sender.sendToTenant(tenantId, payload, category, roles);
  }

  async sendBulk(
    notifications: Array<{
      userId: string;
      tenantId: string;
      payload: NotificationPayload;
      category?: NotificationCategory;
    }>,
  ): Promise<BulkSendResult> {
    return this.sender.sendBulk(notifications);
  }

  // -- DELIVERY --
  async deliverToEndpoint(
    endpoint: string,
    keys: { p256dh: string; auth: string },
    payload: NotificationPayload,
  ): Promise<boolean> {
    return this.sender.deliverToEndpoint(endpoint, keys, payload);
  }

  // -- PREFERENCE CHECKS --
  async checkQuietHours(userId: string, tenantId: string): Promise<boolean> {
    return _checkQuietHours(userId, tenantId);
  }

  async isNotificationEnabled(
    userId: string,
    tenantId: string,
    category: NotificationCategory,
  ): Promise<boolean> {
    return _isNotificationEnabled(userId, tenantId, category);
  }
}

// Singleton export
export const pushNotificationService = new PushNotificationService();
