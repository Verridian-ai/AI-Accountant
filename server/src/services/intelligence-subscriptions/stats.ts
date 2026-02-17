/**
 * Intelligence Subscription Statistics
 */

import type { IntelligenceSubscription, SubscriptionStats } from './types.js';

/**
 * Compute aggregate stats from a list of subscriptions.
 */
export function computeSubscriptionStats(subs: IntelligenceSubscription[]): SubscriptionStats {
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
    .filter((s) => s.triggerCount > 0)
    .sort((a, b) => b.triggerCount - a.triggerCount)
    .slice(0, 10)
    .map((s) => ({ name: s.name, triggerCount: s.triggerCount }));

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
