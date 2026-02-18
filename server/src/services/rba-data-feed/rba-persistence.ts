/**
 * RBA Data Feed — Database persistence helpers
 */

import { db, economicIndicators, marketDataFeeds } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';
import type { EconomicIndicatorRecord } from '../economic-data/enhanced-types.js';
import { RBA_BASE_URL } from './constants.js';
import { inferFrequency } from './rba-parser.js';

type FeedStatusUpdate = {
  lastFetchedAt: string;
  updatedAt: string;
  lastSuccessfulAt?: string;
  errorCount?: number;
  lastError?: string | null;
};

export async function ensureFeedEntry(
  tableKey: string,
  tableDef: { name: string; url: string },
): Promise<string> {
  const feedId = `rba-${tableKey.toLowerCase()}`;
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
          feedName: `RBA ${tableKey}: ${tableDef.name}`,
          feedType: 'csv',
          sourceUrl: `${RBA_BASE_URL}${tableDef.url}`,
          sourceName: 'Reserve Bank of Australia',
          description: tableDef.name,
          refreshFrequency: inferFrequency(tableKey) === 'daily' ? 'daily' : 'weekly',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .run();
    }
  } catch {
    /* silently continue */
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
    logger.error({ err: err }, `[RBA] Failed to upsert indicator ${ind.indicatorCode}:`);
  }
}

export async function updateFeedStatus(
  tableKey: string,
  success: boolean,
  error?: string,
): Promise<void> {
  const feedId = `rba-${tableKey.toLowerCase()}`;
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
