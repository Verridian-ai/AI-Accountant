/**
 * ABS Data Feed — Database persistence helpers
 */

import { db, economicIndicators, marketDataFeeds } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';
import type { EconomicIndicatorRecord } from '../economic-data/enhanced-types.js';
import { ABS_BASE_URL, RATE_LIMIT_DELAY_MS, lastRequestAt, setLastRequestAt } from './constants.js';
import { inferFrequency } from './abs-parser.js';

type FeedStatusUpdate = {
  lastFetchedAt: string;
  updatedAt: string;
  lastSuccessfulAt?: string;
  errorCount?: number;
  lastError?: string | null;
};

export async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < RATE_LIMIT_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS - elapsed));
  }
  setLastRequestAt(Date.now());
}

export async function ensureFeedEntry(
  key: string,
  def: { dataflowId: string; key: string; name: string },
): Promise<string> {
  const feedId = `abs-${key.toLowerCase().replace(/_/g, '-')}`;
  try {
    const existing = await db
      .select()
      .from(marketDataFeeds)
      .where(eq(marketDataFeeds.id, feedId))
      .all();
    if (existing.length === 0) {
      await db
        .insert(marketDataFeeds)
        .values({
          id: feedId,
          feedName: `ABS ${def.dataflowId}: ${def.name}`,
          feedType: 'sdmx',
          sourceUrl: `${ABS_BASE_URL}/data/${def.dataflowId}/${def.key}`,
          sourceName: 'Australian Bureau of Statistics',
          description: def.name,
          refreshFrequency: inferFrequency(key) === 'monthly' ? 'weekly' : 'monthly',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .run();
    }
  } catch {
    /* Non-critical */
  }
  return feedId;
}

export async function upsertIndicator(ind: EconomicIndicatorRecord): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(economicIndicators)
      .where(
        and(
          eq(economicIndicators.indicatorCode, ind.indicatorCode),
          eq(economicIndicators.referencePeriod, ind.referencePeriod),
        ),
      )
      .all();
    if (existing.length > 0) {
      await db
        .update(economicIndicators)
        .set({
          value: ind.value,
          previousValue: ind.previousValue,
          changePct: ind.changePct,
          observationDate: ind.observationDate,
        })
        .where(eq(economicIndicators.id, existing[0].id))
        .run();
    } else {
      await db
        .insert(economicIndicators)
        .values({
          id: ind.id,
          feedId: ind.feedId,
          indicatorCode: ind.indicatorCode,
          indicatorName: ind.indicatorName,
          category: ind.category,
          value: ind.value,
          previousValue: ind.previousValue,
          changePct: ind.changePct,
          unit: ind.unit,
          frequency: ind.frequency,
          referencePeriod: ind.referencePeriod,
          source: ind.source,
          notes: ind.notes,
          observationDate: ind.observationDate,
          createdAt: new Date().toISOString(),
        })
        .run();
    }
  } catch (err) {
    logger.error({ err: err }, `[ABS] Failed to upsert indicator ${ind.indicatorCode}:`);
  }
}

export async function updateFeedStatus(
  key: string,
  success: boolean,
  error?: string,
): Promise<void> {
  const feedId = `abs-${key.toLowerCase().replace(/_/g, '-')}`;
  const now = new Date().toISOString();
  try {
    const update: FeedStatusUpdate = { lastFetchedAt: now, updatedAt: now };
    if (success) {
      update.lastSuccessfulAt = now;
      update.errorCount = 0;
      update.lastError = null;
    } else {
      update.lastError = error ?? 'Unknown error';
    }
    await db.update(marketDataFeeds).set(update).where(eq(marketDataFeeds.id, feedId)).run();
  } catch {
    /* Non-critical */
  }
}
