/**
 * Intelligence Subscription Types
 */

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
