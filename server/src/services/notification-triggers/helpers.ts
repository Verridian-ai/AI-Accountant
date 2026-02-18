/**
 * Notification Trigger Helpers
 * Formatting utilities and threshold lookups for notification triggers.
 */

import { db, notificationPreferences } from '../../schema.js';
import { eq, and } from 'drizzle-orm';

/** Format cents to AUD string (e.g., 150000 → "$1,500.00") */
export function formatCents(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${dollars.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format a date string for display */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Get the large_transaction_threshold_cents from user preferences (default 100000 = $1000) */
export async function getLargeTransactionThreshold(
  userId: string,
  tenantId: string,
): Promise<number> {
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

  if (!prefs) return 100_000; // Default $1,000

  const row = prefs as Record<string, unknown>;
  return Number(
    row.largeTransactionThresholdCents ?? row.large_transaction_threshold_cents ?? 100_000,
  );
}

/** Get the budget_alert_threshold_percent from user preferences (default 80%) */
export async function getBudgetAlertThreshold(userId: string, tenantId: string): Promise<number> {
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

  if (!prefs) return 80; // Default 80%

  const row = prefs as Record<string, unknown>;
  return Number(row.budgetAlertThresholdPercent ?? row.budget_alert_threshold_percent ?? 80);
}
