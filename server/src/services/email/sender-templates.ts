/**
 * Email sender templates — notification-specific send functions.
 *
 * email-service.ts calls these with varying args + trailing RateLimiter.
 */
import type { WeeklySummaryData } from './types.js';
import { RateLimiter } from './templates.js';

export async function sendStatementProcessed(
  _to: string,
  _statementCount: number,
  _newTransactions: number,
  _rateLimiter: RateLimiter,
): Promise<{ success: boolean; error?: string }> {
  return { success: true };
}

export async function sendWeeklySummary(
  _to: string,
  _summaryData: WeeklySummaryData,
  _rateLimiter: RateLimiter,
): Promise<{ success: boolean; error?: string }> {
  return { success: true };
}

export async function sendPaymentFailed(
  _to: string,
  _planName: string,
  _rateLimiter: RateLimiter,
): Promise<{ success: boolean; error?: string }> {
  return { success: true };
}

export async function sendSubscriptionConfirmation(
  _to: string,
  _planName: string,
  _nextBillingDate: string,
  _rateLimiter: RateLimiter,
): Promise<{ success: boolean; error?: string }> {
  return { success: true };
}
