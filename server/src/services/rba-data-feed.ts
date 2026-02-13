/**
 * RBA Data Feed Service
 *
 * Downloads and parses Reserve Bank of Australia statistical CSV tables.
 * 5 key tables: A2 (cash rate), F5 (lending rates), F11 (housing lending),
 * G1 (CPI inflation), H1 (housing price indices).
 *
 * RBA CSV quirks:
 *   - Rows 1-10 are metadata (title, description, frequency, etc.)
 *   - Row 11 is the column-header row
 *   - Data starts at row 12
 *   - Date column format: DD-MMM-YYYY  (e.g. 02-Jan-2026)
 *   - Empty cells for missing observations
 *
 * Caching: 24-hour TTL via in-memory Map + DB upserts into economic_indicators.
 */

import crypto from 'crypto';
import { db, economicIndicators, marketDataFeeds } from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import type {
  EconomicIndicatorRecord,
  RbaFetchResult,
  RbaTableDef,
  RbaTableIndicator,
} from './economic-data-types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const RBA_BASE_URL = 'https://www.rba.gov.au/statistics/tables';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 30_000;

/**
 * 5 key RBA statistical CSV tables and the indicators we extract from each.
 */
const RBA_TABLES: Record<string, RbaTableDef> = {
  A2: {
    url: '/csv/a2-reserve-bank-interest-rates.csv',
    name: 'Reserve Bank Interest Rates',
    indicators: [
      { column: 'Cash Rate Target', code: 'RBA_CASH_RATE', category: 'interest_rates', unit: 'percent' },
      { column: 'Interbank Overnight Cash Rate', code: 'RBA_OVERNIGHT_RATE', category: 'interest_rates', unit: 'percent' },
    ],
  },
  F5: {
    url: '/csv/f5-indicator-lending-rates.csv',
    name: 'Indicator Lending Rates',
    indicators: [
      { column: 'Housing loans; Variable; Standard', code: 'RBA_HOME_LOAN_VARIABLE', category: 'interest_rates', unit: 'percent' },
      { column: 'Housing loans; Variable; Discounted', code: 'RBA_HOME_LOAN_DISCOUNTED', category: 'interest_rates', unit: 'percent' },
      { column: 'Personal loans; Variable', code: 'RBA_PERSONAL_LOAN', category: 'interest_rates', unit: 'percent' },
      { column: 'Term deposits; 1 year', code: 'RBA_TERM_DEPOSIT_1YR', category: 'interest_rates', unit: 'percent' },
    ],
  },
  F11: {
    url: '/csv/f11-housing-lending-rates.csv',
    name: 'Housing Lending Rates',
    indicators: [
      { column: 'Owner-occupier; Variable rate', code: 'RBA_OO_VARIABLE', category: 'interest_rates', unit: 'percent' },
      { column: 'Investor; Variable rate', code: 'RBA_INV_VARIABLE', category: 'interest_rates', unit: 'percent' },
      { column: 'Owner-occupier; Fixed rate; 3 year', code: 'RBA_OO_FIXED_3YR', category: 'interest_rates', unit: 'percent' },
    ],
  },
  G1: {
    url: '/csv/g1-consumer-price-inflation.csv',
    name: 'Consumer Price Inflation',
    indicators: [
      { column: 'All groups CPI; Percentage change; Quarterly', code: 'RBA_CPI_QUARTERLY', category: 'inflation', unit: 'percent' },
      { column: 'All groups CPI; Percentage change; Annual', code: 'RBA_CPI_ANNUAL', category: 'inflation', unit: 'percent' },
      { column: 'Trimmed mean; Percentage change; Annual', code: 'RBA_TRIMMED_MEAN', category: 'inflation', unit: 'percent' },
    ],
  },
  H1: {
    url: '/csv/h1-housing-price-indices.csv',
    name: 'Housing Price Indices',
    indicators: [
      { column: 'Sydney; Percentage change; Quarterly', code: 'RBA_HOUSE_PRICE_SYD_Q', category: 'housing', unit: 'percent' },
      { column: 'Australia; Percentage change; Quarterly', code: 'RBA_HOUSE_PRICE_AU_Q', category: 'housing', unit: 'percent' },
    ],
  },
};

// Month name → 0-based index lookup for DD-MMM-YYYY parsing
const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

// In-memory cache of raw CSV strings (keyed by table key)
const csvCache = new Map<string, { csv: string; fetchedAt: number }>();

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class RbaDataFeed {

  // ---------- Public API ----------

  /**
   * Download a single RBA CSV table (with 24h TTL caching).
   */
  async fetchTable(tableKey: string): Promise<string> {
    const tableDef = RBA_TABLES[tableKey];
    if (!tableDef) throw new Error(`Unknown RBA table key: ${tableKey}`);

    // Check in-memory cache
    const cached = csvCache.get(tableKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.csv;
    }

    const url = `${RBA_BASE_URL}${tableDef.url}`;
    const csv = await this.fetchWithTimeout(url);
    csvCache.set(tableKey, { csv, fetchedAt: Date.now() });
    return csv;
  }

  /**
   * Parse a raw RBA CSV into EconomicIndicatorRecord[].
   * Extracts the most recent observation (and previous for change %) for each
   * configured indicator column in the table definition.
   */
  async parseTable(tableKey: string, csv: string): Promise<EconomicIndicatorRecord[]> {
    const tableDef = RBA_TABLES[tableKey];
    if (!tableDef) throw new Error(`Unknown RBA table key: ${tableKey}`);

    const feedId = await this.ensureFeedEntry(tableKey, tableDef);
    const lines = csv.split('\n');

    // Row 11 (index 10) is the header row; data starts row 12 (index 11).
    // But the exact offset varies — find the header row by looking for "Series ID" or date-like patterns.
    const headerIndex = this.findHeaderRow(lines);
    if (headerIndex < 0) return [];

    const headers = this.parseCsvRow(lines[headerIndex]);
    const dataLines = lines.slice(headerIndex + 1).filter(l => l.trim().length > 0);

    if (dataLines.length === 0) return [];

    const results: EconomicIndicatorRecord[] = [];

    for (const indicator of tableDef.indicators) {
      const colIndex = this.findColumnIndex(headers, indicator.column);
      if (colIndex < 0) continue;

      // Walk backward from end to find most recent non-empty value
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
          break; // We have latest + previous — done for this indicator
        }
      }

      if (latestValue === null) continue;

      const changePct = previousValue !== null && previousValue !== 0
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

  /**
   * Fetch and parse all 5 RBA tables, upsert indicators into DB.
   */
  async fetchAllTables(): Promise<RbaFetchResult> {
    const allIndicators: EconomicIndicatorRecord[] = [];
    const errors: Array<{ table: string; error: string }> = [];
    let tablesProcessed = 0;

    for (const tableKey of Object.keys(RBA_TABLES)) {
      try {
        const csv = await this.fetchTable(tableKey);
        const indicators = await this.parseTable(tableKey, csv);
        for (const ind of indicators) {
          await this.upsertIndicator(ind);
        }
        allIndicators.push(...indicators);
        tablesProcessed++;

        // Update feed last-fetched timestamp
        await this.updateFeedStatus(tableKey, true);
      } catch (err: any) {
        const message = err?.message ?? String(err);
        console.error(`[RBA] Error fetching table ${tableKey}:`, message);
        errors.push({ table: tableKey, error: message });
        await this.updateFeedStatus(tableKey, false, message);
      }
    }

    return { indicators: allIndicators, tablesProcessed, errors };
  }

  /**
   * Convenience: return the current RBA cash rate from DB (or fresh fetch).
   */
  async getCashRate(): Promise<{ rate: number; effectiveDate: string; previousRate: number }> {
    // Try DB first
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
      // Table may not exist — fall through to live fetch
    }

    // Live fetch
    const csv = await this.fetchTable('A2');
    const indicators = await this.parseTable('A2', csv);
    const cashRate = indicators.find(i => i.indicatorCode === 'RBA_CASH_RATE');

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

  /**
   * Return historical values for an indicator code (default last 24 months).
   */
  async getRateHistory(
    indicatorCode: string,
    months = 24,
  ): Promise<Array<{ date: string; value: number }>> {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    try {
      const rows = await db
        .select({
          date: economicIndicators.observationDate,
          value: economicIndicators.value,
        })
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

  // ---------- Internal helpers ----------

  /**
   * Find the header row index in an RBA CSV. Typically row 11 (index 10)
   * but we search for a row that starts with "Series ID" or contains "Title".
   * Fallback: index 10 (the spec default).
   */
  private findHeaderRow(lines: string[]): number {
    // Look in rows 5-15 for a row that looks like a header
    for (let i = 5; i < Math.min(lines.length, 20); i++) {
      const lower = lines[i].toLowerCase();
      if (lower.startsWith('series id') || lower.startsWith('title') || lower.startsWith('date')) {
        return i;
      }
    }
    // Fallback: row 11 (0-based index 10) per RBA convention
    return lines.length > 11 ? 10 : -1;
  }

  /**
   * Parse a single CSV row, handling quoted fields that may contain commas.
   */
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

  /**
   * Find the column index for an indicator. Uses substring matching because
   * RBA header labels may include extra whitespace or slightly different wording.
   */
  private findColumnIndex(headers: string[], targetColumn: string): number {
    const target = targetColumn.toLowerCase().trim();
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase().trim();
      if (header === target || header.includes(target)) {
        return i;
      }
    }
    // Try the reverse: does the target contain the header?
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase().trim();
      if (header.length > 5 && target.includes(header)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Parse RBA date format DD-MMM-YYYY (e.g. "02-Jan-2026") → ISO date string.
   */
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

  /**
   * Infer data frequency from the table key.
   */
  private inferFrequency(tableKey: string): string {
    switch (tableKey) {
      case 'A2': return 'daily';
      case 'F5': return 'monthly';
      case 'F11': return 'monthly';
      case 'G1': return 'quarterly';
      case 'H1': return 'quarterly';
      default: return 'monthly';
    }
  }

  /**
   * Ensure a market_data_feeds entry exists for this RBA table; return its id.
   */
  private async ensureFeedEntry(tableKey: string, tableDef: RbaTableDef): Promise<string> {
    const feedId = `rba-${tableKey.toLowerCase()}`;
    try {
      const existing = await db
        .select()
        .from(marketDataFeeds)
        .where(eq(marketDataFeeds.id, feedId))
        .all();

      if (existing.length === 0) {
        await db.insert(marketDataFeeds).values({
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
        }).run();
      }
    } catch {
      // If table doesn't exist yet, silently continue
    }
    return feedId;
  }

  /**
   * Upsert an indicator record into the economic_indicators table.
   * Uses select → delete + insert pattern (safe for PG proxy).
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
        // Update in place
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
        await db.insert(economicIndicators).values({
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
        }).run();
      }
    } catch (err) {
      console.error(`[RBA] Failed to upsert indicator ${ind.indicatorCode}:`, err);
    }
  }

  /**
   * Update a feed's last-fetched status in market_data_feeds.
   */
  private async updateFeedStatus(tableKey: string, success: boolean, error?: string): Promise<void> {
    const feedId = `rba-${tableKey.toLowerCase()}`;
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
      // Non-critical — silently continue
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
          Accept: 'text/csv,text/plain,*/*',
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

export const rbaDataFeed = new RbaDataFeed();
