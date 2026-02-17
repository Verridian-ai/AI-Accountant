/**
 * Data Refresh Scheduler — Barrel Export
 *
 * Re-exports all public types, classes, and singleton from sub-modules.
 */

export type { SchedulerConfig, ScheduleEntry, SchedulerStatus, SchedulerDeps } from './types.js';

export {
  DEFAULT_CONFIG,
  ONE_MINUTE,
  ONE_HOUR,
  THIRTY_MINUTES,
  TWENTY_FOUR_HOURS,
  ONE_WEEK,
  DEFAULT_SENTIMENT_TOPICS,
  AU_ECONOMIC_EVENTS,
} from './types.js';

export {
  getAestHour,
  getAestDayOfWeek,
  isAsxTradingHours,
  msUntilAestHour,
  msUntilSundayMidnightAest,
} from './schedule-manager.js';

export {
  refreshRbaData,
  refreshAbsData,
  refreshAsxPrices,
  refreshCryptoPrices,
  refreshSentiment,
  refreshCogneeIndex,
  refreshCalendar,
} from './refresh-jobs.js';

export { DataRefreshScheduler } from './scheduler.js';

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

import { DataRefreshScheduler } from './scheduler.js';

export const dataRefreshScheduler = new DataRefreshScheduler();
