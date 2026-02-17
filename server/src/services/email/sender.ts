/**
 * Email sender — core send function, config, branding, and user-preference checking.
 *
 * Extracted from the email monolith. Other modules import config/BRAND from here.
 */
import type { NotificationType, EmailOptions } from './types.js';

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

export const config = {
  apiKey: process.env.RESEND_API_KEY || '',
  from: process.env.EMAIL_FROM || 'GoldLedger <noreply@goldledger.com.au>',
  baseUrl: process.env.APP_URL || 'https://goldledger.com.au',
  rateLimitPerSecond: 10,
  maxBatchSize: 100,
  retryAttempts: 3,
  retryDelayMs: 1000,
};

// ---------------------------------------------------------------------------
// BRANDING
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// CORE SEND
// ---------------------------------------------------------------------------

interface RateLimiterLike {
  waitForSlot(): Promise<void>;
}

/**
 * Send an email via the Resend API.
 * Accepts an optional rate limiter (used by sender-methods and sender-weekly).
 */
export async function sendEmail(
  options: EmailOptions,
  rateLimiter?: RateLimiterLike,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.apiKey) {
    console.warn('[EmailService] RESEND_API_KEY not configured, skipping email send');
    return { success: false, error: 'Email service not configured' };
  }

  if (rateLimiter) {
    await rateLimiter.waitForSlot();
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
        tags: options.tags,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error((errorData as Record<string, string>).message || `HTTP ${response.status}`);
    }

    const data = (await response.json()) as { id: string };
    return { success: true, messageId: data.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[EmailService] Send failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// USER PREFERENCES
// ---------------------------------------------------------------------------

export async function checkUserPreferences(
  _userId: string,
  notificationType: NotificationType,
): Promise<boolean> {
  if (notificationType === 'marketing') return false;
  return true;
}

// ---------------------------------------------------------------------------
// RE-EXPORTS from sender-methods (email-service.ts imports these from sender)
// ---------------------------------------------------------------------------

export {
  sendWelcomeEmail,
  sendPasswordReset,
  sendTeamInvitation,
  sendBASReminder,
} from './sender-methods.js';
