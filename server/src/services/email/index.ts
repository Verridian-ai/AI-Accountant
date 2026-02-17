export type {
  NotificationType,
  EmailOptions,
  WeeklySummaryData,
  BatchEmailJob,
  EmailConfig,
  BrandConfig,
} from './types.js';

export {
  baseTemplate,
  buttonTemplate,
  statBoxTemplate,
  escapeHtml,
  RateLimiter,
  initTemplateConfig,
} from './templates.js';

export { sendEmail, checkUserPreferences, config, BRAND } from './sender.js';

export {
  sendWelcomeEmail,
  sendPasswordReset,
  sendTeamInvitation,
  sendBASReminder,
} from './sender-methods.js';

export {
  sendStatementProcessed,
  sendWeeklySummary,
  sendPaymentFailed,
  sendSubscriptionConfirmation,
} from './sender-templates.js';

export { EmailService, emailService } from './email-service.js';
