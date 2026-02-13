/**
 * Notification Triggers (Wave 24)
 *
 * Business logic triggers that fire push notifications for key application events.
 * Each trigger checks user preferences (thresholds, category toggles) before sending.
 *
 * Triggers:
 * - Large transaction alerts (checks amount threshold)
 * - BAS reminders (sends to members with bas.read permission)
 * - Budget alerts (checks percentage threshold)
 * - Bill reminders
 * - Team notifications (sends to admins/owners)
 */

import { pushNotificationService } from './push-notifications.js';
import {
  db,
  notificationPreferences,
  tenantMembers,
} from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { rbacService } from './rbac.js';
import type { NotificationPayload } from './push-notification-types.js';

// ============================================================================
// HELPERS
// ============================================================================

/** Format cents to AUD string (e.g., 150000 → "$1,500.00") */
function formatCents(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${dollars.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format a date string for display */
function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Get the large_transaction_threshold_cents from user preferences (default 100000 = $1000) */
async function getLargeTransactionThreshold(userId: string, tenantId: string): Promise<number> {
  const prefs = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.tenantId, tenantId)
      )
    )
    .get();

  if (!prefs) return 100_000; // Default $1,000

  const row = prefs as any;
  return Number(
    row.largeTransactionThresholdCents ??
    row.large_transaction_threshold_cents ??
    100_000
  );
}

/** Get the budget_alert_threshold_percent from user preferences (default 80%) */
async function getBudgetAlertThreshold(userId: string, tenantId: string): Promise<number> {
  const prefs = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.tenantId, tenantId)
      )
    )
    .get();

  if (!prefs) return 80; // Default 80%

  const row = prefs as any;
  return Number(
    row.budgetAlertThresholdPercent ??
    row.budget_alert_threshold_percent ??
    80
  );
}

// ============================================================================
// TRIGGERS
// ============================================================================

/**
 * Trigger a large transaction alert if the amount exceeds the user's threshold.
 *
 * @param transaction - Transaction object with at least: amount (cents), description/merchant
 * @param userId - User to notify
 * @param tenantId - Tenant context
 */
export async function triggerLargeTransactionAlert(
  transaction: { amount: number; description?: string; merchant?: string },
  userId: string,
  tenantId: string
): Promise<void> {
  const threshold = await getLargeTransactionThreshold(userId, tenantId);
  const absAmount = Math.abs(transaction.amount);

  if (absAmount < threshold) return;

  const merchantName = transaction.merchant ?? transaction.description ?? 'Unknown';
  const payload: NotificationPayload = {
    title: 'Large Transaction Alert',
    body: `${formatCents(transaction.amount)} at ${merchantName}`,
    tag: 'large-transaction',
    url: '/transactions',
    data: { type: 'large_transaction', amount: transaction.amount },
  };

  await pushNotificationService.sendNotification(
    userId,
    tenantId,
    payload,
    'transaction_alerts'
  );
}

/**
 * Trigger a BAS reminder for all tenant members with bas.read permission.
 *
 * @param tenantId - Tenant to notify
 * @param dueDate - BAS due date
 * @param daysUntilDue - Number of days until due
 */
export async function triggerBASReminder(
  tenantId: string,
  dueDate: string | Date,
  daysUntilDue: number
): Promise<void> {
  const members = await db
    .select()
    .from(tenantMembers)
    .where(eq(tenantMembers.tenantId, tenantId))
    .all();

  const payload: NotificationPayload = {
    title: 'BAS Reminder',
    body: `BAS due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'} — ${formatDate(dueDate)}`,
    tag: 'bas-reminder',
    url: '/bas',
    requireInteraction: daysUntilDue <= 3,
    data: { type: 'bas_reminder', dueDate: String(dueDate), daysUntilDue },
  };

  for (const member of members as any[]) {
    const memberUserId = member.userId ?? member.user_id;

    // Only send to members with bas.read permission
    try {
      const hasPerm = await rbacService.checkPermission(tenantId, memberUserId, 'bas.read');
      if (!hasPerm) continue;
    } catch {
      // If RBAC check fails, skip this member
      continue;
    }

    await pushNotificationService.sendNotification(
      memberUserId,
      tenantId,
      payload,
      'bas_reminders'
    );
  }
}

/**
 * Trigger a budget alert when spending exceeds the user's threshold percentage.
 *
 * @param userId - User to notify
 * @param tenantId - Tenant context
 * @param categoryName - Budget category name
 * @param percentUsed - Current percentage used (0-100+)
 */
export async function triggerBudgetAlert(
  userId: string,
  tenantId: string,
  categoryName: string,
  percentUsed: number
): Promise<void> {
  const threshold = await getBudgetAlertThreshold(userId, tenantId);

  if (percentUsed < threshold) return;

  const rounded = Math.round(percentUsed);
  const isOver = rounded > 100;

  const payload: NotificationPayload = {
    title: isOver ? 'Budget Exceeded' : 'Budget Alert',
    body: `${categoryName} is at ${rounded}% of budget`,
    tag: `budget-${categoryName.toLowerCase().replace(/\s+/g, '-')}`,
    url: '/budgets',
    requireInteraction: isOver,
    data: { type: 'budget_alert', categoryName, percentUsed: rounded },
  };

  await pushNotificationService.sendNotification(
    userId,
    tenantId,
    payload,
    'budget_alerts'
  );
}

/**
 * Trigger a bill reminder notification.
 *
 * @param userId - User to notify
 * @param tenantId - Tenant context
 * @param billName - Name/description of the bill
 * @param dueDate - Bill due date
 */
export async function triggerBillReminder(
  userId: string,
  tenantId: string,
  billName: string,
  dueDate: string | Date
): Promise<void> {
  const payload: NotificationPayload = {
    title: 'Bill Reminder',
    body: `${billName} due on ${formatDate(dueDate)}`,
    tag: `bill-${billName.toLowerCase().replace(/\s+/g, '-')}`,
    url: '/bills',
    data: { type: 'bill_reminder', billName, dueDate: String(dueDate) },
  };

  await pushNotificationService.sendNotification(
    userId,
    tenantId,
    payload,
    'bill_reminders'
  );
}

/**
 * Trigger a team notification (sent to all admins and owners of the tenant).
 *
 * @param tenantId - Tenant context
 * @param action - What happened (e.g., "added", "removed", "promoted")
 * @param actorName - Who performed the action
 * @param targetName - Who/what was acted upon
 */
export async function triggerTeamNotification(
  tenantId: string,
  action: string,
  actorName: string,
  targetName: string
): Promise<void> {
  const payload: NotificationPayload = {
    title: 'Team Update',
    body: `${actorName} ${action} ${targetName}`,
    tag: 'team-update',
    url: '/settings/team',
    data: { type: 'team_notification', action, actorName, targetName },
  };

  // Send to admins and owners only
  await pushNotificationService.sendToTenant(
    tenantId,
    payload,
    'team_notifications',
    ['owner', 'admin']
  );
}
