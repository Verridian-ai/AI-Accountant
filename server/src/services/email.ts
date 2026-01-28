import { db, users, subscriptions, basPeriods, teamInvitations, teams } from '../schema.js';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type NotificationType =
    | 'welcome'
    | 'password_reset'
    | 'team_invitation'
    | 'bas_reminder'
    | 'statement_processed'
    | 'weekly_summary'
    | 'payment_failed'
    | 'subscription_confirmation'
    | 'marketing';

export interface EmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
    tags?: Array<{ name: string; value: string }>;
}

export interface WeeklySummaryData {
    totalIncome: number;
    totalExpenses: number;
    netCashFlow: number;
    topCategories: Array<{ name: string; amount: number }>;
    transactionCount: number;
    accountBalances: Array<{ name: string; balance: number }>;
    alertCount: number;
    upcomingBAS?: { period: string; dueDate: string } | null;
}

export interface BatchEmailJob {
    id: string;
    to: string;
    template: NotificationType;
    data: Record<string, unknown>;
    scheduledFor?: Date;
    status: 'pending' | 'sent' | 'failed';
    attempts: number;
    lastError?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'CBA Parser <noreply@cba-parser.com>',
    baseUrl: process.env.APP_URL || 'https://cba-parser.com',
    rateLimitPerSecond: 10,
    maxBatchSize: 100,
    retryAttempts: 3,
    retryDelayMs: 1000,
};

// ============================================================================
// BRANDING CONSTANTS
// ============================================================================

const BRAND = {
    primaryColor: '#FFCC00', // CBA Gold
    secondaryColor: '#000000',
    backgroundColor: '#F5F5F5',
    cardBackground: '#FFFFFF',
    textColor: '#333333',
    mutedColor: '#666666',
    logoUrl: `${config.baseUrl}/logo.png`,
    appName: 'CBA Parser',
    supportEmail: 'support@cba-parser.com',
};

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function baseTemplate(content: string, preheader: string = ''): string {
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
        /* Reset styles */
        body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }

        /* Mobile styles */
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; padding: 10px !important; }
            .content { padding: 20px !important; }
            .button { width: 100% !important; display: block !important; }
            .stack { display: block !important; width: 100% !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.backgroundColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <!-- Preheader text (hidden) -->
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
        ${preheader}
        &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>

    <!-- Email container -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.backgroundColor};">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <!-- Main content card -->
                <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.cardBackground}; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header with gold accent -->
                    <tr>
                        <td style="background: linear-gradient(135deg, ${BRAND.primaryColor} 0%, #E6B800 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
                            <h1 style="margin: 0; color: ${BRAND.secondaryColor}; font-size: 24px; font-weight: 700;">
                                ${BRAND.appName}
                            </h1>
                        </td>
                    </tr>

                    <!-- Content area -->
                    <tr>
                        <td class="content" style="padding: 40px;">
                            ${content}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px 30px; border-top: 1px solid #EEEEEE;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="text-align: center; color: ${BRAND.mutedColor}; font-size: 12px; line-height: 1.6;">
                                        <p style="margin: 0 0 10px;">
                                            ${BRAND.appName} - Australian Bank Statement Parser
                                        </p>
                                        <p style="margin: 0 0 10px;">
                                            <a href="${config.baseUrl}/settings/notifications" style="color: ${BRAND.mutedColor}; text-decoration: underline;">Manage notification preferences</a>
                                            &nbsp;|&nbsp;
                                            <a href="${config.baseUrl}/unsubscribe" style="color: ${BRAND.mutedColor}; text-decoration: underline;">Unsubscribe</a>
                                        </p>
                                        <p style="margin: 0;">
                                            &copy; ${new Date().getFullYear()} ${BRAND.appName}. All rights reserved.
                                        </p>
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

function buttonTemplate(text: string, url: string, primary: boolean = true): string {
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

function statBoxTemplate(label: string, value: string, color: string = BRAND.textColor): string {
    return `
    <td class="stack" style="padding: 15px; text-align: center; background-color: ${BRAND.backgroundColor}; border-radius: 8px; width: 33%;">
        <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${color};">${value}</p>
        <p style="margin: 5px 0 0; font-size: 12px; color: ${BRAND.mutedColor}; text-transform: uppercase;">${label}</p>
    </td>`;
}

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
    private timestamps: number[] = [];
    private readonly windowMs: number = 1000;
    private readonly maxRequests: number;

    constructor(maxRequestsPerSecond: number) {
        this.maxRequests = maxRequestsPerSecond;
    }

    async waitForSlot(): Promise<void> {
        const now = Date.now();
        this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

        if (this.timestamps.length >= this.maxRequests) {
            const oldestTimestamp = this.timestamps[0];
            const waitTime = this.windowMs - (now - oldestTimestamp);
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        this.timestamps.push(Date.now());
    }
}

// ============================================================================
// HTML ESCAPING UTILITY
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS attacks
 */
function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================================
// EMAIL SERVICE CLASS
// ============================================================================

export class EmailService {
    private rateLimiter: RateLimiter;
    private batchQueue: BatchEmailJob[] = [];
    private isBatchProcessing: boolean = false;

    constructor() {
        this.rateLimiter = new RateLimiter(config.rateLimitPerSecond);
    }

    // -------------------------------------------------------------------------
    // CORE SEND METHOD
    // -------------------------------------------------------------------------

    private async send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
        if (!config.apiKey) {
            console.warn('[EmailService] RESEND_API_KEY not configured, skipping email send');
            return { success: false, error: 'Email service not configured' };
        }

        await this.rateLimiter.waitForSlot();

        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
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
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return { success: true, messageId: data.id };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[EmailService] Send failed:', errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    // -------------------------------------------------------------------------
    // USER PREFERENCE CHECK
    // -------------------------------------------------------------------------

    async checkUserPreferences(userId: string, notificationType: NotificationType): Promise<boolean> {
        // Marketing emails require explicit opt-in
        if (notificationType === 'marketing') {
            // For now, assume users have not opted in to marketing
            // In a full implementation, check a user_preferences table
            return false;
        }

        // Transactional emails (password reset, welcome, etc.) are always allowed
        const transactionalTypes: NotificationType[] = [
            'welcome',
            'password_reset',
            'team_invitation',
            'payment_failed',
        ];

        if (transactionalTypes.includes(notificationType)) {
            return true;
        }

        // For other notification types, check user preferences
        // This would query a notification_preferences table in production
        // For now, default to allowing notifications
        try {
            const user = await db.select()
                .from(users)
                .where(eq(users.id, userId))
                .get();

            return !!user; // Allow if user exists
        } catch {
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // EMAIL METHODS
    // -------------------------------------------------------------------------

    /**
     * Send welcome email to new users
     */
    async sendWelcomeEmail(to: string, name: string): Promise<{ success: boolean; error?: string }> {
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
                <li>Upload and parse CBA bank statements automatically</li>
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

        return this.send({
            to,
            subject: `Welcome to ${BRAND.appName}!`,
            html: baseTemplate(content, `Welcome ${name}! Start managing your bank statements today.`),
            tags: [{ name: 'type', value: 'welcome' }],
        });
    }

    /**
     * Send password reset email
     */
    async sendPasswordReset(to: string, resetToken: string): Promise<{ success: boolean; error?: string }> {
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

        return this.send({
            to,
            subject: `Reset your ${BRAND.appName} password`,
            html: baseTemplate(content, 'Reset your password to regain access to your account.'),
            tags: [{ name: 'type', value: 'password_reset' }],
        });
    }

    /**
     * Send team invitation email
     */
    async sendTeamInvitation(
        to: string,
        teamName: string,
        inviterName: string,
        inviteLink: string
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

        return this.send({
            to,
            subject: `${safeInviterName} invited you to join ${safeTeamName}`,
            html: baseTemplate(content, `Join ${safeTeamName} on ${BRAND.appName}`),
            tags: [
                { name: 'type', value: 'team_invitation' },
                { name: 'team', value: teamName },
            ],
        });
    }

    /**
     * Send BAS lodgement reminder
     */
    async sendBASReminder(
        to: string,
        period: string,
        dueDate: string
    ): Promise<{ success: boolean; error?: string }> {
        const formattedDueDate = new Date(dueDate).toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        const daysUntilDue = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
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

        return this.send({
            to,
            subject: `BAS Reminder: ${period} due in ${daysUntilDue} days`,
            html: baseTemplate(content, `Your BAS for ${period} is due on ${formattedDueDate}`),
            tags: [
                { name: 'type', value: 'bas_reminder' },
                { name: 'period', value: period },
            ],
        });
    }

    /**
     * Send statement processed notification
     */
    async sendStatementProcessed(
        to: string,
        statementCount: number,
        newTransactions: number
    ): Promise<{ success: boolean; error?: string }> {
        const content = `
            <h2 style="margin: 0 0 20px; color: ${BRAND.textColor}; font-size: 22px;">
                Statements Processed Successfully
            </h2>

            <p style="margin: 0 0 20px; color: ${BRAND.textColor}; font-size: 16px; line-height: 1.6;">
                Great news! Your bank statements have been processed and are ready for review.
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="10" style="margin-bottom: 25px;">
                <tr>
                    ${statBoxTemplate('Statements', statementCount.toString())}
                    <td width="10"></td>
                    ${statBoxTemplate('Transactions', newTransactions.toString(), '#28A745')}
                </tr>
            </table>

            <p style="margin: 0 0 15px; color: ${BRAND.textColor}; font-size: 16px; line-height: 1.6;">
                AI categorization has been applied to your transactions. Please review and adjust any categories as needed.
            </p>

            ${buttonTemplate('View Transactions', `${config.baseUrl}/transactions`)}

            <p style="margin: 20px 0 0; color: ${BRAND.mutedColor}; font-size: 14px;">
                Tip: Correcting categories helps our AI learn your preferences for future statements.
            </p>
        `;

        return this.send({
            to,
            subject: `${statementCount} statement${statementCount > 1 ? 's' : ''} processed - ${newTransactions} new transactions`,
            html: baseTemplate(content, `${newTransactions} new transactions have been imported from your bank statements.`),
            tags: [{ name: 'type', value: 'statement_processed' }],
        });
    }

    /**
     * Send weekly financial summary
     */
    async sendWeeklySummary(
        to: string,
        summaryData: WeeklySummaryData
    ): Promise<{ success: boolean; error?: string }> {
        const formatCurrency = (cents: number): string => {
            const dollars = Math.abs(cents) / 100;
            const formatted = dollars.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return cents < 0 ? `-$${formatted}` : `$${formatted}`;
        };

        const cashFlowColor = summaryData.netCashFlow >= 0 ? '#28A745' : '#DC3545';

        const categoriesHtml = summaryData.topCategories
            .slice(0, 5)
            .map(cat => `
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #EEEEEE; color: ${BRAND.textColor};">
                        ${cat.name}
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #EEEEEE; text-align: right; color: ${BRAND.textColor}; font-weight: 600;">
                        ${formatCurrency(cat.amount)}
                    </td>
                </tr>
            `)
            .join('');

        const accountsHtml = summaryData.accountBalances
            .map(acc => `
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #EEEEEE; color: ${BRAND.textColor};">
                        ${acc.name}
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #EEEEEE; text-align: right; color: ${BRAND.textColor}; font-weight: 600;">
                        ${formatCurrency(acc.balance)}
                    </td>
                </tr>
            `)
            .join('');

        const content = `
            <h2 style="margin: 0 0 20px; color: ${BRAND.textColor}; font-size: 22px;">
                Your Weekly Financial Summary
            </h2>

            <p style="margin: 0 0 25px; color: ${BRAND.mutedColor}; font-size: 14px;">
                Week ending ${new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <!-- Key Stats -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="10" style="margin-bottom: 30px;">
                <tr>
                    ${statBoxTemplate('Income', formatCurrency(summaryData.totalIncome), '#28A745')}
                    <td width="10"></td>
                    ${statBoxTemplate('Expenses', formatCurrency(summaryData.totalExpenses), '#DC3545')}
                    <td width="10"></td>
                    ${statBoxTemplate('Net', formatCurrency(summaryData.netCashFlow), cashFlowColor)}
                </tr>
            </table>

            <!-- Top Categories -->
            <h3 style="margin: 0 0 15px; color: ${BRAND.textColor}; font-size: 18px; border-bottom: 2px solid ${BRAND.primaryColor}; padding-bottom: 10px;">
                Top Spending Categories
            </h3>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                ${categoriesHtml || '<tr><td style="padding: 15px; color: ' + BRAND.mutedColor + '; text-align: center;">No transactions this week</td></tr>'}
            </table>

            <!-- Account Balances -->
            <h3 style="margin: 0 0 15px; color: ${BRAND.textColor}; font-size: 18px; border-bottom: 2px solid ${BRAND.primaryColor}; padding-bottom: 10px;">
                Account Balances
            </h3>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                ${accountsHtml || '<tr><td style="padding: 15px; color: ' + BRAND.mutedColor + '; text-align: center;">No accounts linked</td></tr>'}
            </table>

            ${summaryData.upcomingBAS ? `
            <!-- BAS Alert -->
            <div style="margin-bottom: 25px; padding: 15px; background-color: #FFF3CD; border-radius: 6px; border-left: 4px solid ${BRAND.primaryColor};">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                    <strong>Upcoming BAS:</strong> ${summaryData.upcomingBAS.period} is due on ${summaryData.upcomingBAS.dueDate}
                </p>
            </div>
            ` : ''}

            ${summaryData.alertCount > 0 ? `
            <!-- Alerts Notice -->
            <div style="margin-bottom: 25px; padding: 15px; background-color: #F8D7DA; border-radius: 6px; border-left: 4px solid #DC3545;">
                <p style="margin: 0; color: #721C24; font-size: 14px;">
                    <strong>Attention:</strong> You have ${summaryData.alertCount} reconciliation alert${summaryData.alertCount > 1 ? 's' : ''} requiring review.
                </p>
            </div>
            ` : ''}

            ${buttonTemplate('View Full Report', `${config.baseUrl}/reports`)}

            <p style="margin: 20px 0 0; color: ${BRAND.mutedColor}; font-size: 14px; text-align: center;">
                ${summaryData.transactionCount} transactions processed this week
            </p>
        `;

        return this.send({
            to,
            subject: `Weekly Summary: ${formatCurrency(summaryData.netCashFlow)} net cash flow`,
            html: baseTemplate(content, `Your weekly financial summary is ready. Net cash flow: ${formatCurrency(summaryData.netCashFlow)}`),
            tags: [{ name: 'type', value: 'weekly_summary' }],
        });
    }

    /**
     * Send payment failed notification
     */
    async sendPaymentFailed(
        to: string,
        planName: string
    ): Promise<{ success: boolean; error?: string }> {
        const content = `
            <h2 style="margin: 0 0 20px; color: #DC3545; font-size: 22px;">
                Payment Failed
            </h2>

            <p style="margin: 0 0 15px; color: ${BRAND.textColor}; font-size: 16px; line-height: 1.6;">
                We were unable to process your payment for the <strong>${planName}</strong> subscription.
            </p>

            <p style="margin: 0 0 15px; color: ${BRAND.textColor}; font-size: 16px; line-height: 1.6;">
                To avoid any interruption to your service, please update your payment method within the next 3 days.
            </p>

            ${buttonTemplate('Update Payment Method', `${config.baseUrl}/settings/billing`)}

            <div style="margin-top: 25px; padding: 15px; background-color: ${BRAND.backgroundColor}; border-radius: 6px;">
                <p style="margin: 0 0 10px; color: ${BRAND.textColor}; font-size: 14px; font-weight: 600;">
                    Common reasons for payment failures:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: ${BRAND.mutedColor}; font-size: 14px; line-height: 1.8;">
                    <li>Expired credit card</li>
                    <li>Insufficient funds</li>
                    <li>Bank declined the transaction</li>
                    <li>Updated card number</li>
                </ul>
            </div>

            <p style="margin: 25px 0 0; color: ${BRAND.mutedColor}; font-size: 14px;">
                If you need assistance, please contact us at
                <a href="mailto:${BRAND.supportEmail}" style="color: ${BRAND.primaryColor}; text-decoration: none;">${BRAND.supportEmail}</a>
            </p>
        `;

        return this.send({
            to,
            subject: `Action Required: Payment failed for ${planName}`,
            html: baseTemplate(content, 'Your subscription payment could not be processed. Please update your payment method.'),
            tags: [
                { name: 'type', value: 'payment_failed' },
                { name: 'plan', value: planName },
            ],
        });
    }

    /**
     * Send subscription confirmation
     */
    async sendSubscriptionConfirmation(
        to: string,
        planName: string,
        nextBillingDate: string
    ): Promise<{ success: boolean; error?: string }> {
        const formattedDate = new Date(nextBillingDate).toLocaleDateString('en-AU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        const content = `
            <h2 style="margin: 0 0 20px; color: ${BRAND.textColor}; font-size: 22px;">
                Subscription Confirmed
            </h2>

            <div style="margin-bottom: 25px; padding: 25px; background: linear-gradient(135deg, ${BRAND.primaryColor}22 0%, ${BRAND.primaryColor}11 100%); border-radius: 8px; text-align: center; border: 2px solid ${BRAND.primaryColor};">
                <p style="margin: 0 0 5px; color: ${BRAND.mutedColor}; font-size: 14px; text-transform: uppercase;">
                    Your Plan
                </p>
                <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND.textColor};">
                    ${planName}
                </p>
            </div>

            <p style="margin: 0 0 15px; color: ${BRAND.textColor}; font-size: 16px; line-height: 1.6;">
                Thank you for subscribing to ${BRAND.appName} ${planName}! Your subscription is now active.
            </p>

            <p style="margin: 0 0 25px; color: ${BRAND.textColor}; font-size: 16px; line-height: 1.6;">
                <strong>Next billing date:</strong> ${formattedDate}
            </p>

            <h3 style="margin: 0 0 15px; color: ${BRAND.textColor}; font-size: 18px;">
                What's included in ${planName}:
            </h3>

            <ul style="margin: 0 0 25px; padding-left: 20px; color: ${BRAND.textColor}; font-size: 16px; line-height: 1.8;">
                <li>Unlimited statement uploads</li>
                <li>Advanced AI categorization</li>
                <li>Full BAS reporting</li>
                <li>Team collaboration features</li>
                <li>Priority support</li>
            </ul>

            ${buttonTemplate('Go to Dashboard', `${config.baseUrl}/dashboard`)}

            <p style="margin: 20px 0 0; color: ${BRAND.mutedColor}; font-size: 14px;">
                You can manage your subscription anytime in
                <a href="${config.baseUrl}/settings/billing" style="color: ${BRAND.primaryColor}; text-decoration: none;">Billing Settings</a>.
            </p>
        `;

        return this.send({
            to,
            subject: `Welcome to ${BRAND.appName} ${planName}!`,
            html: baseTemplate(content, `Your ${planName} subscription is now active.`),
            tags: [
                { name: 'type', value: 'subscription_confirmation' },
                { name: 'plan', value: planName },
            ],
        });
    }

    // -------------------------------------------------------------------------
    // BATCH SENDING
    // -------------------------------------------------------------------------

    /**
     * Add emails to batch queue
     */
    addToBatch(job: Omit<BatchEmailJob, 'id' | 'status' | 'attempts'>): void {
        this.batchQueue.push({
            ...job,
            id: crypto.randomUUID(),
            status: 'pending',
            attempts: 0,
        });
    }

    /**
     * Process batch email queue
     */
    async processBatch(): Promise<{ sent: number; failed: number; errors: string[] }> {
        if (this.isBatchProcessing) {
            return { sent: 0, failed: 0, errors: ['Batch processing already in progress'] };
        }

        this.isBatchProcessing = true;
        const results = { sent: 0, failed: 0, errors: [] as string[] };

        try {
            const pendingJobs = this.batchQueue
                .filter(job => job.status === 'pending' && job.attempts < config.retryAttempts)
                .slice(0, config.maxBatchSize);

            for (const job of pendingJobs) {
                job.attempts++;

                // Check if scheduled for later
                if (job.scheduledFor && job.scheduledFor > new Date()) {
                    continue;
                }

                // Check user preferences
                const canSend = await this.checkUserPreferences(
                    job.data.userId as string || '',
                    job.template
                );

                if (!canSend) {
                    job.status = 'failed';
                    job.lastError = 'User has opted out of this notification type';
                    results.failed++;
                    continue;
                }

                // Send based on template type
                let result: { success: boolean; error?: string };

                switch (job.template) {
                    case 'welcome':
                        result = await this.sendWelcomeEmail(job.to, job.data.name as string);
                        break;
                    case 'password_reset':
                        result = await this.sendPasswordReset(job.to, job.data.resetToken as string);
                        break;
                    case 'team_invitation':
                        result = await this.sendTeamInvitation(
                            job.to,
                            job.data.teamName as string,
                            job.data.inviterName as string,
                            job.data.inviteLink as string
                        );
                        break;
                    case 'bas_reminder':
                        result = await this.sendBASReminder(job.to, job.data.period as string, job.data.dueDate as string);
                        break;
                    case 'statement_processed':
                        result = await this.sendStatementProcessed(
                            job.to,
                            job.data.statementCount as number,
                            job.data.newTransactions as number
                        );
                        break;
                    case 'weekly_summary':
                        result = await this.sendWeeklySummary(job.to, job.data.summaryData as WeeklySummaryData);
                        break;
                    case 'payment_failed':
                        result = await this.sendPaymentFailed(job.to, job.data.planName as string);
                        break;
                    case 'subscription_confirmation':
                        result = await this.sendSubscriptionConfirmation(
                            job.to,
                            job.data.planName as string,
                            job.data.nextBillingDate as string
                        );
                        break;
                    default:
                        result = { success: false, error: `Unknown template: ${job.template}` };
                }

                if (result.success) {
                    job.status = 'sent';
                    results.sent++;
                } else {
                    job.lastError = result.error;
                    if (job.attempts >= config.retryAttempts) {
                        job.status = 'failed';
                        results.failed++;
                        results.errors.push(`${job.to}: ${result.error}`);
                    }
                }

                // Add delay between sends
                await new Promise(resolve => setTimeout(resolve, config.retryDelayMs));
            }

            // Clean up completed jobs
            this.batchQueue = this.batchQueue.filter(
                job => job.status === 'pending' || (job.status === 'failed' && job.attempts < config.retryAttempts)
            );

        } finally {
            this.isBatchProcessing = false;
        }

        return results;
    }

    /**
     * Get batch queue status
     */
    getBatchStatus(): { pending: number; processing: boolean; failed: number } {
        return {
            pending: this.batchQueue.filter(j => j.status === 'pending').length,
            processing: this.isBatchProcessing,
            failed: this.batchQueue.filter(j => j.status === 'failed').length,
        };
    }

    /**
     * Clear failed jobs from batch queue
     */
    clearFailedJobs(): number {
        const beforeCount = this.batchQueue.length;
        this.batchQueue = this.batchQueue.filter(j => j.status !== 'failed');
        return beforeCount - this.batchQueue.length;
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const emailService = new EmailService();
