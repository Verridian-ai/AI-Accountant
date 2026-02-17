/**
 * Email Sender — Weekly Summary Template
 */

import type { WeeklySummaryData } from './types.js';
import { baseTemplate, buttonTemplate, statBoxTemplate, RateLimiter } from './templates.js';
import { sendEmail, BRAND, config } from './sender.js';

export async function sendWeeklySummary(
  to: string,
  summaryData: WeeklySummaryData,
  rateLimiter: RateLimiter,
): Promise<{ success: boolean; error?: string }> {
  const formatCurrency = (cents: number): string => {
    const dollars = Math.abs(cents) / 100;
    const formatted = dollars.toLocaleString('en-AU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return cents < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  const cashFlowColor = summaryData.netCashFlow >= 0 ? '#28A745' : '#DC3545';

  const categoriesHtml = summaryData.topCategories
    .slice(0, 5)
    .map(
      (cat) => `
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #EEEEEE; color: ${BRAND.textColor};">
                        ${cat.name}
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #EEEEEE; text-align: right; color: ${BRAND.textColor}; font-weight: 600;">
                        ${formatCurrency(cat.amount)}
                    </td>
                </tr>
            `,
    )
    .join('');

  const accountsHtml = summaryData.accountBalances
    .map(
      (acc) => `
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #EEEEEE; color: ${BRAND.textColor};">
                        ${acc.name}
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #EEEEEE; text-align: right; color: ${BRAND.textColor}; font-weight: 600;">
                        ${formatCurrency(acc.balance)}
                    </td>
                </tr>
            `,
    )
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

            ${
              summaryData.upcomingBAS
                ? `
            <!-- BAS Alert -->
            <div style="margin-bottom: 25px; padding: 15px; background-color: #FFF3CD; border-radius: 6px; border-left: 4px solid ${BRAND.primaryColor};">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                    <strong>Upcoming BAS:</strong> ${summaryData.upcomingBAS.period} is due on ${summaryData.upcomingBAS.dueDate}
                </p>
            </div>
            `
                : ''
            }

            ${
              summaryData.alertCount > 0
                ? `
            <!-- Alerts Notice -->
            <div style="margin-bottom: 25px; padding: 15px; background-color: #F8D7DA; border-radius: 6px; border-left: 4px solid #DC3545;">
                <p style="margin: 0; color: #721C24; font-size: 14px;">
                    <strong>Attention:</strong> You have ${summaryData.alertCount} reconciliation alert${summaryData.alertCount > 1 ? 's' : ''} requiring review.
                </p>
            </div>
            `
                : ''
            }

            ${buttonTemplate('View Full Report', `${config.baseUrl}/reports`)}

            <p style="margin: 20px 0 0; color: ${BRAND.mutedColor}; font-size: 14px; text-align: center;">
                ${summaryData.transactionCount} transactions processed this week
            </p>
        `;

  return sendEmail(
    {
      to,
      subject: `Weekly Summary: ${formatCurrency(summaryData.netCashFlow)} net cash flow`,
      html: baseTemplate(
        content,
        `Your weekly financial summary is ready. Net cash flow: ${formatCurrency(summaryData.netCashFlow)}`,
      ),
      tags: [{ name: 'type', value: 'weekly_summary' }],
    },
    rateLimiter,
  );
}
