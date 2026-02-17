/**
 * ABS Data Feed Service
 *
 * Queries the Australian Bureau of Statistics SDMX 2.1 REST API.
 */

import crypto from 'crypto';
import { db, economicIndicators, marketDataFeeds } from '../../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import type { EconomicIndicatorRecord, AbsFetchResult } from '../economic-data-types.js';
import { logger } from '../../lib/logger.js';
import {
  ABS_BASE_URL,
  CACHE_TTL_MS,
  FETCH_TIMEOUT_MS,
  RATE_LIMIT_DELAY_MS,
  ABS_DATAFLOWS,
  sdmxCache,
  lastRequestAt,
  setLastRequestAt,
} from './constants.js';

export class AbsDataFeed {
  async fetchDataflow(dataflowId: string, key: string, startPeriod?: string): Promise<any> {
    const cacheKey = `${dataflowId}:${key}`;
    const cached = sdmxCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data;
    await this.rateLimit();
    const start = startPeriod ?? this.defaultStartPeriod();
    const url = `${ABS_BASE_URL}/data/${dataflowId}/${key}?startPeriod=${start}&format=jsondata`;
    const raw = await this.fetchWithTimeout(url);
    const data = JSON.parse(raw);
    sdmxCache.set(cacheKey, { data, fetchedAt: Date.now() });
    return data;
  }

  async parseDataflow(dataflowKey: string, rawData: any): Promise<EconomicIndicatorRecord[]> {
    const def = ABS_DATAFLOWS[dataflowKey];
    if (!def) throw new Error(`Unknown ABS dataflow key: ${dataflowKey}`);
    const feedId = await this.ensureFeedEntry(dataflowKey, def);
    const results: EconomicIndicatorRecord[] = [];
    try {
      const dataSet = rawData?.dataSets?.[0];
      const structure = rawData?.structure;
      if (!dataSet || !structure) return [];
      const obsDimension = structure.dimensions?.observation?.[0];
      const timePeriods: string[] = obsDimension?.values?.map((v: any) => v.id) ?? [];
      if (timePeriods.length === 0) return [];
      const series = dataSet.series ?? {};
      const seriesKeys = Object.keys(series);

      for (let idx = 0; idx < def.indicators.length; idx++) {
        const indDef = def.indicators[idx];
        const seriesKey = seriesKeys[Math.min(idx, seriesKeys.length - 1)];
        const seriesData = series[seriesKey];
        if (!seriesData?.observations) continue;
        const obsKeys = Object.keys(seriesData.observations)
          .map((k) => parseInt(k, 10))
          .sort((a, b) => a - b);
        if (obsKeys.length === 0) continue;
        const latestKey = obsKeys[obsKeys.length - 1];
        const latestValue = this.extractObsValue(seriesData.observations[latestKey]);
        const latestPeriod = timePeriods[latestKey] ?? '';
        if (latestValue === null) continue;
        let previousValue: number | null = null;
        if (obsKeys.length >= 2) {
          const prevKey = obsKeys[obsKeys.length - 2];
          previousValue = this.extractObsValue(seriesData.observations[prevKey]);
        }
        const changePct =
          previousValue !== null && previousValue !== 0
            ? Math.round(((latestValue - previousValue) / Math.abs(previousValue)) * 10000) / 100
            : null;
        const observationDate = this.periodToIsoDate(latestPeriod);
        results.push({
          id: crypto.randomUUID(),
          feedId,
          indicatorCode: indDef.code,
          indicatorName: indDef.name,
          category: indDef.category,
          value: latestValue,
          previousValue,
          changePct,
          unit: indDef.unit,
          frequency: this.inferFrequency(dataflowKey),
          referencePeriod: latestPeriod,
          source: `ABS ${def.dataflowId}`,
          notes: null,
          observationDate,
        });
      }
    } catch (err) {
      logger.error({ err: err }, `[ABS] Error parsing dataflow ${dataflowKey}:`);
    }
    return results;
  }

  async fetchAllIndicators(): Promise<AbsFetchResult> {
    const allIndicators: EconomicIndicatorRecord[] = [];
    const errors: Array<{ dataflow: string; error: string }> = [];
    let dataflowsProcessed = 0;
    for (const key of Object.keys(ABS_DATAFLOWS)) {
      try {
        const def = ABS_DATAFLOWS[key];
        const rawData = await this.fetchDataflow(def.dataflowId, def.key);
        const indicators = await this.parseDataflow(key, rawData);
        for (const ind of indicators) await this.upsertIndicator(ind);
        allIndicators.push(...indicators);
        dataflowsProcessed++;
        await this.updateFeedStatus(key, true);
      } catch (err: any) {
        const message = err?.message ?? String(err);
        logger.error({ err: message }, `[ABS] Error fetching dataflow ${key}:`);
        errors.push({ dataflow: key, error: message });
        await this.updateFeedStatus(key, false, message);
      }
    }
    return { indicators: allIndicators, dataflowsProcessed, errors };
  }

  async getLatestIndicator(code: string): Promise<EconomicIndicatorRecord | null> {
    try {
      const rows = await db
        .select()
        .from(economicIndicators)
        .where(eq(economicIndicators.indicatorCode, code))
        .orderBy(desc(economicIndicators.observationDate))
        .limit(1)
        .all();
      if (rows.length > 0) {
        const r = rows[0];
        return {
          id: r.id,
          feedId: r.feedId,
          indicatorCode: r.indicatorCode,
          indicatorName: r.indicatorName,
          category: r.category,
          value: r.value,
          previousValue: r.previousValue,
          changePct: r.changePct,
          unit: r.unit,
          frequency: r.frequency,
          referencePeriod: r.referencePeriod,
          source: r.source,
          notes: r.notes,
          observationDate: r.observationDate,
        };
      }
    } catch {
      /* Table may not exist */
    }
    return null;
  }

  async getIndicatorHistory(code: string, periods = 20): Promise<EconomicIndicatorRecord[]> {
    try {
      const rows = await db
        .select()
        .from(economicIndicators)
        .where(eq(economicIndicators.indicatorCode, code))
        .orderBy(desc(economicIndicators.observationDate))
        .limit(periods)
        .all();
      return rows.map((r: any) => ({
        id: r.id as string,
        feedId: r.feedId as string,
        indicatorCode: r.indicatorCode as string,
        indicatorName: r.indicatorName as string,
        category: r.category as string,
        value: r.value as number,
        previousValue: r.previousValue as number | null,
        changePct: r.changePct as number | null,
        unit: r.unit as string,
        frequency: r.frequency as string,
        referencePeriod: r.referencePeriod as string,
        source: r.source as string,
        notes: r.notes as string | null,
        observationDate: r.observationDate as string,
      }));
    } catch {
      return [];
    }
  }

  // --- Internal helpers ---

  private extractObsValue(obs: any): number | null {
    if (!obs) return null;
    if (Array.isArray(obs)) {
      const val = obs[0];
      return typeof val === 'number' ? val : null;
    }
    return typeof obs === 'number' ? obs : null;
  }

  private periodToIsoDate(period: string): string {
    if (!period) return new Date().toISOString().slice(0, 10);
    const qMatch = period.match(/^(\d{4})-Q(\d)$/);
    if (qMatch) {
      const year = parseInt(qMatch[1], 10);
      const quarter = parseInt(qMatch[2], 10);
      const month = quarter * 3;
      const lastDay = new Date(year, month, 0).getDate();
      return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    const mMatch = period.match(/^(\d{4})-(\d{2})$/);
    if (mMatch) return `${mMatch[1]}-${mMatch[2]}-01`;
    const yMatch = period.match(/^(\d{4})$/);
    if (yMatch) return `${yMatch[1]}-01-01`;
    return period;
  }

  private defaultStartPeriod(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 2);
    return `${d.getFullYear()}-01`;
  }

  private inferFrequency(key: string): string {
    switch (key) {
      case 'CPI':
      case 'GDP':
      case 'WAGES':
        return 'quarterly';
      case 'LABOUR_FORCE':
      case 'DWELLING_APPROVALS':
        return 'monthly';
      default:
        return 'quarterly';
    }
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastRequestAt;
    if (elapsed < RATE_LIMIT_DELAY_MS) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS - elapsed));
    }
    setLastRequestAt(Date.now());
  }

  private async ensureFeedEntry(
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
            refreshFrequency: this.inferFrequency(key) === 'monthly' ? 'weekly' : 'monthly',
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

  private async upsertIndicator(ind: EconomicIndicatorRecord): Promise<void> {
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

  private async updateFeedStatus(key: string, success: boolean, error?: string): Promise<void> {
    const feedId = `abs-${key.toLowerCase().replace(/_/g, '-')}`;
    const now = new Date().toISOString();
    try {
      const update: Record<string, any> = { lastFetchedAt: now, updatedAt: now };
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

  private async fetchWithTimeout(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'GoldLedger/1.0 (Financial Data Aggregator)',
          Accept: 'application/vnd.sdmx.data+json;version=1.0.0-wd,application/json',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const absDataFeed = new AbsDataFeed();
