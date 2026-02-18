/**
 * Intelligence Subscription Helpers
 *
 * Filter matching, cooldown checking, severity mapping, and DB row mapping.
 */

import type { FilterCriteria, IntelligenceSubscription, CrossModuleInsight } from './types.js';

/**
 * Convert severity string to numeric level for comparison.
 */
export function severityToNumber(severity: string): number {
  const map: Record<string, number> = { info: 0, suggestion: 1, warning: 2, critical: 3 };
  return map[severity] ?? 0;
}

/**
 * Check if an insight matches a subscription's filter criteria.
 */
export function matchesFilter(insight: CrossModuleInsight, criteria: FilterCriteria): boolean {
  if (criteria.insightTypes?.length && !criteria.insightTypes.includes(insight.insightType)) {
    return false;
  }

  if (criteria.modules?.length) {
    const hasOverlap = criteria.modules.some((m) => insight.sourceModules.includes(m));
    if (!hasOverlap) return false;
  }

  if (criteria.severityMin) {
    if (severityToNumber(insight.severity) < severityToNumber(criteria.severityMin)) {
      return false;
    }
  }

  if (criteria.confidenceMin !== undefined && insight.confidence < criteria.confidenceMin) {
    return false;
  }

  if (criteria.entityIds?.length) {
    const evidenceStr = JSON.stringify(insight.evidence);
    const hasEntity = criteria.entityIds.some((eid) => evidenceStr.includes(eid));
    if (!hasEntity) return false;
  }

  return true;
}

/**
 * Check if a subscription's cooldown period has elapsed.
 */
export function checkCooldown(subscription: IntelligenceSubscription): boolean {
  if (!subscription.lastTriggeredAt) return true;

  const lastTriggered = new Date(subscription.lastTriggeredAt).getTime();
  const cooldownMs = subscription.cooldownMinutes * 60 * 1000;
  return Date.now() - lastTriggered >= cooldownMs;
}

/**
 * Map a raw DB row to an IntelligenceSubscription object.
 */
export function mapDbRow(row: Record<string, unknown>): IntelligenceSubscription {
  return {
    id: row.id as string,
    userId: (row.userId ?? row.user_id) as string,
    name: row.name as string,
    subscriptionType: (row.subscriptionType ?? row.subscription_type) as string,
    filterCriteria:
      typeof row.filterCriteria === 'string'
        ? JSON.parse(row.filterCriteria)
        : typeof row.filter_criteria === 'string'
          ? JSON.parse(row.filter_criteria)
          : ((row.filterCriteria ?? {}) as FilterCriteria),
    notificationChannel: (row.notificationChannel ?? row.notification_channel) as string,
    notificationConfig: row.notificationConfig
      ? typeof row.notificationConfig === 'string'
        ? JSON.parse(row.notificationConfig)
        : row.notificationConfig
      : row.notification_config
        ? typeof row.notification_config === 'string'
          ? JSON.parse(row.notification_config)
          : row.notification_config
        : undefined,
    isActive: typeof row.isActive === 'boolean' ? row.isActive : Boolean(row.is_active ?? true),
    triggerCount: Number(row.triggerCount ?? row.trigger_count ?? 0),
    lastTriggeredAt: (row.lastTriggeredAt ?? row.last_triggered_at) as string | undefined,
    cooldownMinutes: Number(row.cooldownMinutes ?? row.cooldown_minutes ?? 60),
    createdAt: (row.createdAt ?? row.created_at) as string,
    updatedAt: (row.updatedAt ?? row.updated_at) as string,
  };
}
