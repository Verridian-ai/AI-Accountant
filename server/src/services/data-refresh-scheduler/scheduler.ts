/**
 * Data Refresh Scheduler — Main Scheduler Orchestrator
 *
 * Lightweight cron-style scheduler that automatically refreshes market data
 * feeds at appropriate intervals. Uses setInterval (no external cron library).
 */

import { logger } from '../../lib/logger.js';
import { config as appConfig } from '../../lib/config.js';
import type { SchedulerConfig, ScheduleEntry, SchedulerStatus, SchedulerDeps } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import {
  refreshRbaData,
  refreshAbsData,
  refreshAsxPrices,
  refreshCryptoPrices,
  refreshSentiment,
  refreshCogneeIndex,
  refreshCalendar,
} from './refresh-jobs.js';
import {
  scheduleRbaData,
  scheduleAbsData,
  scheduleAsxPrices,
  scheduleCryptoPrices,
  scheduleSentiment,
  scheduleCogneeIndex,
  scheduleCalendar,
} from './schedule-methods.js';

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
    const envEnabled = appConfig.schedulerEnabled;
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
      logger.info('[Scheduler] Disabled via config or SCHEDULER_ENABLED=false');
      return;
    }

    if (this.running) {
      logger.info('[Scheduler] Already running');
      return;
    }

    logger.info('[Scheduler] Starting data refresh scheduler...');
    this.running = true;
    this.startedAt = Date.now();

    this.registerJob('rba_data', this.config.rbaRefreshCron, () => refreshRbaData(this.deps));
    this.registerJob('abs_data', this.config.absRefreshCron, () => refreshAbsData(this.deps));
    this.registerJob('asx_prices', this.config.asxPriceRefreshCron, () =>
      refreshAsxPrices(this.deps),
    );
    this.registerJob('crypto_prices', this.config.cryptoPriceRefreshCron, () =>
      refreshCryptoPrices(this.deps),
    );
    this.registerJob('sentiment', this.config.sentimentRefreshCron, () =>
      refreshSentiment(this.deps),
    );
    this.registerJob('cognee_index', this.config.cogneeIndexCron, () =>
      refreshCogneeIndex(this.deps),
    );
    this.registerJob('calendar', this.config.calendarRefreshCron, () => refreshCalendar());

    // Schedule timers for each job
    const ctx = {
      timers: this.timers,
      updateNextRun: (name: string, delayMs: number) => this.updateNextRun(name, delayMs),
      runJobIfEnabled: (name: string) => this.runJobIfEnabled(name),
    };
    scheduleRbaData(ctx);
    scheduleAbsData(ctx);
    scheduleAsxPrices(ctx);
    scheduleCryptoPrices(ctx);
    scheduleSentiment(ctx);
    scheduleCogneeIndex(ctx);
    scheduleCalendar(ctx);

    const jobNames = Array.from(this.jobs.keys()).join(', ');
    logger.info(`[Scheduler] Registered ${this.jobs.size} jobs: ${jobNames}`);
  }

  /**
   * Stop the scheduler — clear all timers.
   */
  stop(): void {
    logger.info('[Scheduler] Stopping...');
    for (const [name, timer] of this.timers) {
      clearTimeout(timer as ReturnType<typeof setTimeout>);
      clearInterval(timer as ReturnType<typeof setInterval>);
      logger.info(`[Scheduler] Cleared timer for ${name}`);
    }
    this.timers.clear();
    this.running = false;
    logger.info('[Scheduler] Stopped');
  }

  // --------------------------------------------------------------------------
  // Status & Control
  // --------------------------------------------------------------------------

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

  async triggerJob(name: string): Promise<{ success: boolean; error?: string }> {
    const job = this.jobs.get(name);
    if (!job) {
      return {
        success: false,
        error: `Job '${name}' not found. Available: ${Array.from(this.jobs.keys()).join(', ')}`,
      };
    }

    logger.info(`[Scheduler] Manual trigger: ${name}`);
    try {
      await this.executeWithRetry(name, job.handler);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  setJobEnabled(name: string, enabled: boolean): boolean {
    const job = this.jobs.get(name);
    if (!job) return false;

    job.isEnabled = enabled;
    logger.info(`[Scheduler] Job '${name}' ${enabled ? 'enabled' : 'disabled'}`);

    if (!enabled) {
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

  // -- Job Execution --

  private async runJobIfEnabled(name: string): Promise<void> {
    const job = this.jobs.get(name);
    if (!job || !job.isEnabled) {
      logger.info(`[Scheduler] Skipping disabled job: ${name}`);
      return;
    }

    try {
      await this.executeWithRetry(name, job.handler);
    } catch {
      // Error already logged in executeWithRetry
    }
  }

  private async executeWithRetry(name: string, handler: () => Promise<void>): Promise<void> {
    const job = this.jobs.get(name);
    if (!job) return;

    job.lastStatus = 'running';
    job.lastRun = new Date().toISOString();
    const start = Date.now();

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        logger.info(`[Scheduler] Running ${name} (attempt ${attempt}/${this.config.maxRetries})`);
        await handler();

        job.lastStatus = 'success';
        job.lastDurationMs = Date.now() - start;
        job.lastError = null;
        job.runCount++;
        logger.info(`[Scheduler] ${name} completed in ${job.lastDurationMs}ms`);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[Scheduler] ${name} attempt ${attempt} failed: ${msg}`);

        if (attempt < this.config.maxRetries) {
          const backoffMs = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          logger.info(`[Scheduler] Retrying ${name} in ${Math.round(backoffMs / 1000)}s`);
          await this.sleep(backoffMs);
        } else {
          job.lastStatus = 'failed';
          job.lastDurationMs = Date.now() - start;
          job.lastError = msg;
          job.failCount++;
          logger.error(
            `[Scheduler] ${name} failed after ${this.config.maxRetries} attempts: ${msg}`,
          );
          throw err;
        }
      }
    }
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
