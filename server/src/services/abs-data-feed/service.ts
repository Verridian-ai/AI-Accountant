/**
 * ABS Data Feed Service — thin orchestrator
 *
 * Queries the Australian Bureau of Statistics SDMX 2.1 REST API.
 */

import crypto from 'crypto';
import { db, economicIndicators } from '../../schema.js';
import { eq, desc } from 'drizzle-orm';
import type { EconomicIndicatorRecord, AbsFetchResult } from '../economic-data/enhanced-types.js';
import { logger } from '../../lib/logger.js';
import { ABS_BASE_URL, CACHE_TTL_MS, ABS_DATAFLOWS, sdmxCache } from './constants.js';
import {
  extractObsValue,
  periodToIsoDate,
  defaultStartPeriod,
  inferFrequency,
} from './abs-parser.js';
import {
  rateLimit,
  ensureFeedEntry,
  upsertIndicator,
  updateFeedStatus,
} from './abs-persistence.js';
import { fetchWithTimeout } from './abs-transport.js';

// SDMX JSON structure — only fields accessed by parseDataflow
type SdmxDimValue = { id: string };
type SdmxDimension = { values?: SdmxDimValue[] };
type SdmxStructure = { dimensions?: { observation?: SdmxDimension[] } };
type SdmxSeries = { observations?: Record<string, unknown> };
type SdmxDataSet = { series?: Record<string, SdmxSeries> };
type SdmxResponse = { dataSets?: SdmxDataSet[]; structure?: SdmxStructure };

export class AbsDataFeed {
  async fetchDataflow(dataflowId: string, key: string, startPeriod?: string): Promise<unknown> {
    const cacheKey = `${dataflowId}:${key}`;
    const cached = sdmxCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data;
    await rateLimit();
    const start = startPeriod ?? defaultStartPeriod();
    const url = `${ABS_BASE_URL}/data/${dataflowId}/${key}?startPeriod=${start}&format=jsondata`;
    const raw = await fetchWithTimeout(url);
    const data: unknown = JSON.parse(raw);
    sdmxCache.set(cacheKey, { data, fetchedAt: Date.now() });
    return data;
  }

  async parseDataflow(dataflowKey: string, rawData: unknown): Promise<EconomicIndicatorRecord[]> {
    const def = ABS_DATAFLOWS[dataflowKey];
    if (!def) throw new Error(`Unknown ABS dataflow key: ${dataflowKey}`);
    const feedId = await ensureFeedEntry(dataflowKey, def);
    const results: EconomicIndicatorRecord[] = [];
    try {
      const data = rawData as SdmxResponse;
      const dataSet = data?.dataSets?.[0];
      const structure = data?.structure;
      if (!dataSet || !structure) return [];
      const obsDimension = structure.dimensions?.observation?.[0];
      const timePeriods: string[] = obsDimension?.values?.map((v) => v.id) ?? [];
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
        const latestValue = extractObsValue(seriesData.observations[latestKey]);
        const latestPeriod = timePeriods[latestKey] ?? '';
        if (latestValue === null) continue;
        let previousValue: number | null = null;
        if (obsKeys.length >= 2) {
          const prevKey = obsKeys[obsKeys.length - 2];
          previousValue = extractObsValue(seriesData.observations[prevKey]);
        }
        const changePct =
          previousValue !== null && previousValue !== 0
            ? Math.round(((latestValue - previousValue) / Math.abs(previousValue)) * 10000) / 100
            : null;
        const observationDate = periodToIsoDate(latestPeriod);
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
          frequency: inferFrequency(dataflowKey),
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
        for (const ind of indicators) await upsertIndicator(ind);
        allIndicators.push(...indicators);
        dataflowsProcessed++;
        await updateFeedStatus(key, true);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ err: message }, `[ABS] Error fetching dataflow ${key}:`);
        errors.push({ dataflow: key, error: message });
        await updateFeedStatus(key, false, message);
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
      return (rows as EconomicIndicatorRecord[]).map((r) => ({
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
      }));
    } catch {
      return [];
    }
  }
}

export const absDataFeed = new AbsDataFeed();
