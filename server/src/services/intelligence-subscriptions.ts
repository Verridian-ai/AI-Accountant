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
import { db, intelligenceSubscriptions } from '../schema.js';

// ============================================================================
// Types
// ============================================================================

export interface FilterCriteria {
  insightTypes?: string[];
  modules?: string[];
  entityIds?: string[];
  severityMin?: 'info' | 'suggestion' | 'warning' | 'critical';
  confidenceMin?: number;
}

export interface SubscriptionInput {
  name: string;
  subscriptionType: 'insight_type' | 'module' | 'entity' | 'threshold' | 'schedule';
  filterCriteria: FilterCriteria;
  notificationChannel: 'in_app' | 'email' | 'sse' | 'webhook';
  notificationConfig?: { webhookUrl?: string; emailAddress?: string; sseChannel?: string };
  cooldownMinutes?: number;
}

export interface IntelligenceSubscription {
  id: string;
  userId: string;
  name: string;
  subscriptionType: string;
  filterCriteria: FilterCriteria;
  notificationChannel: string;
  notificationConfig?: Record<string, unknown>;
  isActive: boolean;
  triggerCount: number;
  lastTriggeredAt?: string;
  cooldownMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrossModuleInsight {
  id: string;
  userId: string;
  insightType: string;
  title: string;
  description: string;
  severity: 'info' | 'suggestion' | 'warning' | 'critical';
  sourceModules: string[];
  confidence: number;
  evidence: Record<string, unknown>;
  recommendedAction?: string;
  status: string;
  createdAt: string;
}

export interface TriggeredNotification {
  subscriptionId: string;
  subscriptionName: string;
  insight: CrossModuleInsight;
  channel: string;
  config: Record<string, unknown>;
}

export interface NotificationResult {
  subscriptionId: string;
  channel: string;
  success: boolean;
  error?: string;
  deliveredAt?: string;
}

export interface SubscriptionFilters {
  subscriptionType?: string;
  isActive?: boolean;
  notificationChannel?: string;
}

export interface NotificationHistoryEntry {
  subscriptionId: string;
  subscriptionName: string;
  insightId: string;
  insightTitle: string;
  channel: string;
  success: boolean;
  deliveredAt: string;
}

export interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalTriggers: number;
  byChannel: Record<string, number>;
  byType: Record<string, number>;
  topTriggered: Array<{ name: string; triggerCount: number }>;
  averageCooldown: number;
}

// ============================================================================
// Service
// ============================================================================

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
      notificationConfig: input.notificationConfig ? JSON.stringify(input.notificationConfig) : null,
      isActive: true,
      triggerCount: 0,
      lastTriggeredAt: null,
      cooldownMinutes: input.cooldownMinutes ?? 60,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(intelligenceSubscriptions).values(record).run();

    return this._mapDbRow(record);
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

    return row ? this._mapDbRow(row) : null;
  }

  async listSubscriptions(userId: string, filters?: SubscriptionFilters): Promise<IntelligenceSubscription[]> {
    const conditions: any[] = [eq(intelligenceSubscriptions.userId, userId)];

    if (filters?.subscriptionType) {
      conditions.push(eq(intelligenceSubscriptions.subscriptionType, filters.subscriptionType));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(intelligenceSubscriptions.isActive, filters.isActive));
    }
    if (filters?.notificationChannel) {
      conditions.push(eq(intelligenceSubscriptions.notificationChannel, filters.notificationChannel));
    }

    const rows = await db
      .select()
      .from(intelligenceSubscriptions)
      .where(and(...conditions))
      .orderBy(desc(intelligenceSubscriptions.createdAt))
      .all();

    return rows.map((r: any) => this._mapDbRow(r));
  }

  async updateSubscription(
    subscriptionId: string,
    updates: Partial<SubscriptionInput>
  ): Promise<IntelligenceSubscription | null> {
    const setFields: Record<string, any> = { updatedAt: new Date().toISOString() };

    if (updates.name !== undefined) setFields.name = updates.name;
    if (updates.subscriptionType !== undefined) setFields.subscriptionType = updates.subscriptionType;
    if (updates.filterCriteria !== undefined) setFields.filterCriteria = JSON.stringify(updates.filterCriteria);
    if (updates.notificationChannel !== undefined) setFields.notificationChannel = updates.notificationChannel;
    if (updates.notificationConfig !== undefined) setFields.notificationConfig = JSON.stringify(updates.notificationConfig);
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

  async checkTriggers(userId: string, newInsights: CrossModuleInsight[]): Promise<TriggeredNotification[]> {
    const subs = await this.listSubscriptions(userId, { isActive: true });
    const triggered: TriggeredNotification[] = [];

    for (const insight of newInsights) {
      for (const sub of subs) {
        if (!this._matchesFilter(insight, sub.filterCriteria)) continue;
        if (!this._checkCooldown(sub)) continue;

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
      let success = false;
      let error: string | undefined;

      try {
        switch (notif.channel) {
          case 'in_app':
            console.log(`[IntelSub] In-app notification for subscription ${notif.subscriptionId}: "${notif.insight.title}"`);
            success = true;
            break;

          case 'sse':
            await this._sendSSE(
              (notif.config as any)?.sseChannel ?? 'intelligence',
              { type: 'intelligence_insight', insight: notif.insight, subscriptionId: notif.subscriptionId }
            );
            success = true;
            break;

          case 'email':
            await this._sendEmail(
              (notif.config as any)?.emailAddress ?? '',
              `Intelligence Alert: ${notif.insight.title}`,
              `${notif.insight.description}\n\nSeverity: ${notif.insight.severity}\nConfidence: ${(notif.insight.confidence * 100).toFixed(0)}%${notif.insight.recommendedAction ? `\nRecommended action: ${notif.insight.recommendedAction}` : ''}`
            );
            success = true;
            break;

          case 'webhook':
            success = await this._sendWebhook(
              (notif.config as any)?.webhookUrl ?? '',
              {
                event: 'intelligence_insight',
                subscriptionId: notif.subscriptionId,
                subscriptionName: notif.subscriptionName,
                insight: notif.insight,
                timestamp: new Date().toISOString(),
              }
            );
            break;

          default:
            error = `Unknown channel: ${notif.channel}`;
        }
      } catch (err: any) {
        error = err.message ?? String(err);
      }

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
      return { subscriptionId, channel: 'unknown', success: false, error: 'Subscription not found' };
    }

    const testInsight: CrossModuleInsight = {
      id: `test-${randomUUID()}`,
      userId: sub.userId,
      insightType: 'test',
      title: 'Test Notification',
      description: 'This is a test notification to verify your subscription is configured correctly.',
      severity: 'info',
      sourceModules: ['test'],
      confidence: 1.0,
      evidence: { test: true },
      recommendedAction: 'No action needed — this is a test.',
      status: 'test',
      createdAt: new Date().toISOString(),
    };

    const results = await this.notifySubscribers([{
      subscriptionId: sub.id,
      subscriptionName: sub.name,
      insight: testInsight,
      channel: sub.notificationChannel,
      config: sub.notificationConfig ?? {},
    }]);

    return results[0];
  }

  async getNotificationHistory(_userId: string, limit: number = 50): Promise<NotificationHistoryEntry[]> {
    return this.notificationHistory.slice(-limit);
  }

  // --------------------------------------------------------------------------
  // Stats
  // --------------------------------------------------------------------------

  async getSubscriptionStats(userId: string): Promise<SubscriptionStats> {
    const subs = await this.listSubscriptions(userId);

    const byChannel: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalTriggers = 0;
    let totalCooldown = 0;
    let activeCount = 0;

    for (const sub of subs) {
      byChannel[sub.notificationChannel] = (byChannel[sub.notificationChannel] ?? 0) + 1;
      byType[sub.subscriptionType] = (byType[sub.subscriptionType] ?? 0) + 1;
      totalTriggers += sub.triggerCount;
      totalCooldown += sub.cooldownMinutes;
      if (sub.isActive) activeCount++;
    }

    const topTriggered = subs
      .filter(s => s.triggerCount > 0)
      .sort((a, b) => b.triggerCount - a.triggerCount)
      .slice(0, 10)
      .map(s => ({ name: s.name, triggerCount: s.triggerCount }));

    return {
      totalSubscriptions: subs.length,
      activeSubscriptions: activeCount,
      totalTriggers,
      byChannel,
      byType,
      topTriggered,
      averageCooldown: subs.length > 0 ? totalCooldown / subs.length : 60,
    };
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private _matchesFilter(insight: CrossModuleInsight, criteria: FilterCriteria): boolean {
    if (criteria.insightTypes?.length && !criteria.insightTypes.includes(insight.insightType)) {
      return false;
    }

    if (criteria.modules?.length) {
      const hasOverlap = criteria.modules.some(m => insight.sourceModules.includes(m));
      if (!hasOverlap) return false;
    }

    if (criteria.severityMin) {
      if (this._severityToNumber(insight.severity) < this._severityToNumber(criteria.severityMin)) {
        return false;
      }
    }

    if (criteria.confidenceMin !== undefined && insight.confidence < criteria.confidenceMin) {
      return false;
    }

    if (criteria.entityIds?.length) {
      const evidenceStr = JSON.stringify(insight.evidence);
      const hasEntity = criteria.entityIds.some(eid => evidenceStr.includes(eid));
      if (!hasEntity) return false;
    }

    return true;
  }

  private _checkCooldown(subscription: IntelligenceSubscription): boolean {
    if (!subscription.lastTriggeredAt) return true;

    const lastTriggered = new Date(subscription.lastTriggeredAt).getTime();
    const cooldownMs = subscription.cooldownMinutes * 60 * 1000;
    return Date.now() - lastTriggered >= cooldownMs;
  }

  private async _sendSSE(channel: string, data: unknown): Promise<void> {
    console.log(`[IntelSub] SSE event on channel "${channel}":`, JSON.stringify(data).slice(0, 200));
  }

  private async _sendWebhook(url: string, payload: unknown): Promise<boolean> {
    if (!url) {
      console.warn('[IntelSub] Webhook URL is empty, skipping');
      return false;
    }

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });

        if (res.ok) return true;

        console.warn(`[IntelSub] Webhook attempt ${attempt}/${maxRetries} failed: HTTP ${res.status}`);
      } catch (err: any) {
        console.warn(`[IntelSub] Webhook attempt ${attempt}/${maxRetries} error:`, err.message);
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    return false;
  }

  private async _sendEmail(address: string, subject: string, body: string): Promise<void> {
    console.log(`[IntelSub] Email to "${address}" — Subject: "${subject}"\n${body.slice(0, 300)}`);
  }

  private _severityToNumber(severity: string): number {
    const map: Record<string, number> = { info: 0, suggestion: 1, warning: 2, critical: 3 };
    return map[severity] ?? 0;
  }

  private _mapDbRow(row: any): IntelligenceSubscription {
    return {
      id: row.id,
      userId: row.userId ?? row.user_id,
      name: row.name,
      subscriptionType: row.subscriptionType ?? row.subscription_type,
      filterCriteria: typeof row.filterCriteria === 'string'
        ? JSON.parse(row.filterCriteria)
        : (typeof row.filter_criteria === 'string' ? JSON.parse(row.filter_criteria) : row.filterCriteria ?? {}),
      notificationChannel: row.notificationChannel ?? row.notification_channel,
      notificationConfig: row.notificationConfig
        ? (typeof row.notificationConfig === 'string' ? JSON.parse(row.notificationConfig) : row.notificationConfig)
        : (row.notification_config
          ? (typeof row.notification_config === 'string' ? JSON.parse(row.notification_config) : row.notification_config)
          : undefined),
      isActive: typeof row.isActive === 'boolean' ? row.isActive : (row.is_active ?? true),
      triggerCount: row.triggerCount ?? row.trigger_count ?? 0,
      lastTriggeredAt: row.lastTriggeredAt ?? row.last_triggered_at ?? undefined,
      cooldownMinutes: row.cooldownMinutes ?? row.cooldown_minutes ?? 60,
      createdAt: row.createdAt ?? row.created_at,
      updatedAt: row.updatedAt ?? row.updated_at,
    };
  }

  private _recordHistory(entry: NotificationHistoryEntry): void {
    this.notificationHistory.push(entry);
    if (this.notificationHistory.length > MAX_HISTORY) {
      this.notificationHistory = this.notificationHistory.slice(-MAX_HISTORY);
    }
  }
}

// Singleton export
export const intelligenceSubscriptionService = new IntelligenceSubscriptionService();
