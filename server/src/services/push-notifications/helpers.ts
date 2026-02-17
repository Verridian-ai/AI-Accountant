/**
 * Push Notification Helper Functions
 */

import type { PushSubscriptionRecord } from '../push-notification-types.js';

/** Parse keys JSON from DB (stored as text) */
export function parseKeysJson(raw: unknown): { p256dh: string; auth: string } {
  if (!raw) return { p256dh: '', auth: '' };
  if (typeof raw === 'object') return raw as { p256dh: string; auth: string };
  try {
    return JSON.parse(raw as string);
  } catch {
    return { p256dh: '', auth: '' };
  }
}

/** Convert raw DB row to PushSubscriptionRecord */
export function rowToSubscription(row: any): PushSubscriptionRecord {
  return {
    id: row.id,
    userId: row.userId ?? row.user_id,
    tenantId: row.tenantId ?? row.tenant_id,
    endpoint: row.endpoint,
    keysJson: parseKeysJson(row.keysJson ?? row.keys_json),
    deviceName: row.deviceName ?? row.device_name ?? undefined,
    isActive: Boolean(row.isActive ?? row.is_active ?? true),
    lastUsedAt: row.lastUsedAt ?? row.last_used_at ?? undefined,
    errorCount: Number(row.errorCount ?? row.error_count ?? 0),
  };
}

/**
 * Get current time as HH:MM in the given IANA timezone.
 * Falls back to Australia/Sydney if the timezone is invalid.
 */
export function getCurrentTimeInTimezone(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(new Date());
  } catch {
    const formatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(new Date());
  }
}

/**
 * Check if a HH:MM time is within a quiet window.
 * Handles overnight ranges (e.g., 22:00 -> 07:00).
 */
export function isTimeInRange(current: string, start: string, end: string): boolean {
  if (start <= end) {
    // Same-day range: e.g., 09:00 -> 17:00
    return current >= start && current < end;
  }
  // Overnight range: e.g., 22:00 -> 07:00
  return current >= start || current < end;
}

/** Small delay helper for rate-limited bulk sends */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
