/**
 * Notification Triggers (Wave 24)
 *
 * Business logic triggers that fire push notifications for key application events.
 * Each trigger checks user preferences (thresholds, category toggles) before sending.
 */

import { pushNotificationService } from '../push-notifications/index.js';
import { db, tenantMembers } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { rbacService } from '../rbac/index.js';
import type { NotificationPayload } from '../push-notification-types.js';
import {
  formatCents,
  formatDate,
  getLargeTransactionThreshold,
  getBudgetAlertThreshold,
} from './helpers.js';

/**
 * Trigger a large transaction alert if the amount exceeds the user's threshold.
 */
export async function triggerLargeTransactionAlert(
  transaction: { amount: number; description?: string; merchant?: string },
  userId: string,
  tenantId: string,
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

  await pushNotificationService.sendNotification(userId, tenantId, payload, 'transaction_alerts');
}

/**
 * Trigger a BAS reminder for all tenant members with bas.read permission.
 */
export async function triggerBASReminder(
  tenantId: string,
  dueDate: string | Date,
  daysUntilDue: number,
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

  for (const member of members as Array<Record<string, unknown>>) {
    const memberUserId = String(member.userId ?? member.user_id ?? '');

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
      'bas_reminders',
    );
  }
}

/**
 * Trigger a budget alert when spending exceeds the user's threshold percentage.
 */
export async function triggerBudgetAlert(
  userId: string,
  tenantId: string,
  categoryName: string,
  percentUsed: number,
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

  await pushNotificationService.sendNotification(userId, tenantId, payload, 'budget_alerts');
}

/**
 * Trigger a bill reminder notification.
 */
export async function triggerBillReminder(
  userId: string,
  tenantId: string,
  billName: string,
  dueDate: string | Date,
): Promise<void> {
  const payload: NotificationPayload = {
    title: 'Bill Reminder',
    body: `${billName} due on ${formatDate(dueDate)}`,
    tag: `bill-${billName.toLowerCase().replace(/\s+/g, '-')}`,
    url: '/bills',
    data: { type: 'bill_reminder', billName, dueDate: String(dueDate) },
  };

  await pushNotificationService.sendNotification(userId, tenantId, payload, 'bill_reminders');
}

/**
 * Trigger a team notification (sent to all admins and owners of the tenant).
 */
export async function triggerTeamNotification(
  tenantId: string,
  action: string,
  actorName: string,
  targetName: string,
): Promise<void> {
  const payload: NotificationPayload = {
    title: 'Team Update',
    body: `${actorName} ${action} ${targetName}`,
    tag: 'team-update',
    url: '/settings/team',
    data: { type: 'team_notification', action, actorName, targetName },
  };

  // Send to admins and owners only
  await pushNotificationService.sendToTenant(tenantId, payload, 'team_notifications', [
    'owner',
    'admin',
  ]);
}
