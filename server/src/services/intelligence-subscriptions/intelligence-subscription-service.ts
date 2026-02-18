/**
 * Intelligence Subscription Service
 *
 * Manages subscriptions to cross-module intelligence insights.
 * Users can subscribe to specific insight types, modules, entities, or
 * severity thresholds, and receive notifications via in-app, SSE, email,
 * or webhook channels when matching insights are generated.
 */

import { randomUUID } from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db, intelligenceSubscriptions } from '../../schema.js';
import type {
  SubscriptionInput,
  IntelligenceSubscription,
  CrossModuleInsight,
  TriggeredNotification,
  NotificationResult,
  SubscriptionFilters,
  NotificationHistoryEntry,
  SubscriptionStats,
} from './types.js';
import { dispatchNotification } from './notification-dispatch.js';
import { matchesFilter, checkCooldown, mapDbRow } from './helpers.js';
import { computeSubscriptionStats } from './stats.js';

const MAX_HISTORY = 500;

export class IntelligenceSubscriptionService {
  private notificationHistory: NotificationHistoryEntry[] = [];

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  async subscribe(userId: string, input: SubscriptionInput): Promise<IntelligenceSubscription> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const record = {
      id,
      userId,
      name: input.name,
      subscriptionType: input.subscriptionType,
      filterCriteria: JSON.stringify(input.filterCriteria),
      notificationChannel: input.notificationChannel,
      notificationConfig: input.notificationConfig
        ? JSON.stringify(input.notificationConfig)
        : null,
      isActive: true,
      triggerCount: 0,
      lastTriggeredAt: null,
      cooldownMinutes: input.cooldownMinutes ?? 60,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(intelligenceSubscriptions).values(record).run();

    return mapDbRow(record);
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    await db
      .update(intelligenceSubscriptions)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(intelligenceSubscriptions.id, subscriptionId))
      .run();
  }

  async reactivate(subscriptionId: string): Promise<void> {
    await db
      .update(intelligenceSubscriptions)
      .set({ isActive: true, updatedAt: new Date().toISOString() })
      .where(eq(intelligenceSubscriptions.id, subscriptionId))
      .run();
  }

  async deleteSubscription(subscriptionId: string): Promise<void> {
    await db
      .delete(intelligenceSubscriptions)
      .where(eq(intelligenceSubscriptions.id, subscriptionId))
      .run();
  }

  async getSubscription(subscriptionId: string): Promise<IntelligenceSubscription | null> {
    const row = await db
      .select()
      .from(intelligenceSubscriptions)
      .where(eq(intelligenceSubscriptions.id, subscriptionId))
      .get();

    return row ? mapDbRow(row) : null;
  }

  async listSubscriptions(
    userId: string,
    filters?: SubscriptionFilters,
  ): Promise<IntelligenceSubscription[]> {
    const conditions: SQL[] = [eq(intelligenceSubscriptions.userId, userId)];

    if (filters?.subscriptionType) {
      conditions.push(eq(intelligenceSubscriptions.subscriptionType, filters.subscriptionType));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(intelligenceSubscriptions.isActive, filters.isActive));
    }
    if (filters?.notificationChannel) {
      conditions.push(
        eq(intelligenceSubscriptions.notificationChannel, filters.notificationChannel),
      );
    }

    const rows = await db
      .select()
      .from(intelligenceSubscriptions)
      .where(and(...conditions))
      .orderBy(desc(intelligenceSubscriptions.createdAt))
      .all();

    return (rows as Record<string, unknown>[]).map((r) => mapDbRow(r));
  }

  async updateSubscription(
    subscriptionId: string,
    updates: Partial<SubscriptionInput>,
  ): Promise<IntelligenceSubscription | null> {
    const setFields: Record<string, any> = { updatedAt: new Date().toISOString() };

    if (updates.name !== undefined) setFields.name = updates.name;
    if (updates.subscriptionType !== undefined)
      setFields.subscriptionType = updates.subscriptionType;
    if (updates.filterCriteria !== undefined)
      setFields.filterCriteria = JSON.stringify(updates.filterCriteria);
    if (updates.notificationChannel !== undefined)
      setFields.notificationChannel = updates.notificationChannel;
    if (updates.notificationConfig !== undefined)
      setFields.notificationConfig = JSON.stringify(updates.notificationConfig);
    if (updates.cooldownMinutes !== undefined) setFields.cooldownMinutes = updates.cooldownMinutes;

    await db
      .update(intelligenceSubscriptions)
      .set(setFields)
      .where(eq(intelligenceSubscriptions.id, subscriptionId))
      .run();

    return this.getSubscription(subscriptionId);
  }

  // --------------------------------------------------------------------------
  // Trigger evaluation
  // --------------------------------------------------------------------------

  async checkTriggers(
    userId: string,
    newInsights: CrossModuleInsight[],
  ): Promise<TriggeredNotification[]> {
    const subs = await this.listSubscriptions(userId, { isActive: true });
    const triggered: TriggeredNotification[] = [];

    for (const insight of newInsights) {
      for (const sub of subs) {
        if (!matchesFilter(insight, sub.filterCriteria)) continue;
        if (!checkCooldown(sub)) continue;

        triggered.push({
          subscriptionId: sub.id,
          subscriptionName: sub.name,
          insight,
          channel: sub.notificationChannel,
          config: sub.notificationConfig ?? {},
        });
      }
    }

    return triggered;
  }

  // --------------------------------------------------------------------------
  // Notification dispatch
  // --------------------------------------------------------------------------

  async notifySubscribers(notifications: TriggeredNotification[]): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const notif of notifications) {
      const { success, error } = await dispatchNotification(notif);
      const now = new Date().toISOString();

      // Update trigger stats in DB
      const sub = await this.getSubscription(notif.subscriptionId);
      if (sub) {
        await db
          .update(intelligenceSubscriptions)
          .set({
            triggerCount: sub.triggerCount + 1,
            lastTriggeredAt: now,
            updatedAt: now,
          })
          .where(eq(intelligenceSubscriptions.id, notif.subscriptionId))
          .run();
      }

      // Record in history
      this._recordHistory({
        subscriptionId: notif.subscriptionId,
        subscriptionName: notif.subscriptionName,
        insightId: notif.insight.id,
        insightTitle: notif.insight.title,
        channel: notif.channel,
        success,
        deliveredAt: now,
      });

      results.push({
        subscriptionId: notif.subscriptionId,
        channel: notif.channel,
        success,
        error,
        deliveredAt: success ? now : undefined,
      });
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Test & history
  // --------------------------------------------------------------------------

  async testSubscription(subscriptionId: string): Promise<NotificationResult> {
    const sub = await this.getSubscription(subscriptionId);
    if (!sub) {
      return {
        subscriptionId,
        channel: 'unknown',
        success: false,
        error: 'Subscription not found',
      };
    }

    const testInsight: CrossModuleInsight = {
      id: `test-${randomUUID()}`,
      userId: sub.userId,
      insightType: 'test',
      title: 'Test Notification',
      description:
        'This is a test notification to verify your subscription is configured correctly.',
      severity: 'info',
      sourceModules: ['test'],
      confidence: 1.0,
      evidence: { test: true },
      recommendedAction: 'No action needed -- this is a test.',
      status: 'test',
      createdAt: new Date().toISOString(),
    };

    const results = await this.notifySubscribers([
      {
        subscriptionId: sub.id,
        subscriptionName: sub.name,
        insight: testInsight,
        channel: sub.notificationChannel,
        config: sub.notificationConfig ?? {},
      },
    ]);

    return results[0];
  }

  async getNotificationHistory(
    _userId: string,
    limit: number = 50,
  ): Promise<NotificationHistoryEntry[]> {
    return this.notificationHistory.slice(-limit);
  }

  // --------------------------------------------------------------------------
  // Stats
  // --------------------------------------------------------------------------

  async getSubscriptionStats(userId: string): Promise<SubscriptionStats> {
    const subs = await this.listSubscriptions(userId);
    return computeSubscriptionStats(subs);
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private _recordHistory(entry: NotificationHistoryEntry): void {
    this.notificationHistory.push(entry);
    if (this.notificationHistory.length > MAX_HISTORY) {
      this.notificationHistory = this.notificationHistory.slice(-MAX_HISTORY);
    }
  }
}

// Singleton export
export const intelligenceSubscriptionService = new IntelligenceSubscriptionService();
