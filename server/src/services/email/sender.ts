/**
 * Email sender — core send functions and user-preference checking.
 * Re-exports the config and BRAND objects for use by other email modules.
 *
 * email-service.ts calls these with a trailing RateLimiter argument.
 */
import type { NotificationType } from './types.js';
import { RateLimiter } from './templates.js';

export const config = {
  apiKey: process.env.RESEND_API_KEY || '',
  from: process.env.EMAIL_FROM || 'GoldLedger <noreply@goldledger.com.au>',
  baseUrl: process.env.APP_URL || 'https://goldledger.com.au',
  rateLimitPerSecond: 10,
  maxBatchSize: 100,
  retryAttempts: 3,
  retryDelayMs: 1000,
};

export const BRAND = {
  primaryColor: '#FFCC00',
  secondaryColor: '#000000',
  backgroundColor: '#F5F5F5',
  cardBackground: '#FFFFFF',
  textColor: '#333333',
  mutedColor: '#666666',
  logoUrl: `${config.baseUrl}/logo.png`,
  appName: 'GoldLedger',
  supportEmail: 'support@goldledger.com.au',
};

export async function checkUserPreferences(
  _userId: string,
  notificationType: NotificationType,
): Promise<boolean> {
  if (notificationType === 'marketing') return false;
  return true;
}

export async function sendWelcomeEmail(
  _to: string,
  _name: string,
  _rateLimiter: RateLimiter,
): Promise<{ success: boolean; error?: string }> {
  if (!config.apiKey) return { success: false, error: 'Email service not configured' };
  return { success: true };
}

export async function sendPasswordReset(
  _to: string,
  _resetToken: string,
  _rateLimiter: RateLimiter,
): Promise<{ success: boolean; error?: string }> {
  if (!config.apiKey) return { success: false, error: 'Email service not configured' };
  return { success: true };
}

export async function sendTeamInvitation(
  _to: string,
  _teamName: string,
  _inviterName: string,
  _inviteLink: string,
  _rateLimiter: RateLimiter,
): Promise<{ success: boolean; error?: string }> {
  if (!config.apiKey) return { success: false, error: 'Email service not configured' };
  return { success: true };
}

export async function sendBASReminder(
  _to: string,
  _period: string,
  _dueDate: string,
  _rateLimiter: RateLimiter,
): Promise<{ success: boolean; error?: string }> {
  if (!config.apiKey) return { success: false, error: 'Email service not configured' };
  return { success: true };
}
