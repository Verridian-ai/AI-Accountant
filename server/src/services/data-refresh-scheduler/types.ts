/**
 * Data Refresh Scheduler — Type Definitions
 *
 * Shared types, interfaces, and constants for the scheduler module.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SchedulerConfig {
  enabled: boolean;
  timezone: string;
  rbaRefreshCron: string;
  absRefreshCron: string;
  asxPriceRefreshCron: string;
  cryptoPriceRefreshCron: string;
  sentimentRefreshCron: string;
  cogneeIndexCron: string;
  calendarRefreshCron: string;
  maxRetries: number;
  retryDelayMs: number;
}

export interface ScheduleEntry {
  name: string;
  cron: string;
  handler: () => Promise<void>;
  lastRun: string | null;
  lastStatus: 'success' | 'failed' | 'running' | null;
  lastDurationMs: number | null;
  lastError: string | null;
  nextRun: string;
  isEnabled: boolean;
  runCount: number;
  failCount: number;
}

export interface SchedulerStatus {
  isRunning: boolean;
  jobs: Array<Omit<ScheduleEntry, 'handler'>>;
  uptime: number;
}

interface RefreshResult {
  tablesProcessed?: number;
  dataflowsProcessed?: number;
  asxUpdated?: number;
  asxApiCallsRemaining?: number | string;
  cryptoUpdated?: number;
  totalIndexed?: number;
  errors?: unknown[];
  [key: string]: unknown;
}

export interface SchedulerDeps {
  rbaDataFeed?: { fetchAllTables: () => Promise<RefreshResult> };
  absDataFeed?: { fetchAllIndicators: () => Promise<RefreshResult> };
  marketPriceService?: { refreshPrices: () => Promise<RefreshResult> };
  sentimentService?: {
    researchTopic: (topic: string) => Promise<RefreshResult>;
    analyzeSentiment: (topic: string) => Promise<RefreshResult>;
  };
  marketCogneeIndexer?: { incrementalIndex: (since: string) => Promise<RefreshResult> };
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_CONFIG: SchedulerConfig = {
  enabled: true,
  timezone: 'Australia/Sydney',
  rbaRefreshCron: '0 6 * * *',
  absRefreshCron: '0 7 * * *',
  asxPriceRefreshCron: '0 10-16 * * 1-5',
  cryptoPriceRefreshCron: '*/30 * * * *',
  sentimentRefreshCron: '0 8 * * *',
  cogneeIndexCron: '0 9 * * *',
  calendarRefreshCron: '0 0 * * 0',
  maxRetries: 3,
  retryDelayMs: 60_000,
};

// Interval constants (ms)
export const ONE_MINUTE = 60 * 1000;
export const ONE_HOUR = 60 * ONE_MINUTE;
export const THIRTY_MINUTES = 30 * ONE_MINUTE;
export const TWENTY_FOUR_HOURS = 24 * ONE_HOUR;
export const ONE_WEEK = 7 * TWENTY_FOUR_HOURS;

// Default topics for sentiment analysis
export const DEFAULT_SENTIMENT_TOPICS = [
  'Australian economy',
  'RBA interest rates',
  'Australian housing market',
  'ASX market outlook',
  'Australian dollar',
];

// Known Australian economic calendar events
export const AU_ECONOMIC_EVENTS = [
  {
    name: 'RBA Cash Rate Decision',
    type: 'interest_rate',
    source: 'RBA',
    importance: 'high' as const,
    frequency: 'monthly',
  },
  {
    name: 'ABS CPI Release',
    type: 'inflation',
    source: 'ABS',
    importance: 'high' as const,
    frequency: 'quarterly',
  },
  {
    name: 'ABS Labour Force Report',
    type: 'employment',
    source: 'ABS',
    importance: 'high' as const,
    frequency: 'monthly',
  },
  {
    name: 'ABS GDP Release',
    type: 'gdp',
    source: 'ABS',
    importance: 'high' as const,
    frequency: 'quarterly',
  },
  {
    name: 'ABS Wage Price Index',
    type: 'wages',
    source: 'ABS',
    importance: 'medium' as const,
    frequency: 'quarterly',
  },
  {
    name: 'ABS Building Approvals',
    type: 'housing',
    source: 'ABS',
    importance: 'medium' as const,
    frequency: 'monthly',
  },
  {
    name: 'RBA Financial Stability Review',
    type: 'financial_stability',
    source: 'RBA',
    importance: 'medium' as const,
    frequency: 'biannual',
  },
  {
    name: 'Federal Budget Release',
    type: 'fiscal_policy',
    source: 'Treasury',
    importance: 'high' as const,
    frequency: 'annual',
  },
  {
    name: 'RBA Statement on Monetary Policy',
    type: 'monetary_policy',
    source: 'RBA',
    importance: 'high' as const,
    frequency: 'quarterly',
  },
  {
    name: 'ABS Retail Trade',
    type: 'consumer',
    source: 'ABS',
    importance: 'medium' as const,
    frequency: 'monthly',
  },
];
