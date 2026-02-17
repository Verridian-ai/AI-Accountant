/**
 * ABS Data Feed Service
 *
 * Queries the Australian Bureau of Statistics SDMX 2.1 REST API for
 * 5 key dataflows: CPI, Labour Force, GDP (National Accounts),
 * Wage Price Index, and Building/Dwelling Approvals.
 *
 * SDMX JSON response structure (simplified):
 * {
 *   dataSets: [{
 *     series: {
 *       "0:0:0": {
 *         observations: { "0": [value], "1": [value], ... }
 *       }
 *     }
 *   }],
 *   structure: {
 *     dimensions: {
 *       observation: [{ values: [{ id: "2025-Q4" }, ...] }]
 *     }
 *   }
 * }
 *
 * Rate limit: 100 requests per minute (enforced via simple delay).
 */

import crypto from 'crypto';
import { db, economicIndicators, marketDataFeeds } from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import type {
  EconomicIndicatorRecord,
  AbsFetchResult,
  AbsDataflowDef,
} from './economic-data-types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const ABS_BASE_URL = 'https://data.api.abs.gov.au';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 30_000;
const RATE_LIMIT_DELAY_MS = 700; // ~85 req/min, safely under 100

/**
 * 5 key ABS SDMX dataflows.
 * `key` is the dimension filter string passed in the URL path.
 */
const ABS_DATAFLOWS: Record<string, AbsDataflowDef> = {
  CPI: {
    dataflowId: 'CPI',
    key: 'Q.10001.10.50.10.AQ',
    name: 'Consumer Price Index',
    indicators: [
      {
        seriesId: '10001',
        code: 'ABS_CPI_ALL_GROUPS',
        category: 'inflation',
        name: 'CPI All Groups',
        unit: 'index',
      },
      {
        seriesId: '10001',
        code: 'ABS_CPI_ALL_GROUPS_PCT',
        category: 'inflation',
        name: 'CPI All Groups % Change',
        unit: 'percent',
      },
    ],
  },
  LABOUR_FORCE: {
    dataflowId: 'LF',
    key: 'M.1.20.10.M6',
    name: 'Labour Force',
    indicators: [
      {
        code: 'ABS_UNEMPLOYMENT_RATE',
        category: 'employment',
        name: 'Unemployment Rate',
        unit: 'percent',
      },
      {
        code: 'ABS_PARTICIPATION_RATE',
        category: 'employment',
        name: 'Participation Rate',
        unit: 'percent',
      },
      {
        code: 'ABS_EMPLOYED_PERSONS',
        category: 'employment',
        name: 'Employed Persons',
        unit: 'thousands',
      },
    ],
  },
  GDP: {
    dataflowId: 'ANA_AGG',
    key: 'Q.1.GDP.10.10.A10',
    name: 'National Accounts',
    indicators: [
      { code: 'ABS_GDP_QUARTERLY', category: 'gdp', name: 'GDP Quarterly Change', unit: 'percent' },
      { code: 'ABS_GDP_ANNUAL', category: 'gdp', name: 'GDP Annual Change', unit: 'percent' },
    ],
  },
  WAGES: {
    dataflowId: 'WPI',
    key: 'Q.3.10.THRPEB.7',
    name: 'Wage Price Index',
    indicators: [
      {
        code: 'ABS_WPI_ALL',
        category: 'wages',
        name: 'Wage Price Index All Sectors',
        unit: 'percent',
      },
      {
        code: 'ABS_WPI_PRIVATE',
        category: 'wages',
        name: 'Wage Price Index Private',
        unit: 'percent',
      },
    ],
  },
  DWELLING_APPROVALS: {
    dataflowId: 'BA',
    key: 'M.8.1.1001',
    name: 'Building Approvals',
    indicators: [
      {
        code: 'ABS_DWELLING_APPROVALS',
        category: 'housing',
        name: 'Dwelling Approvals Total',
        unit: 'count',
      },
    ],
  },
};

// In-memory cache of parsed SDMX responses
const sdmxCache = new Map<string, { data: any; fetchedAt: number }>();

// Timestamp of last ABS API request (for rate limiting)
let lastRequestAt = 0;

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class AbsDataFeed {
  // ---------- Public API ----------

  /**
   * Fetch raw SDMX JSON data for a dataflow.
   * Uses 2-year lookback by default.
   */
  async fetchDataflow(dataflowId: string, key: string, startPeriod?: string): Promise<any> {
    const cacheKey = `${dataflowId}:${key}`;

    // Check cache
    const cached = sdmxCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.data;
    }

    // Rate limit
    await this.rateLimit();

    const start = startPeriod ?? this.defaultStartPeriod();
    const url = `${ABS_BASE_URL}/data/${dataflowId}/${key}?startPeriod=${start}&format=jsondata`;

    const raw = await this.fetchWithTimeout(url);
    const data = JSON.parse(raw);

    sdmxCache.set(cacheKey, { data, fetchedAt: Date.now() });
    return data;
  }

  /**
   * Parse an SDMX JSON response into EconomicIndicatorRecord[].
   * Extracts the most recent observations for each configured indicator.
   */
  async parseDataflow(dataflowKey: string, rawData: any): Promise<EconomicIndicatorRecord[]> {
    const def = ABS_DATAFLOWS[dataflowKey];
    if (!def) throw new Error(`Unknown ABS dataflow key: ${dataflowKey}`);

    const feedId = await this.ensureFeedEntry(dataflowKey, def);
    const results: EconomicIndicatorRecord[] = [];

    try {
      const dataSet = rawData?.dataSets?.[0];
      const structure = rawData?.structure;

      if (!dataSet || !structure) return [];

      // Get observation dimension values (time periods)
      const obsDimension = structure.dimensions?.observation?.[0];
      const timePeriods: string[] = obsDimension?.values?.map((v: Record<string, unknown>) => v.id) ?? [];

      if (timePeriods.length === 0) return [];

      // Get series dimension values for labeling
      const seriesDims = structure.dimensions?.series ?? [];

      // Iterate over each series in the dataset
      const series = dataSet.series ?? {};
      const seriesKeys = Object.keys(series);

      // Map each configured indicator to results from the response.
      // For dataflows with a single series, we assign indicators in order.
      // For multi-series responses, we try to match by index.
      for (let idx = 0; idx < def.indicators.length; idx++) {
        const indDef = def.indicators[idx];
        const seriesKey = seriesKeys[Math.min(idx, seriesKeys.length - 1)];
        const seriesData = series[seriesKey];

        if (!seriesData?.observations) continue;

        const obsKeys = Object.keys(seriesData.observations)
          .map((k) => parseInt(k, 10))
          .sort((a, b) => a - b);

        if (obsKeys.length === 0) continue;

        // Most recent observation
        const latestKey = obsKeys[obsKeys.length - 1];
        const latestValue = this.extractObsValue(seriesData.observations[latestKey]);
        const latestPeriod = timePeriods[latestKey] ?? '';

        if (latestValue === null) continue;

        // Previous observation for change calc
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
      console.error(`[ABS] Error parsing dataflow ${dataflowKey}:`, err);
    }

    return results;
  }

  /**
   * Fetch and parse all 5 ABS dataflows, upsert indicators into DB.
   */
  async fetchAllIndicators(): Promise<AbsFetchResult> {
    const allIndicators: EconomicIndicatorRecord[] = [];
    const errors: Array<{ dataflow: string; error: string }> = [];
    let dataflowsProcessed = 0;

    for (const key of Object.keys(ABS_DATAFLOWS)) {
      try {
        const def = ABS_DATAFLOWS[key];
        const rawData = await this.fetchDataflow(def.dataflowId, def.key);
        const indicators = await this.parseDataflow(key, rawData);

        for (const ind of indicators) {
          await this.upsertIndicator(ind);
        }

        allIndicators.push(...indicators);
        dataflowsProcessed++;
        await this.updateFeedStatus(key, true);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[ABS] Error fetching dataflow ${key}:`, message);
        errors.push({ dataflow: key, error: message });
        await this.updateFeedStatus(key, false, message);
      }
    }

    return { indicators: allIndicators, dataflowsProcessed, errors };
  }

  /**
   * Convenience: get most recent value for an indicator code from DB.
   */
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
      // Table may not exist
    }
    return null;
  }

  /**
   * Return historical observations for an indicator code (default last 20 periods).
   */
  async getIndicatorHistory(code: string, periods = 20): Promise<EconomicIndicatorRecord[]> {
    try {
      const rows = await db
        .select()
        .from(economicIndicators)
        .where(eq(economicIndicators.indicatorCode, code))
        .orderBy(desc(economicIndicators.observationDate))
        .limit(periods)
        .all();

      return rows.map((r: Record<string, unknown>) => ({
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

  // ---------- Internal helpers ----------

  /**
   * Extract a numeric value from an SDMX observation array.
   * Observations are [value, ...annotation_indices].
   */
  private extractObsValue(obs: any): number | null {
    if (!obs) return null;
    if (Array.isArray(obs)) {
      const val = obs[0];
      return typeof val === 'number' ? val : null;
    }
    return typeof obs === 'number' ? obs : null;
  }

  /**
   * Convert an SDMX period string to an ISO date.
   * Examples: "2025-Q4" → "2025-12-31", "2026-01" → "2026-01-01", "2025" → "2025-01-01"
   */
  private periodToIsoDate(period: string): string {
    if (!period) return new Date().toISOString().slice(0, 10);

    // Quarterly: "2025-Q4"
    const qMatch = period.match(/^(\d{4})-Q(\d)$/);
    if (qMatch) {
      const year = parseInt(qMatch[1], 10);
      const quarter = parseInt(qMatch[2], 10);
      // End of quarter
      const month = quarter * 3;
      const lastDay = new Date(year, month, 0).getDate();
      return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    // Monthly: "2026-01"
    const mMatch = period.match(/^(\d{4})-(\d{2})$/);
    if (mMatch) {
      return `${mMatch[1]}-${mMatch[2]}-01`;
    }

    // Annual: "2025"
    const yMatch = period.match(/^(\d{4})$/);
    if (yMatch) {
      return `${yMatch[1]}-01-01`;
    }

    return period;
  }

  /**
   * Default start period: 2 years ago.
   */
  private defaultStartPeriod(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 2);
    return `${d.getFullYear()}-01`;
  }

  /**
   * Infer data frequency from the dataflow key.
   */
  private inferFrequency(key: string): string {
    switch (key) {
      case 'CPI':
        return 'quarterly';
      case 'GDP':
        return 'quarterly';
      case 'WAGES':
        return 'quarterly';
      case 'LABOUR_FORCE':
        return 'monthly';
      case 'DWELLING_APPROVALS':
        return 'monthly';
      default:
        return 'quarterly';
    }
  }

  /**
   * Simple rate limiter: wait if we've made a request too recently.
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastRequestAt;
    if (elapsed < RATE_LIMIT_DELAY_MS) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS - elapsed));
    }
    lastRequestAt = Date.now();
  }

  /**
   * Ensure a market_data_feeds entry exists for this ABS dataflow; return its id.
   */
  private async ensureFeedEntry(key: string, def: AbsDataflowDef): Promise<string> {
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
      // Non-critical
    }
    return feedId;
  }

  /**
   * Upsert an indicator record: select → update or insert.
   */
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
      console.error(`[ABS] Failed to upsert indicator ${ind.indicatorCode}:`, err);
    }
  }

  /**
   * Update a feed's last-fetched status.
   */
  private async updateFeedStatus(key: string, success: boolean, error?: string): Promise<void> {
    const feedId = `abs-${key.toLowerCase().replace(/_/g, '-')}`;
    const now = new Date().toISOString();
    try {
      const update: Record<string, any> = {
        lastFetchedAt: now,
        updatedAt: now,
      };
      if (success) {
        update.lastSuccessfulAt = now;
        update.errorCount = 0;
        update.lastError = null;
      } else {
        update.lastError = error ?? 'Unknown error';
      }
      await db.update(marketDataFeeds).set(update).where(eq(marketDataFeeds.id, feedId)).run();
    } catch {
      // Non-critical
    }
  }

  /**
   * Fetch a URL with timeout.
   */
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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const absDataFeed = new AbsDataFeed();
