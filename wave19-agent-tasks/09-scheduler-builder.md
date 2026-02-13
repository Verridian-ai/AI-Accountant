# Agent 9: Data Refresh Scheduler Builder

## Role
Build a cron-based data refresh scheduler that automatically refreshes market data feeds at appropriate intervals: daily for RBA/ABS, hourly during ASX trading hours for prices, and daily for sentiment analysis.

## Priority: WAVE 19 (After Agents 2, 3, 4)

## Wait Condition
Check for `.agent-done-W19-02`, `.agent-done-W19-03`, `.agent-done-W19-04` marker files before starting.

## Files to CREATE

### 1. `server/src/services/data-refresh-scheduler.ts`
**Purpose**: Cron-based scheduler for automated data refresh
**Pattern**: Self-contained service class with configurable schedules

- [ ] Create `DataRefreshScheduler` class:
  ```typescript
  interface SchedulerConfig {
    enabled: boolean;                  // from env: SCHEDULER_ENABLED, default true
    timezone: string;                  // default: 'Australia/Sydney'
    rbaRefreshCron: string;            // default: '0 6 * * *' (6am daily)
    absRefreshCron: string;            // default: '0 7 * * *' (7am daily)
    asxPriceRefreshCron: string;       // default: '0 * 10-16 * * 1-5' (hourly 10am-4pm Mon-Fri)
    cryptoPriceRefreshCron: string;    // default: '*/30 * * * *' (every 30 minutes)
    sentimentRefreshCron: string;      // default: '0 8 * * *' (8am daily)
    cogneeIndexCron: string;           // default: '0 9 * * *' (9am daily, after all feeds)
    calendarRefreshCron: string;       // default: '0 0 * * 0' (weekly Sunday midnight)
    maxRetries: number;                // default: 3
    retryDelayMs: number;             // default: 60000 (1 minute)
  }

  interface ScheduleEntry {
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
  ```

- [ ] **Cron Engine** (lightweight, no external dependency):
  ```typescript
  private schedules: Map<string, ScheduleEntry>;
  private timers: Map<string, NodeJS.Timeout>;
  private isRunning: boolean;

  // Parse cron expression to next execution time
  private getNextRunTime(cron: string, timezone: string): Date;

  // Schedule a job
  private scheduleJob(name: string, cron: string, handler: () => Promise<void>): void;

  // Cancel a job
  private cancelJob(name: string): void;
  ```
  - Use `setTimeout` + `setInterval` approach (avoid heavy cron library)
  - Calculate next run time from cron expression
  - Support: minute, hour, day-of-month, month, day-of-week fields
  - Timezone-aware scheduling (AEST/AEDT for ASX hours)

- [ ] **Job Definitions**:

  **RBA Data Refresh** (daily 6am AEST):
  ```typescript
  private async refreshRbaData(): Promise<void> {
    console.log('[Scheduler] Refreshing RBA data...');
    const result = await this.rbaDataFeed.fetchAllTables();
    console.log(`[Scheduler] RBA refresh: ${result.indicators.length} indicators updated`);
    // Update market_data_feeds status
  }
  ```

  **ABS Data Refresh** (daily 7am AEST):
  ```typescript
  private async refreshAbsData(): Promise<void> {
    console.log('[Scheduler] Refreshing ABS data...');
    const result = await this.absDataFeed.fetchAllIndicators();
    console.log(`[Scheduler] ABS refresh: ${result.indicators.length} indicators updated`);
  }
  ```

  **ASX Price Refresh** (hourly during trading hours 10am-4pm Mon-Fri AEST):
  ```typescript
  private async refreshAsxPrices(): Promise<void> {
    // Check if ASX is open (Mon-Fri, 10am-4pm AEST, not public holiday)
    if (!this.isAsxTradingHours()) {
      console.log('[Scheduler] ASX closed, skipping price refresh');
      return;
    }
    const result = await this.marketPriceService.refreshPrices();
    console.log(`[Scheduler] ASX refresh: ${result.asxUpdated} prices, ${result.asxApiCallsRemaining} API calls remaining`);
    // Stop refreshing if API limit approached
    if (result.asxApiCallsRemaining < 5) {
      console.warn('[Scheduler] Alpha Vantage API limit approaching, pausing ASX refresh');
    }
  }
  ```

  **Crypto Price Refresh** (every 30 minutes, 24/7):
  ```typescript
  private async refreshCryptoPrices(): Promise<void> {
    const result = await this.marketPriceService.fetchCryptoPrices(DEFAULT_CRYPTO_IDS);
    console.log(`[Scheduler] Crypto refresh: ${result.length} prices updated`);
  }
  ```

  **Sentiment Refresh** (daily 8am AEST):
  ```typescript
  private async refreshSentiment(): Promise<void> {
    const topics = DEFAULT_FINANCIAL_TOPICS;
    console.log(`[Scheduler] Refreshing sentiment for ${topics.length} topics...`);
    const results = await this.sentimentService.getMultiTopicSentiment(topics);
    console.log(`[Scheduler] Sentiment refresh: ${results.length} topics analyzed`);
  }
  ```

  **Cognee Index Refresh** (daily 9am AEST, after all feeds):
  ```typescript
  private async refreshCogneeIndex(): Promise<void> {
    const since = new Date(Date.now() - 86400000).toISOString();  // last 24 hours
    console.log(`[Scheduler] Indexing market data to Cognee since ${since}...`);
    const result = await this.marketCogneeIndexer.incrementalIndex(since);
    console.log(`[Scheduler] Cognee index: ${result.documentsIndexed} documents indexed`);
  }
  ```

  **Economic Calendar Refresh** (weekly Sunday):
  ```typescript
  private async refreshCalendar(): Promise<void> {
    // Populate upcoming economic events for next 4 weeks
    // Known events: RBA decisions (first Tuesday of month except January),
    // CPI releases, employment data, GDP releases
    console.log('[Scheduler] Refreshing economic calendar...');
  }
  ```

- [ ] **Lifecycle Methods**:
  ```typescript
  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[Scheduler] Disabled via SCHEDULER_ENABLED=false');
      return;
    }
    console.log('[Scheduler] Starting data refresh scheduler...');
    this.isRunning = true;

    // Register all jobs
    this.scheduleJob('rba_refresh', this.config.rbaRefreshCron, () => this.refreshRbaData());
    this.scheduleJob('abs_refresh', this.config.absRefreshCron, () => this.refreshAbsData());
    this.scheduleJob('asx_prices', this.config.asxPriceRefreshCron, () => this.refreshAsxPrices());
    this.scheduleJob('crypto_prices', this.config.cryptoPriceRefreshCron, () => this.refreshCryptoPrices());
    this.scheduleJob('sentiment', this.config.sentimentRefreshCron, () => this.refreshSentiment());
    this.scheduleJob('cognee_index', this.config.cogneeIndexCron, () => this.refreshCogneeIndex());
    this.scheduleJob('calendar', this.config.calendarRefreshCron, () => this.refreshCalendar());

    console.log(`[Scheduler] ${this.schedules.size} jobs scheduled`);
    this.logNextRuns();
  }

  async stop(): Promise<void> {
    console.log('[Scheduler] Stopping scheduler...');
    this.isRunning = false;
    for (const [name, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  getStatus(): SchedulerStatus {
    return {
      isRunning: this.isRunning,
      jobs: Array.from(this.schedules.values()),
      uptime: Date.now() - this.startedAt,
    };
  }
  ```

- [ ] **Error Handling & Retry**:
  ```typescript
  private async executeWithRetry(name: string, handler: () => Promise<void>): Promise<void> {
    const entry = this.schedules.get(name)!;
    entry.lastStatus = 'running';

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const start = Date.now();
        await handler();
        entry.lastStatus = 'success';
        entry.lastDurationMs = Date.now() - start;
        entry.lastRun = new Date().toISOString();
        entry.lastError = null;
        entry.runCount++;
        return;
      } catch (err) {
        console.error(`[Scheduler] ${name} attempt ${attempt}/${this.config.maxRetries} failed:`, err);
        if (attempt < this.config.maxRetries) {
          await new Promise(r => setTimeout(r, this.config.retryDelayMs * attempt));
        } else {
          entry.lastStatus = 'failed';
          entry.lastError = String(err);
          entry.failCount++;
          // Emit SSE event: scheduler:job:failed
        }
      }
    }
  }
  ```

- [ ] **ASX Trading Hours Check**:
  ```typescript
  private isAsxTradingHours(): boolean {
    const now = new Date();
    // Convert to AEST/AEDT
    const aest = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
    const day = aest.getDay();
    const hour = aest.getHours();
    // Mon-Fri, 10am-4pm
    return day >= 1 && day <= 5 && hour >= 10 && hour < 16;
  }
  ```

- [ ] **Manual Trigger Support**: each job can be triggered on-demand via API

## Files to MODIFY

### 2. `server/src/index.ts`
- [ ] Import and instantiate scheduler:
  ```typescript
  import { DataRefreshScheduler } from './services/data-refresh-scheduler.js';
  const scheduler = new DataRefreshScheduler({ rbaDataFeed, absDataFeed, marketPriceService, sentimentService, marketCogneeIndexer });
  ```

- [ ] Start scheduler after server starts:
  ```typescript
  // After app.listen()
  scheduler.start().catch(err => console.error('Scheduler start failed:', err));
  ```

- [ ] Add scheduler API endpoints:
  ```typescript
  // Get scheduler status
  app.get('/api/market/scheduler/status', async (c) => {
    return c.json(scheduler.getStatus());
  });

  // Trigger specific job manually
  app.post('/api/market/scheduler/trigger/:jobName', async (c) => {
    const jobName = c.req.param('jobName');
    await scheduler.triggerJob(jobName);
    return c.json({ triggered: jobName });
  });

  // Enable/disable specific job
  app.patch('/api/market/scheduler/:jobName', async (c) => {
    const jobName = c.req.param('jobName');
    const { enabled } = await c.req.json();
    scheduler.setJobEnabled(jobName, enabled);
    return c.json({ jobName, enabled });
  });
  ```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Scheduler starts and registers all 7 jobs on server boot
- [ ] `getStatus()` returns all jobs with next run times
- [ ] Manual trigger via API successfully runs a job
- [ ] RBA refresh correctly fetches and stores data
- [ ] ASX price refresh skips when market is closed
- [ ] Crypto refresh runs 24/7 every 30 minutes
- [ ] Failed job retries 3 times with backoff
- [ ] Scheduler stops cleanly on server shutdown
- [ ] Job scheduling respects AEST timezone
- [ ] `SCHEDULER_ENABLED=false` prevents all jobs from starting
- [ ] Create marker file: `.agent-done-W19-09`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-W19-02`), Agent 3 (`.agent-done-W19-03`), Agent 4 (`.agent-done-W19-04`)
- **Reuses**: All market data services (rba-data-feed, abs-data-feed, market-prices, sentiment-analysis, market-cognee-indexer)
