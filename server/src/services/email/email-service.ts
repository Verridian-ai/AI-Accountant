import type {
  BatchEmailJob,
  NotificationType,
  WeeklySummaryData,
} from './types.js';
import { RateLimiter, initTemplateConfig } from './templates.js';
import {
  checkUserPreferences,
  sendWelcomeEmail,
  sendPasswordReset,
  sendTeamInvitation,
  sendBASReminder,
  config,
  BRAND,
} from './sender.js';
import {
  sendStatementProcessed,
  sendWeeklySummary,
  sendPaymentFailed,
  sendSubscriptionConfirmation,
} from './sender-templates.js';

// Initialize template config on module load
initTemplateConfig(config, BRAND);

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
  // USER PREFERENCE CHECK (delegated)
  // -------------------------------------------------------------------------

  async checkUserPreferences(userId: string, notificationType: NotificationType): Promise<boolean> {
    return checkUserPreferences(userId, notificationType);
  }

  // -------------------------------------------------------------------------
  // EMAIL METHODS (delegated)
  // -------------------------------------------------------------------------

  async sendWelcomeEmail(to: string, name: string): Promise<{ success: boolean; error?: string }> {
    return sendWelcomeEmail(to, name, this.rateLimiter);
  }

  async sendPasswordReset(
    to: string,
    resetToken: string,
  ): Promise<{ success: boolean; error?: string }> {
    return sendPasswordReset(to, resetToken, this.rateLimiter);
  }

  async sendTeamInvitation(
    to: string,
    teamName: string,
    inviterName: string,
    inviteLink: string,
  ): Promise<{ success: boolean; error?: string }> {
    return sendTeamInvitation(to, teamName, inviterName, inviteLink, this.rateLimiter);
  }

  async sendBASReminder(
    to: string,
    period: string,
    dueDate: string,
  ): Promise<{ success: boolean; error?: string }> {
    return sendBASReminder(to, period, dueDate, this.rateLimiter);
  }

  async sendStatementProcessed(
    to: string,
    statementCount: number,
    newTransactions: number,
  ): Promise<{ success: boolean; error?: string }> {
    return sendStatementProcessed(to, statementCount, newTransactions, this.rateLimiter);
  }

  async sendWeeklySummary(
    to: string,
    summaryData: WeeklySummaryData,
  ): Promise<{ success: boolean; error?: string }> {
    return sendWeeklySummary(to, summaryData, this.rateLimiter);
  }

  async sendPaymentFailed(
    to: string,
    planName: string,
  ): Promise<{ success: boolean; error?: string }> {
    return sendPaymentFailed(to, planName, this.rateLimiter);
  }

  async sendSubscriptionConfirmation(
    to: string,
    planName: string,
    nextBillingDate: string,
  ): Promise<{ success: boolean; error?: string }> {
    return sendSubscriptionConfirmation(to, planName, nextBillingDate, this.rateLimiter);
  }

  // -------------------------------------------------------------------------
  // BATCH SENDING
  // -------------------------------------------------------------------------

  addToBatch(job: Omit<BatchEmailJob, 'id' | 'status' | 'attempts'>): void {
    this.batchQueue.push({
      ...job,
      id: crypto.randomUUID(),
      status: 'pending',
      attempts: 0,
    });
  }

  async processBatch(): Promise<{ sent: number; failed: number; errors: string[] }> {
    if (this.isBatchProcessing) {
      return { sent: 0, failed: 0, errors: ['Batch processing already in progress'] };
    }

    this.isBatchProcessing = true;
    const results = { sent: 0, failed: 0, errors: [] as string[] };

    try {
      const pendingJobs = this.batchQueue
        .filter((job) => job.status === 'pending' && job.attempts < config.retryAttempts)
        .slice(0, config.maxBatchSize);

      for (const job of pendingJobs) {
        job.attempts++;

        if (job.scheduledFor && job.scheduledFor > new Date()) {
          continue;
        }

        const canSend = await this.checkUserPreferences(
          (job.data.userId as string) || '',
          job.template,
        );

        if (!canSend) {
          job.status = 'failed';
          job.lastError = 'User has opted out of this notification type';
          results.failed++;
          continue;
        }

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
              job.data.inviteLink as string,
            );
            break;
          case 'bas_reminder':
            result = await this.sendBASReminder(
              job.to,
              job.data.period as string,
              job.data.dueDate as string,
            );
            break;
          case 'statement_processed':
            result = await this.sendStatementProcessed(
              job.to,
              job.data.statementCount as number,
              job.data.newTransactions as number,
            );
            break;
          case 'weekly_summary':
            result = await this.sendWeeklySummary(
              job.to,
              job.data.summaryData as WeeklySummaryData,
            );
            break;
          case 'payment_failed':
            result = await this.sendPaymentFailed(job.to, job.data.planName as string);
            break;
          case 'subscription_confirmation':
            result = await this.sendSubscriptionConfirmation(
              job.to,
              job.data.planName as string,
              job.data.nextBillingDate as string,
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

        await new Promise((resolve) => setTimeout(resolve, config.retryDelayMs));
      }

      this.batchQueue = this.batchQueue.filter(
        (job) =>
          job.status === 'pending' ||
          (job.status === 'failed' && job.attempts < config.retryAttempts),
      );
    } finally {
      this.isBatchProcessing = false;
    }

    return results;
  }

  getBatchStatus(): { pending: number; processing: boolean; failed: number } {
    return {
      pending: this.batchQueue.filter((j) => j.status === 'pending').length,
      processing: this.isBatchProcessing,
      failed: this.batchQueue.filter((j) => j.status === 'failed').length,
    };
  }

  clearFailedJobs(): number {
    const beforeCount = this.batchQueue.length;
    this.batchQueue = this.batchQueue.filter((j) => j.status !== 'failed');
    return beforeCount - this.batchQueue.length;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const emailService = new EmailService();
