/**
 * Data Refresh Scheduler — Refresh Job Implementations
 *
 * Individual refresh job handlers for each data source.
 */

import crypto from 'crypto';
import { db, economicCalendar } from '../../schema.js';
import { logger } from '../../lib/logger.js';
import type { SchedulerDeps } from './types.js';
import { DEFAULT_SENTIMENT_TOPICS, AU_ECONOMIC_EVENTS, TWENTY_FOUR_HOURS } from './types.js';
import { isAsxTradingHours } from './schedule-manager.js';

// ============================================================================
// HELPER
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// JOB HANDLERS
// ============================================================================

/**
 * Job 1: Refresh RBA data feed.
 */
export async function refreshRbaData(deps: SchedulerDeps): Promise<void> {
  if (!deps.rbaDataFeed) {
    logger.warn('[Scheduler] rbaDataFeed not available — skipping');
    return;
  }

  logger.info('[Scheduler] Refreshing RBA data...');
  const result = await deps.rbaDataFeed.fetchAllTables();
  logger.info(
    `[Scheduler] RBA refresh done: ${result.tablesProcessed ?? 0} tables processed, ${(result.errors as unknown[] | undefined)?.length ?? 0} errors`,
  );
}

/**
 * Job 2: Refresh ABS data feed.
 */
export async function refreshAbsData(deps: SchedulerDeps): Promise<void> {
  if (!deps.absDataFeed) {
    logger.warn('[Scheduler] absDataFeed not available — skipping');
    return;
  }

  logger.info('[Scheduler] Refreshing ABS data...');
  const result = await deps.absDataFeed.fetchAllIndicators();
  logger.info(
    `[Scheduler] ABS refresh done: ${result.dataflowsProcessed ?? 0} dataflows processed, ${(result.errors as unknown[] | undefined)?.length ?? 0} errors`,
  );
}

/**
 * Job 3: Refresh ASX prices (only during trading hours).
 */
export async function refreshAsxPrices(deps: SchedulerDeps): Promise<void> {
  if (!deps.marketPriceService) {
    logger.warn('[Scheduler] marketPriceService not available — skipping');
    return;
  }

  if (!isAsxTradingHours()) {
    logger.info(
      '[Scheduler] Outside ASX trading hours (Mon-Fri 10am-4pm AEST) — skipping ASX refresh',
    );
    return;
  }

  logger.info('[Scheduler] Refreshing ASX prices...');
  const result = await deps.marketPriceService.refreshPrices();
  logger.info(
    `[Scheduler] ASX refresh done: ${result.asxUpdated ?? 0} ASX updated, API calls remaining: ${result.asxApiCallsRemaining ?? '?'}`,
  );
}

/**
 * Job 4: Refresh crypto prices.
 */
export async function refreshCryptoPrices(deps: SchedulerDeps): Promise<void> {
  if (!deps.marketPriceService) {
    logger.warn('[Scheduler] marketPriceService not available — skipping');
    return;
  }

  logger.info('[Scheduler] Refreshing crypto prices...');
  const result = await deps.marketPriceService.refreshPrices();
  logger.info(`[Scheduler] Crypto refresh done: ${result.cryptoUpdated ?? 0} crypto updated`);
}

/**
 * Job 5: Refresh sentiment analysis for default topics.
 */
export async function refreshSentiment(deps: SchedulerDeps): Promise<void> {
  if (!deps.sentimentService) {
    logger.warn('[Scheduler] sentimentService not available — skipping');
    return;
  }

  logger.info(`[Scheduler] Refreshing sentiment for ${DEFAULT_SENTIMENT_TOPICS.length} topics...`);
  let successCount = 0;
  let errorCount = 0;

  for (const topic of DEFAULT_SENTIMENT_TOPICS) {
    try {
      await deps.sentimentService.researchTopic(topic);
      await deps.sentimentService.analyzeSentiment(topic);
      successCount++;
    } catch (err) {
      errorCount++;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[Scheduler] Sentiment error for '${topic}': ${msg}`);
    }
    // Small delay between topics to avoid rate limits
    await sleep(2000);
  }

  logger.info(
    `[Scheduler] Sentiment refresh done: ${successCount} succeeded, ${errorCount} failed`,
  );
}

/**
 * Job 6: Incremental Cognee index of new market data.
 */
export async function refreshCogneeIndex(deps: SchedulerDeps): Promise<void> {
  if (!deps.marketCogneeIndexer) {
    logger.warn('[Scheduler] marketCogneeIndexer not available — skipping');
    return;
  }

  // Index data added since 24h ago
  const since = new Date(Date.now() - TWENTY_FOUR_HOURS).toISOString();
  logger.info(`[Scheduler] Running incremental Cognee index since ${since}...`);
  const result = await deps.marketCogneeIndexer.incrementalIndex(since);
  logger.info(
    `[Scheduler] Cognee index done: ${result.totalIndexed ?? 0} indexed, ${(result.errors as unknown[] | undefined)?.length ?? 0} errors`,
  );
}

/**
 * Job 7: Populate upcoming economic calendar events.
 */
export async function refreshCalendar(): Promise<void> {
  logger.info('[Scheduler] Populating economic calendar events...');

  const now = new Date();
  let eventsCreated = 0;

  for (const event of AU_ECONOMIC_EVENTS) {
    try {
      const scheduledDates = getUpcomingDates(event.frequency, now, 3);

      for (const date of scheduledDates) {
        const dateStr = date.toISOString().split('T')[0] ?? date.toISOString();
        const id = crypto.randomUUID();

        try {
          await db
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
      logger.error(`[Scheduler] Calendar error for '${event.name}': ${msg}`);
    }
  }

  logger.info(`[Scheduler] Calendar refresh done: ${eventsCreated} events created/updated`);
}

// ============================================================================
// CALENDAR HELPERS
// ============================================================================

/**
 * Generate upcoming dates for an event based on its frequency.
 * Returns the next `count` occurrences after `from`.
 */
function getUpcomingDates(frequency: string, from: Date, count: number): Date[] {
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
