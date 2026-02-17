export {
  IntelligenceSubscriptionService,
  intelligenceSubscriptionService,
} from './intelligence-subscription-service.js';
export { dispatchNotification, sendSSE, sendWebhook, sendEmail } from './notification-dispatch.js';
export { matchesFilter, checkCooldown, severityToNumber, mapDbRow } from './helpers.js';
export { computeSubscriptionStats } from './stats.js';
export type {
  FilterCriteria,
  SubscriptionInput,
  IntelligenceSubscription,
  CrossModuleInsight,
  TriggeredNotification,
  NotificationResult,
  SubscriptionFilters,
  NotificationHistoryEntry,
  SubscriptionStats,
} from './types.js';
