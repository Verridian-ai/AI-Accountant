/**
 * Email Sender — Template-Specific Send Methods
 *
 * sendWelcomeEmail, sendPasswordReset, sendTeamInvitation, sendBASReminder.
 */

import { sendEmail, config, BRAND } from './sender.js';
import { baseTemplate, buttonTemplate, escapeHtml, RateLimiter } from './templates.js';

export async function sendWelcomeEmail(
  to: string,
  name: string,
  rateLimiter: RateLimiter,
): Promise<{ success: boolean; error?: string }> {
  const safeName = escapeHtml(name);
  const content = `
            <h2 style="margin: 0 0 20px; color: ${BRAND.textColor}; font-size: 22px;">
                Welcome to ${BRAND.appName}, ${safeName}!
            </h2>

            <p style="margin: 0 0 15px; color: ${BRAND.textColor}; font-size: 16px; line-height: 1.6;">
                Thank you for joining ${BRAND.appName}. We're excited to help you manage your Australian bank statements with ease.
            </p>

            <p style="margin: 0 0 15px; color: ${BRAND.textColor}; font-size: 16px; line-height: 1.6;">
                Here's what you can do:
            </p>

            <ul style="margin: 0 0 20px; padding-left: 20px; color: ${BRAND.textColor}; font-size: 16px; line-height: 1.8;">
                <li>Upload and parse bank statements automatically</li>
                <li>Categorize transactions with AI assistance</li>
                <li>Generate BAS reports for tax compliance</li>
                <li>Track your financial health with insights</li>
            </ul>

            ${buttonTemplate('Get Started', `${config.baseUrl}/dashboard`)}

            <p style="margin: 20px 0 0; color: ${BRAND.mutedColor}; font-size: 14px;">
                If you have any questions, reply to this email or visit our
                <a href="${config.baseUrl}/help" style="color: ${BRAND.primaryColor}; text-decoration: none;">Help Center</a>.
            </p>
        `;

  return sendEmail(
    {
      to,
      subject: `Welcome to ${BRAND.appName}!`,
      html: baseTemplate(content, `Welcome ${name}! Start managing your bank statements today.`),
      tags: [{ name: 'type', value: 'welcome' }],
    },
    rateLimiter,
  );
}

export async function sendPasswordReset(
  to: string,
  resetToken: string,
  rateLimiter: RateLimiter,
): Promise<{ success: boolean; error?: string }> {
  const safeToken = encodeURIComponent(resetToken);
  const resetUrl = `${config.baseUrl}/reset-password?token=${safeToken}`;

  const content = `
            <h2 style="margin: 0 0 20px; color: ${BRAND.textColor}; font-size: 22px;">
                Reset Your Password
            </h2>

            <p style="margin: 0 0 15px; color: ${BRAND.textColor}; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password. Click the button below to create a new password:
            </p>

            ${buttonTemplate('Reset Password', resetUrl)}

            <p style="margin: 20px 0 0; color: ${BRAND.mutedColor}; font-size: 14px; line-height: 1.6;">
                This link will expire in 1 hour for security reasons.
            </p>

            <p style="margin: 15px 0 0; color: ${BRAND.mutedColor}; font-size: 14px; line-height: 1.6;">
                If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
            </p>

            <div style="margin-top: 25px; padding: 15px; background-color: ${BRAND.backgroundColor}; border-radius: 6px; border-left: 4px solid ${BRAND.primaryColor};">
                <p style="margin: 0; color: ${BRAND.mutedColor}; font-size: 13px;">
                    <strong>Security tip:</strong> Never share your password or this reset link with anyone. ${BRAND.appName} will never ask for your password via email.
                </p>
            </div>
        `;

  return sendEmail(
    {
      to,
      subject: `Reset your ${BRAND.appName} password`,
      html: baseTemplate(content, 'Reset your password to regain access to your account.'),
      tags: [{ name: 'type', value: 'password_reset' }],
    },
    rateLimiter,
  );
}

export async function sendTeamInvitation(
  to: string,
  teamName: string,
  inviterName: string,
  inviteLink: string,
  rateLimiter: RateLimiter,
): Promise<{ success: boolean; error?: string }> {
  const safeTeamName = escapeHtml(teamName);
  const safeInviterName = escapeHtml(inviterName);
  const content = `
            <h2 style="margin: 0 0 20px; color: ${BRAND.textColor}; font-size: 22px;">
                You've Been Invited to Join a Team
            </h2>

            <p style="margin: 0 0 15px; color: ${BRAND.textColor}; font-size: 16px; line-height: 1.6;">
                <strong>${safeInviterName}</strong> has invited you to join <strong>${safeTeamName}</strong> on ${BRAND.appName}.
            </p>

            <p style="margin: 0 0 15px; color: ${BRAND.textColor}; font-size: 16px; line-height: 1.6;">
                By joining, you'll be able to:
            </p>

            <ul style="margin: 0 0 20px; padding-left: 20px; color: ${BRAND.textColor}; font-size: 16px; line-height: 1.8;">
                <li>Collaborate on financial records</li>
                <li>Share transaction categorizations</li>
                <li>Generate team-wide reports</li>
            </ul>

            ${buttonTemplate('Accept Invitation', inviteLink)}

            <p style="margin: 20px 0 0; color: ${BRAND.mutedColor}; font-size: 14px; line-height: 1.6;">
                This invitation will expire in 7 days. If you don't recognize this invitation, you can safely ignore this email.
            </p>
        `;

  return sendEmail(
    {
      to,
      subject: `${safeInviterName} invited you to join ${safeTeamName}`,
      html: baseTemplate(content, `Join ${safeTeamName} on ${BRAND.appName}`),
      tags: [
        { name: 'type', value: 'team_invitation' },
        { name: 'team', value: teamName },
      ],
    },
    rateLimiter,
  );
}

export async function sendBASReminder(
  to: string,
  period: string,
  dueDate: string,
  rateLimiter: RateLimiter,
): Promise<{ success: boolean; error?: string }> {
  const formattedDueDate = new Date(dueDate).toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const daysUntilDue = Math.ceil(
    (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const urgencyColor = daysUntilDue <= 3 ? '#DC3545' : daysUntilDue <= 7 ? '#FFC107' : '#28A745';

  const content = `
            <h2 style="margin: 0 0 20px; color: ${BRAND.textColor}; font-size: 22px;">
                BAS Lodgement Reminder
            </h2>

            <div style="margin-bottom: 25px; padding: 20px; background-color: ${BRAND.backgroundColor}; border-radius: 8px; text-align: center;">
                <p style="margin: 0 0 5px; color: ${BRAND.mutedColor}; font-size: 14px; text-transform: uppercase;">
                    ${period}
                </p>
                <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${urgencyColor};">
                    ${daysUntilDue} days remaining
                </p>
                <p style="margin: 5px 0 0; color: ${BRAND.textColor}; font-size: 14px;">
                    Due: ${formattedDueDate}
                </p>
            </div>

            <p style="margin: 0 0 15px; color: ${BRAND.textColor}; font-size: 16px; line-height: 1.6;">
                Your Business Activity Statement for <strong>${period}</strong> is due soon. Make sure all your transactions are categorized and your GST calculations are complete.
            </p>

            ${buttonTemplate('Review BAS Report', `${config.baseUrl}/reports/bas`)}

            <div style="margin-top: 25px; padding: 15px; background-color: #FFF3CD; border-radius: 6px; border-left: 4px solid ${BRAND.primaryColor};">
                <p style="margin: 0; color: #856404; font-size: 13px;">
                    <strong>Reminder:</strong> Late lodgement may result in penalties from the ATO. If you need an extension, contact your tax agent or apply through myGov.
                </p>
            </div>
        `;

  return sendEmail(
    {
      to,
      subject: `BAS Reminder: ${period} due in ${daysUntilDue} days`,
      html: baseTemplate(content, `Your BAS for ${period} is due on ${formattedDueDate}`),
      tags: [
        { name: 'type', value: 'bas_reminder' },
        { name: 'period', value: period },
      ],
    },
    rateLimiter,
  );
}
