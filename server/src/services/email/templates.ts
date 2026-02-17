/**
 * Email template utilities — rate limiter, HTML escaping, and template functions.
 *
 * Extracted from the email monolith to serve as sub-module exports.
 */

import { BRAND, config } from './sender.js';

// ---------------------------------------------------------------------------
// RATE LIMITER
// ---------------------------------------------------------------------------

export class RateLimiter {
  private timestamps: number[] = [];
  private readonly windowMs: number = 1000;
  private readonly maxRequests: number;

  constructor(maxRequestsPerSecond: number) {
    this.maxRequests = maxRequestsPerSecond;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldestTimestamp = this.timestamps[0];
      const waitTime = this.windowMs - (now - oldestTimestamp);
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.timestamps.push(Date.now());
  }
}

// ---------------------------------------------------------------------------
// HTML ESCAPING
// ---------------------------------------------------------------------------

/** Escape HTML special characters to prevent XSS attacks */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------------------------------------------------------------------------
// TEMPLATE FUNCTIONS
// ---------------------------------------------------------------------------

export function baseTemplate(content: string, preheader: string = ''): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${BRAND.appName}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; padding: 10px !important; }
            .content { padding: 20px !important; }
            .button { width: 100% !important; display: block !important; }
            .stack { display: block !important; width: 100% !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.backgroundColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
        ${preheader}
        &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.backgroundColor};">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.cardBackground}; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, ${BRAND.primaryColor} 0%, #E6B800 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
                            <h1 style="margin: 0; color: ${BRAND.secondaryColor}; font-size: 24px; font-weight: 700;">
                                ${BRAND.appName}
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td class="content" style="padding: 40px;">
                            ${content}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 40px 30px; border-top: 1px solid #EEEEEE;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="text-align: center; color: ${BRAND.mutedColor}; font-size: 12px; line-height: 1.6;">
                                        <p style="margin: 0 0 10px;">${BRAND.appName} - AI-Powered Financial Intelligence</p>
                                        <p style="margin: 0 0 10px;">
                                            <a href="${config.baseUrl}/settings/notifications" style="color: ${BRAND.mutedColor}; text-decoration: underline;">Manage notification preferences</a>
                                            &nbsp;|&nbsp;
                                            <a href="${config.baseUrl}/unsubscribe" style="color: ${BRAND.mutedColor}; text-decoration: underline;">Unsubscribe</a>
                                        </p>
                                        <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${BRAND.appName}. All rights reserved.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

export function buttonTemplate(text: string, url: string, primary: boolean = true): string {
  const bgColor = primary ? BRAND.primaryColor : BRAND.cardBackground;
  const textColor = primary ? BRAND.secondaryColor : BRAND.textColor;
  const border = primary ? 'none' : `2px solid ${BRAND.textColor}`;

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 25px 0;">
        <tr>
            <td align="center" style="border-radius: 6px; background-color: ${bgColor}; border: ${border};">
                <a href="${url}" target="_blank" class="button" style="display: inline-block; padding: 14px 32px; color: ${textColor}; text-decoration: none; font-weight: 600; font-size: 16px;">
                    ${text}
                </a>
            </td>
        </tr>
    </table>`;
}

export function statBoxTemplate(
  label: string,
  value: string,
  color: string = BRAND.textColor,
): string {
  return `
    <td class="stack" style="padding: 15px; text-align: center; background-color: ${BRAND.backgroundColor}; border-radius: 8px; width: 33%;">
        <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${color};">${value}</p>
        <p style="margin: 5px 0 0; font-size: 12px; color: ${BRAND.mutedColor}; text-transform: uppercase;">${label}</p>
    </td>`;
}

/**
 * Initialize template configuration — no-op; config and BRAND are in the sender module.
 */
export function initTemplateConfig(
  _config: Record<string, unknown>,
  _brand: Record<string, unknown>,
): void {
  // Config and brand are already initialized in the sender module.
}
