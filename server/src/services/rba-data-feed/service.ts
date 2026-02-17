/**
 * RBA Data Feed Service
 *
 * Downloads and parses Reserve Bank of Australia statistical CSV tables.
 */

import crypto from 'crypto';
import { db, economicIndicators, marketDataFeeds } from '../../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';
import type { EconomicIndicatorRecord, RbaFetchResult } from '../economic-data-types.js';
import {
  RBA_BASE_URL,
  CACHE_TTL_MS,
  FETCH_TIMEOUT_MS,
  RBA_TABLES,
  MONTH_MAP,
  csvCache,
} from './constants.js';

export class RbaDataFeed {
  async fetchTable(tableKey: string): Promise<string> {
    const tableDef = RBA_TABLES[tableKey];
    if (!tableDef) throw new Error(`Unknown RBA table key: ${tableKey}`);
    const cached = csvCache.get(tableKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.csv;
    const url = `${RBA_BASE_URL}${tableDef.url}`;
    const csv = await this.fetchWithTimeout(url);
    csvCache.set(tableKey, { csv, fetchedAt: Date.now() });
    return csv;
  }

  async parseTable(tableKey: string, csv: string): Promise<EconomicIndicatorRecord[]> {
    const tableDef = RBA_TABLES[tableKey];
    if (!tableDef) throw new Error(`Unknown RBA table key: ${tableKey}`);
    const feedId = await this.ensureFeedEntry(tableKey, tableDef);
    const lines = csv.split('\n');
    const headerIndex = this.findHeaderRow(lines);
    if (headerIndex < 0) return [];
    const headers = this.parseCsvRow(lines[headerIndex]);
    const dataLines = lines.slice(headerIndex + 1).filter((l) => l.trim().length > 0);
    if (dataLines.length === 0) return [];

    const results: EconomicIndicatorRecord[] = [];
    for (const indicator of tableDef.indicators) {
      const colIndex = this.findColumnIndex(headers, indicator.column);
      if (colIndex < 0) continue;
      let latestValue: number | null = null;
      let latestDate = '';
      let previousValue: number | null = null;

      for (let i = dataLines.length - 1; i >= 0; i--) {
        const row = this.parseCsvRow(dataLines[i]);
        const dateStr = row[0]?.trim();
        const cellValue = row[colIndex]?.trim();
        if (!cellValue || cellValue === '') continue;
        const numVal = parseFloat(cellValue);
        if (isNaN(numVal)) continue;
        if (latestValue === null) {
          latestValue = numVal;
          latestDate = this.parseRbaDate(dateStr);
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
        frequency: this.inferFrequency(tableKey),
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
        for (const ind of indicators) await this.upsertIndicator(ind);
        allIndicators.push(...indicators);
        tablesProcessed++;
        await this.updateFeedStatus(tableKey, true);
      } catch (err: any) {
        const message = err?.message ?? String(err);
        logger.error({ err: message }, `[RBA] Error fetching table ${tableKey}:`);
        errors.push({ table: tableKey, error: message });
        await this.updateFeedStatus(tableKey, false, message);
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
      await this.upsertIndicator(cashRate);
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

  // --- Internal helpers ---

  private findHeaderRow(lines: string[]): number {
    for (let i = 5; i < Math.min(lines.length, 20); i++) {
      const lower = lines[i].toLowerCase();
      if (lower.startsWith('series id') || lower.startsWith('title') || lower.startsWith('date'))
        return i;
    }
    return lines.length > 11 ? 10 : -1;
  }

  private parseCsvRow(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  private findColumnIndex(headers: string[], targetColumn: string): number {
    const target = targetColumn.toLowerCase().trim();
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase().trim();
      if (header === target || header.includes(target)) return i;
    }
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase().trim();
      if (header.length > 5 && target.includes(header)) return i;
    }
    return -1;
  }

  private parseRbaDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString().slice(0, 10);
    const parts = dateStr.trim().split('-');
    if (parts.length !== 3) return dateStr;
    const day = parseInt(parts[0], 10);
    const monthIdx = MONTH_MAP[parts[1]];
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || monthIdx === undefined || isNaN(year)) return dateStr;
    const d = new Date(year, monthIdx, day);
    return d.toISOString().slice(0, 10);
  }

  private inferFrequency(tableKey: string): string {
    switch (tableKey) {
      case 'A2':
        return 'daily';
      case 'F5':
      case 'F11':
        return 'monthly';
      case 'G1':
      case 'H1':
        return 'quarterly';
      default:
        return 'monthly';
    }
  }

  private async ensureFeedEntry(
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
            refreshFrequency: this.inferFrequency(tableKey) === 'daily' ? 'daily' : 'weekly',
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
      logger.error({ err: err }, `[RBA] Failed to upsert indicator ${ind.indicatorCode}:`);
    }
  }

  private async updateFeedStatus(
    tableKey: string,
    success: boolean,
    error?: string,
  ): Promise<void> {
    const feedId = `rba-${tableKey.toLowerCase()}`;
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
          Accept: 'text/csv,text/plain,*/*',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const rbaDataFeed = new RbaDataFeed();
