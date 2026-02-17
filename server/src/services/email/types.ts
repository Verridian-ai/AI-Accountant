/**
 * Email types — re-exported from parent monolith ../email.ts + local additions.
 */
export type { NotificationType, EmailOptions, WeeklySummaryData, BatchEmailJob } from '../email.js';

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
