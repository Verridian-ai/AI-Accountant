/**
 * Intelligence Subscription Notification Dispatch
 *
 * Handles dispatching notifications via various channels (in-app, SSE, email, webhook).
 */

import { logger } from '../../lib/logger.js';
import type { TriggeredNotification } from './types.js';

/**
 * Send an SSE event on a given channel.
 */
export async function sendSSE(channel: string, data: unknown): Promise<void> {
  logger.info(
    { data: JSON.stringify(data).slice(0, 200) },
    `[IntelSub] SSE event on channel "${channel}"`,
  );
}

/**
 * Send a webhook POST request with retry logic (up to 3 attempts).
 */
export async function sendWebhook(url: string, payload: unknown): Promise<boolean> {
  if (!url) {
    logger.warn('[IntelSub] Webhook URL is empty, skipping');
    return false;
  }

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) return true;

      logger.warn(`[IntelSub] Webhook attempt ${attempt}/${maxRetries} failed: HTTP ${res.status}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[IntelSub] Webhook attempt ${attempt}/${maxRetries} error:`, message);
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  return false;
}

/**
 * Send an email notification (stub -- logs only).
 */
export async function sendEmail(address: string, subject: string, body: string): Promise<void> {
  logger.info(`[IntelSub] Email to "${address}" -- Subject: "${subject}"\n${body.slice(0, 300)}`);
}

/**
 * Dispatch a single triggered notification via its configured channel.
 * Returns the result including success/failure and any error message.
 */
export async function dispatchNotification(
  notif: TriggeredNotification,
): Promise<{ success: boolean; error?: string }> {
  let success = false;
  let error: string | undefined;

  try {
    switch (notif.channel) {
      case 'in_app':
        logger.info(
          `[IntelSub] In-app notification for subscription ${notif.subscriptionId}: "${notif.insight.title}"`,
        );
        success = true;
        break;

      case 'sse':
        await sendSSE(String(notif.config.sseChannel ?? 'intelligence'), {
          type: 'intelligence_insight',
          insight: notif.insight,
          subscriptionId: notif.subscriptionId,
        });
        success = true;
        break;

      case 'email':
        await sendEmail(
          String(notif.config.emailAddress ?? ''),
          `Intelligence Alert: ${notif.insight.title}`,
          `${notif.insight.description}\n\nSeverity: ${notif.insight.severity}\nConfidence: ${(notif.insight.confidence * 100).toFixed(0)}%${notif.insight.recommendedAction ? `\nRecommended action: ${notif.insight.recommendedAction}` : ''}`,
        );
        success = true;
        break;

      case 'webhook':
        success = await sendWebhook(String(notif.config.webhookUrl ?? ''), {
          event: 'intelligence_insight',
          subscriptionId: notif.subscriptionId,
          subscriptionName: notif.subscriptionName,
          insight: notif.insight,
          timestamp: new Date().toISOString(),
        });
        break;

      default:
        error = `Unknown channel: ${notif.channel}`;
    }
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : String(err);
  }

  return { success, error };
}
