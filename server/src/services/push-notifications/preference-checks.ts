/**
 * Push Notification Preference Checks
 *
 * Quiet hours and category toggle checks.
 */

import { db, notificationPreferences } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import type { NotificationCategory } from './types.js';
import { CATEGORY_TO_COLUMN } from './types.js';
import { getCurrentTimeInTimezone, isTimeInRange } from './helpers.js';

/**
 * Returns true if the user is currently in quiet hours.
 * If no preferences exist, returns false (no quiet hours).
 */
export async function checkQuietHours(userId: string, tenantId: string): Promise<boolean> {
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

  const row = prefs as Record<string, unknown>;
  const start = (row.quietHoursStart ?? row.quiet_hours_start) as string | null;
  const end = (row.quietHoursEnd ?? row.quiet_hours_end) as string | null;
  const timezone = (row.timezone as string) ?? 'Australia/Sydney';

  if (!start || !end) return false;

  const currentTime = getCurrentTimeInTimezone(timezone);
  return isTimeInRange(currentTime, start, end);
}

/**
 * Check if a notification category is enabled for a user.
 * Returns true if enabled (or if no preferences exist -- defaults to on).
 * Also checks the master push_enabled toggle.
 */
export async function isNotificationEnabled(
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

  const row = prefs as Record<string, unknown>;

  // Check master push toggle
  const pushEnabled = (row.pushEnabled ?? row.push_enabled) as boolean | number | null;
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
