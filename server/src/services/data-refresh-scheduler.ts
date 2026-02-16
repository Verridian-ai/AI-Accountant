/**
 * Data Refresh Scheduler (Wave 19 — Agent 09)
 *
 * Lightweight cron-style scheduler that automatically refreshes market data
 * feeds at appropriate intervals. Uses setInterval (no external cron library).
 *
 * Jobs:
 *   1. RBA Data        — daily 6am AEST
 *   2. ABS Data        — daily 7am AEST
 *   3. ASX Prices      — hourly 10am-4pm Mon-Fri AEST
 *   4. Crypto Prices   — every 30 min, 24/7
 *   5. Sentiment       — daily 8am AEST
 *   6. Cognee Index    — daily 9am AEST
 *   7. Calendar        — weekly Sunday midnight AEST
 *
 * Disable via SCHEDULER_ENABLED=false.
 */

import crypto from 'crypto';
import { db, economicCalendar } from '../schema.js';

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

export interface SchedulerDeps {
  rbaDataFeed?: any;
  absDataFeed?: any;
  marketPriceService?: any;
  sentimentService?: any;
  marketCogneeIndexer?: any;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: SchedulerConfig = {
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
const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;
const THIRTY_MINUTES = 30 * ONE_MINUTE;
const TWENTY_FOUR_HOURS = 24 * ONE_HOUR;
const ONE_WEEK = 7 * TWENTY_FOUR_HOURS;

// Default topics for sentiment analysis
const DEFAULT_SENTIMENT_TOPICS = [
  'Australian economy',
  'RBA interest rates',
  'Australian housing market',
  'ASX market outlook',
  'Australian dollar',
];

// Known Australian economic calendar events
const AU_ECONOMIC_EVENTS = [
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

// ============================================================================
// HELPER: AEST time checks
// ============================================================================

/**
 * Get the current hour in Australia/Sydney timezone.
 */
function getAestHour(): number {
  const now = new Date();
  // Get AEST offset: +10 or +11 (daylight saving)
  const utcHour = now.getUTCHours();
  const utcMonth = now.getUTCMonth(); // 0-indexed
  // AEST = UTC+10, AEDT = UTC+11 (Oct first Sunday to Apr first Sunday)
  // Simplified: Oct-Mar = AEDT (+11), Apr-Sep = AEST (+10)
  const isDST = utcMonth >= 9 || utcMonth <= 2; // Oct(9) through Mar(2)
  const offset = isDST ? 11 : 10;
  return (utcHour + offset) % 24;
}

/**
 * Get the current day-of-week in AEST (0 = Sunday, 6 = Saturday).
 */
function getAestDayOfWeek(): number {
  const now = new Date();
  const utcMonth = now.getUTCMonth();
  const isDST = utcMonth >= 9 || utcMonth <= 2;
  const offset = isDST ? 11 : 10;
  const aestTime = new Date(now.getTime() + offset * ONE_HOUR);
  return aestTime.getUTCDay();
}

/**
 * Check if we're within ASX trading hours: Mon-Fri, 10am-4pm AEST.
 */
function isAsxTradingHours(): boolean {
  const day = getAestDayOfWeek();
  const hour = getAestHour();
  const isWeekday = day >= 1 && day <= 5;
  const isInHours = hour >= 10 && hour < 16;
  return isWeekday && isInHours;
}

/**
 * Calculate milliseconds until a target AEST hour on the next occurrence.
 * Used for scheduling daily jobs to start at the right time.
 */
function msUntilAestHour(targetHour: number): number {
  const now = new Date();
  const utcMonth = now.getUTCMonth();
  const isDST = utcMonth >= 9 || utcMonth <= 2;
  const offset = isDST ? 11 : 10;

  // Current AEST time
  const aestMs = now.getTime() + offset * ONE_HOUR;
  const aestDate = new Date(aestMs);
  const currentHour = aestDate.getUTCHours();
  const currentMin = aestDate.getUTCMinutes();
  const currentSec = aestDate.getUTCSeconds();

  // Hours until target
  let hoursUntil = targetHour - currentHour;
  if (hoursUntil < 0 || (hoursUntil === 0 && (currentMin > 0 || currentSec > 0))) {
    hoursUntil += 24;
  }

  const msUntil = hoursUntil * ONE_HOUR - currentMin * ONE_MINUTE - currentSec * 1000;

  return Math.max(msUntil, 1000); // At least 1 second
}

/**
 * Calculate ms until next Sunday midnight AEST.
 */
function msUntilSundayMidnightAest(): number {
  const day = getAestDayOfWeek();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  return (
    daysUntilSunday * TWENTY_FOUR_HOURS +
    msUntilAestHour(0) -
    TWENTY_FOUR_HOURS * (day === 0 ? 0 : 0)
  );
}

// ============================================================================
// SCHEDULER CLASS
// ============================================================================

export class DataRefreshScheduler {
  private config: SchedulerConfig;
  private deps: SchedulerDeps;
  private jobs: Map<string, ScheduleEntry> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>> =
    new Map();
  private running = false;
  private startedAt: number | null = null;

  constructor(deps: SchedulerDeps = {}, config?: Partial<SchedulerConfig>) {
    this.deps = deps;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Override enabled from env
    const envEnabled = process.env.SCHEDULER_ENABLED;
    if (envEnabled !== undefined) {
      this.config.enabled = envEnabled !== 'false';
    }
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /**
   * Start the scheduler — registers all 7 jobs with setTimeout/setInterval.
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('[Scheduler] Disabled via config or SCHEDULER_ENABLED=false');
      return;
    }

    if (this.running) {
      console.log('[Scheduler] Already running');
      return;
    }

    console.log('[Scheduler] Starting data refresh scheduler...');
    this.running = true;
    this.startedAt = Date.now();

    this.registerJob('rba_data', this.config.rbaRefreshCron, () => this.refreshRbaData());
    this.registerJob('abs_data', this.config.absRefreshCron, () => this.refreshAbsData());
    this.registerJob('asx_prices', this.config.asxPriceRefreshCron, () => this.refreshAsxPrices());
    this.registerJob('crypto_prices', this.config.cryptoPriceRefreshCron, () =>
      this.refreshCryptoPrices(),
    );
    this.registerJob('sentiment', this.config.sentimentRefreshCron, () => this.refreshSentiment());
    this.registerJob('cognee_index', this.config.cogneeIndexCron, () => this.refreshCogneeIndex());
    this.registerJob('calendar', this.config.calendarRefreshCron, () => this.refreshCalendar());

    // Schedule timers for each job
    this.scheduleRbaData();
    this.scheduleAbsData();
    this.scheduleAsxPrices();
    this.scheduleCryptoPrices();
    this.scheduleSentiment();
    this.scheduleCogneeIndex();
    this.scheduleCalendar();

    const jobNames = Array.from(this.jobs.keys()).join(', ');
    console.log(`[Scheduler] Registered ${this.jobs.size} jobs: ${jobNames}`);
  }

  /**
   * Stop the scheduler — clear all timers.
   */
  stop(): void {
    console.log('[Scheduler] Stopping...');
    for (const [name, timer] of this.timers) {
      clearTimeout(timer as ReturnType<typeof setTimeout>);
      clearInterval(timer as ReturnType<typeof setInterval>);
      console.log(`[Scheduler] Cleared timer for ${name}`);
    }
    this.timers.clear();
    this.running = false;
    console.log('[Scheduler] Stopped');
  }

  // --------------------------------------------------------------------------
  // Status & Control
  // --------------------------------------------------------------------------

  /**
   * Get the current status of all jobs.
   */
  getStatus(): SchedulerStatus {
    const jobs: Array<Omit<ScheduleEntry, 'handler'>> = [];
    for (const entry of this.jobs.values()) {
      const { handler: _handler, ...rest } = entry;
      jobs.push(rest);
    }

    return {
      isRunning: this.running,
      jobs,
      uptime: this.startedAt ? Date.now() - this.startedAt : 0,
    };
  }

  /**
   * Manually trigger a specific job by name.
   */
  async triggerJob(name: string): Promise<{ success: boolean; error?: string }> {
    const job = this.jobs.get(name);
    if (!job) {
      return {
        success: false,
        error: `Job '${name}' not found. Available: ${Array.from(this.jobs.keys()).join(', ')}`,
      };
    }

    console.log(`[Scheduler] Manual trigger: ${name}`);
    try {
      await this.executeWithRetry(name, job.handler);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Enable or disable a specific job.
   */
  setJobEnabled(name: string, enabled: boolean): boolean {
    const job = this.jobs.get(name);
    if (!job) return false;

    job.isEnabled = enabled;
    console.log(`[Scheduler] Job '${name}' ${enabled ? 'enabled' : 'disabled'}`);

    if (!enabled) {
      // Clear its timer
      const timer = this.timers.get(name);
      if (timer) {
        clearTimeout(timer as ReturnType<typeof setTimeout>);
        clearInterval(timer as ReturnType<typeof setInterval>);
        this.timers.delete(name);
      }
    }

    return true;
  }

  // --------------------------------------------------------------------------
  // Job Registration
  // --------------------------------------------------------------------------

  private registerJob(name: string, cron: string, handler: () => Promise<void>): void {
    this.jobs.set(name, {
      name,
      cron,
      handler,
      lastRun: null,
      lastStatus: null,
      lastDurationMs: null,
      lastError: null,
      nextRun: new Date(Date.now() + 60_000).toISOString(), // placeholder
      isEnabled: true,
      runCount: 0,
      failCount: 0,
    });
  }

  // --------------------------------------------------------------------------
  // Scheduling Methods
  // --------------------------------------------------------------------------

  /**
   * RBA Data: daily at 6am AEST. First run after initial delay, then every 24h.
   */
  private scheduleRbaData(): void {
    const name = 'rba_data';
    const delayMs = msUntilAestHour(6);
    this.updateNextRun(name, delayMs);

    const initialTimer = setTimeout(() => {
      void this.runJobIfEnabled(name);
      // Then schedule every 24 hours
      const interval = setInterval(() => {
        void this.runJobIfEnabled(name);
        this.updateNextRun(name, TWENTY_FOUR_HOURS);
      }, TWENTY_FOUR_HOURS);
      this.timers.set(name, interval);
    }, delayMs);
    this.timers.set(name, initialTimer);

    console.log(`[Scheduler] rba_data: first run in ${Math.round(delayMs / ONE_MINUTE)} min`);
  }

  /**
   * ABS Data: daily at 7am AEST.
   */
  private scheduleAbsData(): void {
    const name = 'abs_data';
    const delayMs = msUntilAestHour(7);
    this.updateNextRun(name, delayMs);

    const initialTimer = setTimeout(() => {
      void this.runJobIfEnabled(name);
      const interval = setInterval(() => {
        void this.runJobIfEnabled(name);
        this.updateNextRun(name, TWENTY_FOUR_HOURS);
      }, TWENTY_FOUR_HOURS);
      this.timers.set(name, interval);
    }, delayMs);
    this.timers.set(name, initialTimer);

    console.log(`[Scheduler] abs_data: first run in ${Math.round(delayMs / ONE_MINUTE)} min`);
  }

  /**
   * ASX Prices: hourly, but only during trading hours (Mon-Fri 10am-4pm AEST).
   * Runs every hour; the handler checks if it's within trading hours.
   */
  private scheduleAsxPrices(): void {
    const name = 'asx_prices';
    this.updateNextRun(name, ONE_HOUR);

    const interval = setInterval(() => {
      void this.runJobIfEnabled(name);
      this.updateNextRun(name, ONE_HOUR);
    }, ONE_HOUR);
    this.timers.set(name, interval);

    console.log(`[Scheduler] asx_prices: every 1 hour (trading hours only)`);
  }

  /**
   * Crypto Prices: every 30 minutes, 24/7.
   */
  private scheduleCryptoPrices(): void {
    const name = 'crypto_prices';
    this.updateNextRun(name, THIRTY_MINUTES);

    const interval = setInterval(() => {
      void this.runJobIfEnabled(name);
      this.updateNextRun(name, THIRTY_MINUTES);
    }, THIRTY_MINUTES);
    this.timers.set(name, interval);

    console.log(`[Scheduler] crypto_prices: every 30 min`);
  }

  /**
   * Sentiment: daily at 8am AEST.
   */
  private scheduleSentiment(): void {
    const name = 'sentiment';
    const delayMs = msUntilAestHour(8);
    this.updateNextRun(name, delayMs);

    const initialTimer = setTimeout(() => {
      void this.runJobIfEnabled(name);
      const interval = setInterval(() => {
        void this.runJobIfEnabled(name);
        this.updateNextRun(name, TWENTY_FOUR_HOURS);
      }, TWENTY_FOUR_HOURS);
      this.timers.set(name, interval);
    }, delayMs);
    this.timers.set(name, initialTimer);

    console.log(`[Scheduler] sentiment: first run in ${Math.round(delayMs / ONE_MINUTE)} min`);
  }

  /**
   * Cognee Index: daily at 9am AEST.
   */
  private scheduleCogneeIndex(): void {
    const name = 'cognee_index';
    const delayMs = msUntilAestHour(9);
    this.updateNextRun(name, delayMs);

    const initialTimer = setTimeout(() => {
      void this.runJobIfEnabled(name);
      const interval = setInterval(() => {
        void this.runJobIfEnabled(name);
        this.updateNextRun(name, TWENTY_FOUR_HOURS);
      }, TWENTY_FOUR_HOURS);
      this.timers.set(name, interval);
    }, delayMs);
    this.timers.set(name, initialTimer);

    console.log(`[Scheduler] cognee_index: first run in ${Math.round(delayMs / ONE_MINUTE)} min`);
  }

  /**
   * Calendar: weekly on Sunday midnight AEST.
   */
  private scheduleCalendar(): void {
    const name = 'calendar';
    const delayMs = msUntilSundayMidnightAest();
    this.updateNextRun(name, delayMs);

    const initialTimer = setTimeout(() => {
      void this.runJobIfEnabled(name);
      const interval = setInterval(() => {
        void this.runJobIfEnabled(name);
        this.updateNextRun(name, ONE_WEEK);
      }, ONE_WEEK);
      this.timers.set(name, interval);
    }, delayMs);
    this.timers.set(name, initialTimer);

    console.log(`[Scheduler] calendar: first run in ${Math.round(delayMs / ONE_HOUR)} hours`);
  }

  // --------------------------------------------------------------------------
  // Job Execution
  // --------------------------------------------------------------------------

  private async runJobIfEnabled(name: string): Promise<void> {
    const job = this.jobs.get(name);
    if (!job || !job.isEnabled) {
      console.log(`[Scheduler] Skipping disabled job: ${name}`);
      return;
    }

    try {
      await this.executeWithRetry(name, job.handler);
    } catch {
      // Error already logged in executeWithRetry
    }
  }

  /**
   * Execute a handler with retry logic (exponential backoff).
   */
  private async executeWithRetry(name: string, handler: () => Promise<void>): Promise<void> {
    const job = this.jobs.get(name);
    if (!job) return;

    job.lastStatus = 'running';
    job.lastRun = new Date().toISOString();
    const start = Date.now();

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`[Scheduler] Running ${name} (attempt ${attempt}/${this.config.maxRetries})`);
        await handler();

        // Success
        job.lastStatus = 'success';
        job.lastDurationMs = Date.now() - start;
        job.lastError = null;
        job.runCount++;
        console.log(`[Scheduler] ${name} completed in ${job.lastDurationMs}ms`);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Scheduler] ${name} attempt ${attempt} failed: ${msg}`);

        if (attempt < this.config.maxRetries) {
          const backoffMs = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          console.log(`[Scheduler] Retrying ${name} in ${Math.round(backoffMs / 1000)}s`);
          await this.sleep(backoffMs);
        } else {
          // Final failure
          job.lastStatus = 'failed';
          job.lastDurationMs = Date.now() - start;
          job.lastError = msg;
          job.failCount++;
          console.error(
            `[Scheduler] ${name} failed after ${this.config.maxRetries} attempts: ${msg}`,
          );
          throw err;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Job Handlers
  // --------------------------------------------------------------------------

  /**
   * Job 1: Refresh RBA data feed.
   */
  private async refreshRbaData(): Promise<void> {
    if (!this.deps.rbaDataFeed) {
      console.warn('[Scheduler] rbaDataFeed not available — skipping');
      return;
    }

    console.log('[Scheduler] Refreshing RBA data...');
    const result = await this.deps.rbaDataFeed.fetchAllTables();
    console.log(
      `[Scheduler] RBA refresh done: ${result.tablesProcessed ?? 0} tables processed, ${result.errors?.length ?? 0} errors`,
    );
  }

  /**
   * Job 2: Refresh ABS data feed.
   */
  private async refreshAbsData(): Promise<void> {
    if (!this.deps.absDataFeed) {
      console.warn('[Scheduler] absDataFeed not available — skipping');
      return;
    }

    console.log('[Scheduler] Refreshing ABS data...');
    const result = await this.deps.absDataFeed.fetchAllIndicators();
    console.log(
      `[Scheduler] ABS refresh done: ${result.dataflowsProcessed ?? 0} dataflows processed, ${result.errors?.length ?? 0} errors`,
    );
  }

  /**
   * Job 3: Refresh ASX prices (only during trading hours).
   */
  private async refreshAsxPrices(): Promise<void> {
    if (!this.deps.marketPriceService) {
      console.warn('[Scheduler] marketPriceService not available — skipping');
      return;
    }

    if (!isAsxTradingHours()) {
      console.log(
        '[Scheduler] Outside ASX trading hours (Mon-Fri 10am-4pm AEST) — skipping ASX refresh',
      );
      return;
    }

    console.log('[Scheduler] Refreshing ASX prices...');
    const result = await this.deps.marketPriceService.refreshPrices();
    console.log(
      `[Scheduler] ASX refresh done: ${result.asxUpdated ?? 0} ASX updated, API calls remaining: ${result.asxApiCallsRemaining ?? '?'}`,
    );
  }

  /**
   * Job 4: Refresh crypto prices.
   */
  private async refreshCryptoPrices(): Promise<void> {
    if (!this.deps.marketPriceService) {
      console.warn('[Scheduler] marketPriceService not available — skipping');
      return;
    }

    console.log('[Scheduler] Refreshing crypto prices...');
    const result = await this.deps.marketPriceService.refreshPrices();
    console.log(`[Scheduler] Crypto refresh done: ${result.cryptoUpdated ?? 0} crypto updated`);
  }

  /**
   * Job 5: Refresh sentiment analysis for default topics.
   */
  private async refreshSentiment(): Promise<void> {
    if (!this.deps.sentimentService) {
      console.warn('[Scheduler] sentimentService not available — skipping');
      return;
    }

    console.log(
      `[Scheduler] Refreshing sentiment for ${DEFAULT_SENTIMENT_TOPICS.length} topics...`,
    );
    let successCount = 0;
    let errorCount = 0;

    for (const topic of DEFAULT_SENTIMENT_TOPICS) {
      try {
        await this.deps.sentimentService.researchTopic(topic);
        await this.deps.sentimentService.analyzeSentiment(topic);
        successCount++;
      } catch (err) {
        errorCount++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Scheduler] Sentiment error for '${topic}': ${msg}`);
      }
      // Small delay between topics to avoid rate limits
      await this.sleep(2000);
    }

    console.log(
      `[Scheduler] Sentiment refresh done: ${successCount} succeeded, ${errorCount} failed`,
    );
  }

  /**
   * Job 6: Incremental Cognee index of new market data.
   */
  private async refreshCogneeIndex(): Promise<void> {
    if (!this.deps.marketCogneeIndexer) {
      console.warn('[Scheduler] marketCogneeIndexer not available — skipping');
      return;
    }

    // Index data added since 24h ago
    const since = new Date(Date.now() - TWENTY_FOUR_HOURS).toISOString();
    console.log(`[Scheduler] Running incremental Cognee index since ${since}...`);
    const result = await this.deps.marketCogneeIndexer.incrementalIndex(since);
    console.log(
      `[Scheduler] Cognee index done: ${result.totalIndexed ?? 0} indexed, ${result.errors?.length ?? 0} errors`,
    );
  }

  /**
   * Job 7: Populate upcoming economic calendar events.
   */
  private async refreshCalendar(): Promise<void> {
    console.log('[Scheduler] Populating economic calendar events...');

    const now = new Date();
    let eventsCreated = 0;

    for (const event of AU_ECONOMIC_EVENTS) {
      try {
        const scheduledDates = this.getUpcomingDates(event.frequency, now, 3);

        for (const date of scheduledDates) {
          const dateStr = date.toISOString().split('T')[0] ?? date.toISOString();
          const id = crypto.randomUUID();

          try {
            await (db as any)
              .insert(economicCalendar)
              .values({
                id,
                eventName: event.name,
                eventType: event.type,
                source: event.source,
                scheduledDate: dateStr,
                country: 'AU',
                importance: event.importance,
                isCompleted: false,
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
              })
              .onConflictDoNothing();
            eventsCreated++;
          } catch {
            // Likely duplicate — ignore
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Scheduler] Calendar error for '${event.name}': ${msg}`);
      }
    }

    console.log(`[Scheduler] Calendar refresh done: ${eventsCreated} events created/updated`);
  }

  // --------------------------------------------------------------------------
  // Calendar Helpers
  // --------------------------------------------------------------------------

  /**
   * Generate upcoming dates for an event based on its frequency.
   * Returns the next `count` occurrences after `from`.
   */
  private getUpcomingDates(frequency: string, from: Date, count: number): Date[] {
    const dates: Date[] = [];
    const current = new Date(from);

    for (let i = 0; i < count; i++) {
      switch (frequency) {
        case 'monthly': {
          const next = new Date(current);
          next.setMonth(next.getMonth() + 1 + i);
          next.setDate(15); // Approximate mid-month
          dates.push(next);
          break;
        }
        case 'quarterly': {
          const next = new Date(current);
          next.setMonth(next.getMonth() + 3 * (i + 1));
          next.setDate(15);
          dates.push(next);
          break;
        }
        case 'biannual': {
          const next = new Date(current);
          next.setMonth(next.getMonth() + 6 * (i + 1));
          next.setDate(15);
          dates.push(next);
          break;
        }
        case 'annual': {
          const next = new Date(current);
          next.setFullYear(next.getFullYear() + 1 + i);
          next.setMonth(4); // May (budget month typically)
          next.setDate(15);
          dates.push(next);
          break;
        }
        default: {
          // Fallback: monthly
          const next = new Date(current);
          next.setMonth(next.getMonth() + 1 + i);
          dates.push(next);
        }
      }
    }

    return dates;
  }

  // --------------------------------------------------------------------------
  // Utility
  // --------------------------------------------------------------------------

  private updateNextRun(name: string, delayMs: number): void {
    const job = this.jobs.get(name);
    if (job) {
      job.nextRun = new Date(Date.now() + delayMs).toISOString();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const dataRefreshScheduler = new DataRefreshScheduler();
