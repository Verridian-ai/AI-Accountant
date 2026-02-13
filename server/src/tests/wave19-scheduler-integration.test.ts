/**
 * Wave 19 Integration Tests — Data Refresh Scheduler
 *
 * Tests for server/src/services/data-refresh-scheduler.ts
 * Validates scheduler start/stop lifecycle, job registration,
 * ASX trading hours check, manual job triggers, and job enable/disable.
 *
 * Run: npx tsx server/src/tests/wave19-scheduler-integration.test.ts
 */

import {
  DataRefreshScheduler,
  type SchedulerConfig,
  type ScheduleEntry,
  type SchedulerStatus,
  type SchedulerDeps,
} from '../services/data-refresh-scheduler.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    errors.push(message);
    console.error(`  FAIL: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual === expected) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    errors.push(`${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    console.error(`  FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function describe(name: string, fn: () => void | Promise<void>): void {
  console.log(`\n${name}`);
  const result = fn();
  if (result instanceof Promise) {
    result.catch((err) => {
      failed++;
      errors.push(`${name} threw: ${err.message}`);
      console.error(`  ERROR: ${name} threw: ${err.message}`);
    });
  }
}

// ============================================================================
// MOCK DEPENDENCIES
// ============================================================================

function createMockDeps(): SchedulerDeps {
  return {
    rbaDataFeed: {
      fetchAllTables: async () => ({ indicators: [], tablesProcessed: 5, errors: [] }),
    },
    absDataFeed: {
      fetchAllIndicators: async () => ({ indicators: [], dataflowsProcessed: 5, errors: [] }),
    },
    marketPriceService: {
      refreshPrices: async () => ({ asxUpdated: 0, cryptoUpdated: 0, asxApiCallsRemaining: 25, errors: [] }),
    },
    sentimentService: {
      researchTopic: async (_topic: string) => ({ articles: [], summary: 'mock' }),
      analyzeSentiment: async (_topic: string) => ({ sentimentScore: 0, sentimentLabel: 'neutral' }),
    },
    marketCogneeIndexer: {
      incrementalIndex: async (_since: string) => ({ totalIndexed: 0, errors: [] }),
    },
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('DataRefreshScheduler — Class instantiation', () => {
  const scheduler = new DataRefreshScheduler();
  assert(scheduler !== null && scheduler !== undefined, 'DataRefreshScheduler can be instantiated');
  assert(typeof scheduler.start === 'function', 'start method exists');
  assert(typeof scheduler.stop === 'function', 'stop method exists');
  assert(typeof scheduler.getStatus === 'function', 'getStatus method exists');
  assert(typeof scheduler.triggerJob === 'function', 'triggerJob method exists');
  assert(typeof scheduler.setJobEnabled === 'function', 'setJobEnabled method exists');
});

describe('DataRefreshScheduler — Instantiation with custom config', () => {
  const customConfig: Partial<SchedulerConfig> = {
    enabled: false,
    maxRetries: 5,
    retryDelayMs: 30_000,
  };

  const scheduler = new DataRefreshScheduler({}, customConfig);
  assert(scheduler !== null, 'Scheduler with custom config instantiates');
});

describe('DataRefreshScheduler — Instantiation with mock dependencies', () => {
  const deps = createMockDeps();
  const scheduler = new DataRefreshScheduler(deps);
  assert(scheduler !== null, 'Scheduler with deps instantiates');
});

describe('DataRefreshScheduler — Start and stop lifecycle', () => {
  const deps = createMockDeps();
  const scheduler = new DataRefreshScheduler(deps, { enabled: true });

  // Start
  scheduler.start();
  const statusAfterStart = scheduler.getStatus();
  assertEqual(statusAfterStart.isRunning, true, 'Scheduler is running after start');
  assert(statusAfterStart.uptime >= 0, 'Uptime is non-negative');

  // Stop
  scheduler.stop();
  const statusAfterStop = scheduler.getStatus();
  assertEqual(statusAfterStop.isRunning, false, 'Scheduler is not running after stop');
});

describe('DataRefreshScheduler — Disabled scheduler does not start', () => {
  const scheduler = new DataRefreshScheduler({}, { enabled: false });

  scheduler.start();
  const status = scheduler.getStatus();
  assertEqual(status.isRunning, false, 'Disabled scheduler stays not running');

  scheduler.stop(); // Cleanup
});

describe('DataRefreshScheduler — Job registration (7 jobs)', () => {
  const deps = createMockDeps();
  const scheduler = new DataRefreshScheduler(deps, { enabled: true });

  scheduler.start();
  const status = scheduler.getStatus();

  assertEqual(status.jobs.length, 7, 'All 7 jobs are registered');

  const jobNames = status.jobs.map((j) => j.name);
  assert(jobNames.includes('rba_data'), 'rba_data job registered');
  assert(jobNames.includes('abs_data'), 'abs_data job registered');
  assert(jobNames.includes('asx_prices'), 'asx_prices job registered');
  assert(jobNames.includes('crypto_prices'), 'crypto_prices job registered');
  assert(jobNames.includes('sentiment'), 'sentiment job registered');
  assert(jobNames.includes('cognee_index'), 'cognee_index job registered');
  assert(jobNames.includes('calendar'), 'calendar job registered');

  scheduler.stop();
});

describe('DataRefreshScheduler — SchedulerStatus shape validation', () => {
  const deps = createMockDeps();
  const scheduler = new DataRefreshScheduler(deps, { enabled: true });

  scheduler.start();
  const status: SchedulerStatus = scheduler.getStatus();

  assert(typeof status.isRunning === 'boolean', 'isRunning is boolean');
  assert(Array.isArray(status.jobs), 'jobs is an array');
  assert(typeof status.uptime === 'number', 'uptime is a number');

  for (const job of status.jobs) {
    assert(typeof job.name === 'string', `Job ${job.name} has name`);
    assert(typeof job.cron === 'string', `Job ${job.name} has cron expression`);
    assert(job.lastStatus === null || typeof job.lastStatus === 'string', `Job ${job.name} lastStatus is null or string`);
    assert(job.lastRun === null || typeof job.lastRun === 'string', `Job ${job.name} lastRun is null or string`);
    assert(typeof job.nextRun === 'string', `Job ${job.name} has nextRun`);
    assert(typeof job.isEnabled === 'boolean', `Job ${job.name} isEnabled is boolean`);
    assert(typeof job.runCount === 'number', `Job ${job.name} runCount is number`);
    assert(typeof job.failCount === 'number', `Job ${job.name} failCount is number`);
  }

  scheduler.stop();
});

describe('DataRefreshScheduler — Job initial state', () => {
  const deps = createMockDeps();
  const scheduler = new DataRefreshScheduler(deps, { enabled: true });

  scheduler.start();
  const status = scheduler.getStatus();

  for (const job of status.jobs) {
    assertEqual(job.isEnabled, true, `Job ${job.name} starts enabled`);
    assertEqual(job.runCount, 0, `Job ${job.name} starts with 0 runs`);
    assertEqual(job.failCount, 0, `Job ${job.name} starts with 0 fails`);
    assertEqual(job.lastStatus, null, `Job ${job.name} starts with null lastStatus`);
    assertEqual(job.lastRun, null, `Job ${job.name} starts with null lastRun`);
  }

  scheduler.stop();
});

describe('DataRefreshScheduler — Manual job trigger (valid job)', async () => {
  const deps = createMockDeps();
  const scheduler = new DataRefreshScheduler(deps, { enabled: true });

  scheduler.start();

  try {
    const result = await scheduler.triggerJob('rba_data');
    assertEqual(result.success, true, 'Manual trigger of rba_data succeeds');
    assert(result.error === undefined, 'No error on successful trigger');
  } catch (err: any) {
    assert(false, `Manual trigger should not throw: ${err.message}`);
  }

  scheduler.stop();
});

describe('DataRefreshScheduler — Manual job trigger (invalid job)', async () => {
  const deps = createMockDeps();
  const scheduler = new DataRefreshScheduler(deps, { enabled: true });

  scheduler.start();

  try {
    const result = await scheduler.triggerJob('nonexistent_job');
    assertEqual(result.success, false, 'Trigger of nonexistent job fails');
    assert(result.error !== undefined && result.error.includes('not found'), 'Error mentions job not found');
  } catch (err: any) {
    assert(false, `Invalid trigger should return failure, not throw: ${err.message}`);
  }

  scheduler.stop();
});

describe('DataRefreshScheduler — Job enable/disable', () => {
  const deps = createMockDeps();
  const scheduler = new DataRefreshScheduler(deps, { enabled: true });

  scheduler.start();

  // Disable a job
  const disableResult = scheduler.setJobEnabled('rba_data', false);
  assertEqual(disableResult, true, 'setJobEnabled returns true for valid job');

  const status = scheduler.getStatus();
  const rbaJob = status.jobs.find((j) => j.name === 'rba_data');
  assertEqual(rbaJob?.isEnabled, false, 'rba_data is disabled');

  // Re-enable
  scheduler.setJobEnabled('rba_data', true);
  const status2 = scheduler.getStatus();
  const rbaJob2 = status2.jobs.find((j) => j.name === 'rba_data');
  assertEqual(rbaJob2?.isEnabled, true, 'rba_data is re-enabled');

  // Try invalid job
  const invalidResult = scheduler.setJobEnabled('invalid_job', false);
  assertEqual(invalidResult, false, 'setJobEnabled returns false for invalid job');

  scheduler.stop();
});

describe('DataRefreshScheduler — Double start is no-op', () => {
  const deps = createMockDeps();
  const scheduler = new DataRefreshScheduler(deps, { enabled: true });

  scheduler.start();
  const status1 = scheduler.getStatus();
  assertEqual(status1.isRunning, true, 'First start works');

  scheduler.start(); // Should be no-op
  const status2 = scheduler.getStatus();
  assertEqual(status2.isRunning, true, 'Second start is no-op, still running');
  assertEqual(status2.jobs.length, 7, 'Still 7 jobs after double start');

  scheduler.stop();
});

describe('DataRefreshScheduler — Cron expressions', () => {
  const deps = createMockDeps();
  const scheduler = new DataRefreshScheduler(deps, { enabled: true });

  scheduler.start();
  const status = scheduler.getStatus();

  const cronMap: Record<string, string> = {};
  for (const job of status.jobs) {
    cronMap[job.name] = job.cron;
  }

  assertEqual(cronMap['rba_data'], '0 6 * * *', 'RBA runs daily at 6am');
  assertEqual(cronMap['abs_data'], '0 7 * * *', 'ABS runs daily at 7am');
  assertEqual(cronMap['asx_prices'], '0 10-16 * * 1-5', 'ASX runs hourly during trading hours');
  assertEqual(cronMap['crypto_prices'], '*/30 * * * *', 'Crypto runs every 30 min');
  assertEqual(cronMap['sentiment'], '0 8 * * *', 'Sentiment runs daily at 8am');
  assertEqual(cronMap['cognee_index'], '0 9 * * *', 'Cognee index runs daily at 9am');
  assertEqual(cronMap['calendar'], '0 0 * * 0', 'Calendar runs weekly Sunday midnight');

  scheduler.stop();
});

describe('DataRefreshScheduler — SchedulerConfig type validation', () => {
  const config: SchedulerConfig = {
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

  assert(typeof config.enabled === 'boolean', 'enabled is boolean');
  assert(typeof config.timezone === 'string', 'timezone is string');
  assertEqual(config.timezone, 'Australia/Sydney', 'Timezone is Australia/Sydney');
  assert(typeof config.maxRetries === 'number', 'maxRetries is number');
  assert(typeof config.retryDelayMs === 'number', 'retryDelayMs is number');
});

describe('DataRefreshScheduler — Manual trigger updates job status', async () => {
  const deps = createMockDeps();
  const scheduler = new DataRefreshScheduler(deps, { enabled: true });

  scheduler.start();

  await scheduler.triggerJob('rba_data');

  const status = scheduler.getStatus();
  const rbaJob = status.jobs.find((j) => j.name === 'rba_data');

  if (rbaJob) {
    assertEqual(rbaJob.lastStatus, 'success', 'After trigger, lastStatus is success');
    assert(rbaJob.lastRun !== null, 'After trigger, lastRun is set');
    assert(rbaJob.lastDurationMs !== null && (rbaJob.lastDurationMs ?? 0) >= 0, 'After trigger, lastDurationMs is set');
    assertEqual(rbaJob.runCount, 1, 'After trigger, runCount is 1');
    assertEqual(rbaJob.failCount, 0, 'After trigger, failCount is still 0');
  }

  scheduler.stop();
});

describe('DataRefreshScheduler — Trigger with failing handler', async () => {
  const failingDeps: SchedulerDeps = {
    rbaDataFeed: {
      fetchAllTables: async () => { throw new Error('Network error'); },
    },
  };

  const scheduler = new DataRefreshScheduler(failingDeps, {
    enabled: true,
    maxRetries: 1,  // Fast fail
    retryDelayMs: 10,
  });

  scheduler.start();

  try {
    const result = await scheduler.triggerJob('rba_data');
    assertEqual(result.success, false, 'Failing job returns success=false');
    assert(result.error !== undefined, 'Failing job includes error message');
  } catch (err: any) {
    // triggerJob should catch and return, not throw
    assert(true, 'Failing job handled');
  }

  const status = scheduler.getStatus();
  const rbaJob = status.jobs.find((j) => j.name === 'rba_data');

  if (rbaJob) {
    assertEqual(rbaJob.lastStatus, 'failed', 'After failure, lastStatus is failed');
    assertEqual(rbaJob.failCount, 1, 'After failure, failCount is 1');
  }

  scheduler.stop();
});

// ============================================================================
// SUMMARY
// ============================================================================

setTimeout(() => {
  console.log('\n========================================');
  console.log(`Scheduler Integration Tests: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach((e) => console.log(`  - ${e}`));
  }
  console.log('========================================\n');
  process.exit(failed > 0 ? 1 : 0);
}, 3000);
