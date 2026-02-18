/**
 * RBA Data Feed Service — thin orchestrator
 *
 * Downloads and parses Reserve Bank of Australia statistical CSV tables.
 */

import crypto from 'crypto';
import { db, economicIndicators } from '../../schema.js';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';
import type { EconomicIndicatorRecord, RbaFetchResult } from '../economic-data/enhanced-types.js';
import { RBA_BASE_URL, CACHE_TTL_MS, RBA_TABLES, csvCache } from './constants.js';
import {
  findHeaderRow,
  parseCsvRow,
  findColumnIndex,
  parseRbaDate,
  inferFrequency,
} from './rba-parser.js';
import { ensureFeedEntry, upsertIndicator, updateFeedStatus } from './rba-persistence.js';
import { fetchWithTimeout } from './rba-transport.js';

export class RbaDataFeed {
  async fetchTable(tableKey: string): Promise<string> {
    const tableDef = RBA_TABLES[tableKey];
    if (!tableDef) throw new Error(`Unknown RBA table key: ${tableKey}`);
    const cached = csvCache.get(tableKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.csv;
    const url = `${RBA_BASE_URL}${tableDef.url}`;
    const csv = await fetchWithTimeout(url);
    csvCache.set(tableKey, { csv, fetchedAt: Date.now() });
    return csv;
  }

  async parseTable(tableKey: string, csv: string): Promise<EconomicIndicatorRecord[]> {
    const tableDef = RBA_TABLES[tableKey];
    if (!tableDef) throw new Error(`Unknown RBA table key: ${tableKey}`);
    const feedId = await ensureFeedEntry(tableKey, tableDef);
    const lines = csv.split('\n');
    const headerIndex = findHeaderRow(lines);
    if (headerIndex < 0) return [];
    const headers = parseCsvRow(lines[headerIndex]);
    const dataLines = lines.slice(headerIndex + 1).filter((l) => l.trim().length > 0);
    if (dataLines.length === 0) return [];

    const results: EconomicIndicatorRecord[] = [];
    for (const indicator of tableDef.indicators) {
      const colIndex = findColumnIndex(headers, indicator.column);
      if (colIndex < 0) continue;
      let latestValue: number | null = null;
      let latestDate = '';
      let previousValue: number | null = null;

      for (let i = dataLines.length - 1; i >= 0; i--) {
        const row = parseCsvRow(dataLines[i]);
        const dateStr = row[0]?.trim();
        const cellValue = row[colIndex]?.trim();
        if (!cellValue || cellValue === '') continue;
        const numVal = parseFloat(cellValue);
        if (isNaN(numVal)) continue;
        if (latestValue === null) {
          latestValue = numVal;
          latestDate = parseRbaDate(dateStr);
        } else if (previousValue === null) {
          previousValue = numVal;
          break;
        }
      }
      if (latestValue === null) continue;
      const changePct =
        previousValue !== null && previousValue !== 0
          ? Math.round(((latestValue - previousValue) / Math.abs(previousValue)) * 10000) / 100
          : null;

      results.push({
        id: crypto.randomUUID(),
        feedId,
        indicatorCode: indicator.code,
        indicatorName: `${tableDef.name} — ${indicator.column}`,
        category: indicator.category,
        value: latestValue,
        previousValue,
        changePct,
        unit: indicator.unit,
        frequency: inferFrequency(tableKey),
        referencePeriod: latestDate,
        source: `RBA ${tableKey}`,
        notes: null,
        observationDate: latestDate,
      });
    }
    return results;
  }

  async fetchAllTables(): Promise<RbaFetchResult> {
    const allIndicators: EconomicIndicatorRecord[] = [];
    const errors: Array<{ table: string; error: string }> = [];
    let tablesProcessed = 0;

    for (const tableKey of Object.keys(RBA_TABLES)) {
      try {
        const csv = await this.fetchTable(tableKey);
        const indicators = await this.parseTable(tableKey, csv);
        for (const ind of indicators) await upsertIndicator(ind);
        allIndicators.push(...indicators);
        tablesProcessed++;
        await updateFeedStatus(tableKey, true);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ err: message }, `[RBA] Error fetching table ${tableKey}:`);
        errors.push({ table: tableKey, error: message });
        await updateFeedStatus(tableKey, false, message);
      }
    }
    return { indicators: allIndicators, tablesProcessed, errors };
  }

  async getCashRate(): Promise<{ rate: number; effectiveDate: string; previousRate: number }> {
    try {
      const rows = await db
        .select()
        .from(economicIndicators)
        .where(eq(economicIndicators.indicatorCode, 'RBA_CASH_RATE'))
        .orderBy(desc(economicIndicators.observationDate))
        .limit(1)
        .all();
      if (rows.length > 0) {
        return {
          rate: rows[0].value,
          effectiveDate: rows[0].observationDate,
          previousRate: rows[0].previousValue ?? rows[0].value,
        };
      }
    } catch {
      /* Table may not exist */
    }

    const csv = await this.fetchTable('A2');
    const indicators = await this.parseTable('A2', csv);
    const cashRate = indicators.find((i) => i.indicatorCode === 'RBA_CASH_RATE');
    if (cashRate) {
      await upsertIndicator(cashRate);
      return {
        rate: cashRate.value,
        effectiveDate: cashRate.observationDate,
        previousRate: cashRate.previousValue ?? cashRate.value,
      };
    }
    throw new Error('Unable to retrieve RBA cash rate');
  }

  async getRateHistory(
    indicatorCode: string,
    months = 24,
  ): Promise<Array<{ date: string; value: number }>> {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    try {
      const rows = await db
        .select({ date: economicIndicators.observationDate, value: economicIndicators.value })
        .from(economicIndicators)
        .where(eq(economicIndicators.indicatorCode, indicatorCode))
        .orderBy(desc(economicIndicators.observationDate))
        .all();
      return rows
        .filter((r: { date: string; value: number }) => r.date >= cutoffStr)
        .map((r: { date: string; value: number }) => ({ date: r.date, value: r.value }));
    } catch {
      return [];
    }
  }
}

export const rbaDataFeed = new RbaDataFeed();
