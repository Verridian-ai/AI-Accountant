/**
 * Data Refresh Scheduler — Schedule Manager
 *
 * AEST time helpers and schedule calculation utilities used by the scheduler.
 */

import { ONE_MINUTE, ONE_HOUR, TWENTY_FOUR_HOURS } from './types.js';

// ============================================================================
// AEST TIME HELPERS
// ============================================================================

/**
 * Get the current hour in Australia/Sydney timezone.
 */
export function getAestHour(): number {
  const now = new Date();
  // Get AEST offset: +10 or +11 (daylight saving)
  const utcHour = now.getUTCHours();
  const utcMonth = now.getUTCMonth(); // 0-indexed
  // AEST = UTC+10, AEDT = UTC+11 (Oct first Sunday to Apr first Sunday)
  // Simplified: Oct-Mar = AEDT (+11), Apr-Sep = AEST (+10)
  const isDST = utcMonth >= 9 || utcMonth <= 2; // Oct(9) through Mar(2)
  const offset = isDST ? 11 : 10;
  return (utcHour + offset) % 24;
}

/**
 * Get the current day-of-week in AEST (0 = Sunday, 6 = Saturday).
 */
export function getAestDayOfWeek(): number {
  const now = new Date();
  const utcMonth = now.getUTCMonth();
  const isDST = utcMonth >= 9 || utcMonth <= 2;
  const offset = isDST ? 11 : 10;
  const aestTime = new Date(now.getTime() + offset * ONE_HOUR);
  return aestTime.getUTCDay();
}

/**
 * Check if we're within ASX trading hours: Mon-Fri, 10am-4pm AEST.
 */
export function isAsxTradingHours(): boolean {
  const day = getAestDayOfWeek();
  const hour = getAestHour();
  const isWeekday = day >= 1 && day <= 5;
  const isInHours = hour >= 10 && hour < 16;
  return isWeekday && isInHours;
}

/**
 * Calculate milliseconds until a target AEST hour on the next occurrence.
 * Used for scheduling daily jobs to start at the right time.
 */
export function msUntilAestHour(targetHour: number): number {
  const now = new Date();
  const utcMonth = now.getUTCMonth();
  const isDST = utcMonth >= 9 || utcMonth <= 2;
  const offset = isDST ? 11 : 10;

  // Current AEST time
  const aestMs = now.getTime() + offset * ONE_HOUR;
  const aestDate = new Date(aestMs);
  const currentHour = aestDate.getUTCHours();
  const currentMin = aestDate.getUTCMinutes();
  const currentSec = aestDate.getUTCSeconds();

  // Hours until target
  let hoursUntil = targetHour - currentHour;
  if (hoursUntil < 0 || (hoursUntil === 0 && (currentMin > 0 || currentSec > 0))) {
    hoursUntil += 24;
  }

  const msUntil = hoursUntil * ONE_HOUR - currentMin * ONE_MINUTE - currentSec * 1000;

  return Math.max(msUntil, 1000); // At least 1 second
}

/**
 * Calculate ms until next Sunday midnight AEST.
 */
export function msUntilSundayMidnightAest(): number {
  const day = getAestDayOfWeek();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  return (
    daysUntilSunday * TWENTY_FOUR_HOURS +
    msUntilAestHour(0) -
    TWENTY_FOUR_HOURS * (day === 0 ? 0 : 0)
  );
}
