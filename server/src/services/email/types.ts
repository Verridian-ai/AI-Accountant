/**
 * Email types — defined locally (no back-import from parent monolith).
 */

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

export interface EmailConfig {
  apiKey: string;
  from: string;
  baseUrl: string;
  rateLimitPerSecond: number;
  maxBatchSize: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface BrandConfig {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  cardBackground: string;
  textColor: string;
  mutedColor: string;
  logoUrl: string;
  appName: string;
  supportEmail: string;
}
