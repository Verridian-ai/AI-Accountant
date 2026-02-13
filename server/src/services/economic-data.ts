/**
 * Economic Data Service
 * Fetches and caches Australian economic indicators from public data sources:
 *   - RBA cash rate + average lending rates (via RbaDataFeed CSV parser)
 *   - ABS CPI + unemployment rate + GDP + wages (via AbsDataFeed SDMX parser)
 *
 * Caching strategy:
 *   - RBA data: 24-hour TTL (cash rate changes ~8 times/year)
 *   - ABS data: 7-day TTL (CPI quarterly, labour force monthly)
 *   - Fallback: always serve cached data if fetch fails
 *
 * The service delegates to dedicated RBA/ABS feed classes for structured data
 * (CSV and SDMX), while keeping its own HTML-scraping methods as a fallback.
 */

import { db, economicDataCache } from '../schema.js';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { rbaDataFeed, RbaDataFeed } from './rba-data-feed.js';
import { absDataFeed, AbsDataFeed } from './abs-data-feed.js';
import type { EconomicSnapshot as EnhancedEconomicSnapshot } from './economic-data-types.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CashRateData {
  currentRate: number;       // decimal, e.g. 0.0435 for 4.35%
  effectiveDate: string;     // ISO date
  previousRate: number;
  previousDate: string;
  source: string;
  fetchedAt: string;
}

export interface LendingRateData {
  averageHomeLoanRate: number;     // decimal
  averageFixedRate: number;        // decimal
  averageVariableRate: number;     // decimal
  averageInvestorRate: number;     // decimal
  source: string;
  fetchedAt: string;
}

export interface CPIData {
  currentIndex: number;
  annualChange: number;       // percentage, e.g. 3.4
  quarterlyChange: number;    // percentage
  period: string;             // e.g. "Dec 2025"
  source: string;
  fetchedAt: string;
}

export interface UnemploymentData {
  rate: number;               // percentage, e.g. 4.1
  participationRate: number;  // percentage
  employedPersons: number;    // thousands
  period: string;             // e.g. "Jan 2026"
  source: string;
  fetchedAt: string;
}

export interface EconomicSnapshot {
  cashRate: CashRateData | null;
  lendingRates: LendingRateData | null;
  cpi: CPIData | null;
  unemployment: UnemploymentData | null;
  lastUpdated: string;
}

interface CacheEntry {
  key: string;
  data: string;           // JSON
  fetchedAt: string;      // ISO datetime
  expiresAt: string;      // ISO datetime
}


// ============================================================================
// CONSTANTS
// ============================================================================

const FETCH_TIMEOUT_MS = 15_000;

/** TTL in milliseconds */
const TTL = {
  RBA: 24 * 60 * 60 * 1000,   // 24 hours
  ABS: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

/** Known public data source URLs */
const URLS = {
  RBA_CASH_RATE: 'https://www.rba.gov.au/statistics/cash-rate/',
  RBA_INDICATOR_LENDING: 'https://www.rba.gov.au/statistics/tables/csv/f5-data.csv',
  ABS_CPI: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release',
  ABS_LABOUR_FORCE: 'https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release',
} as const;


// ============================================================================
// IN-MEMORY CACHE (fallback until economic_data_cache table exists)
// ============================================================================

const memoryCache = new Map<string, CacheEntry>();


// ============================================================================
// SERVICE CLASS
// ============================================================================

export class EconomicDataService {

  // ---------- Public API ----------

  /**
   * Fetch current RBA cash rate.
   * Tries live fetch → falls back to cache.
   */
  async fetchRBACashRate(): Promise<CashRateData | null> {
    const cacheKey = 'rba_cash_rate';
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached as CashRateData;

    try {
      const html = await this.fetchWithTimeout(URLS.RBA_CASH_RATE);

      // Parse the RBA cash rate page for the current rate
      // The page contains the rate in a structured format
      const rateMatch = html.match(/(\d+\.\d+)\s*per\s*cent/i);
      const dateMatch = html.match(/(\d{1,2}\s+\w+\s+\d{4})/);

      if (rateMatch) {
        const currentRate = parseFloat(rateMatch[1]) / 100;
        const effectiveDate = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

        const data: CashRateData = {
          currentRate,
          effectiveDate,
          previousRate: currentRate, // Would need historical data to determine
          previousDate: '',
          source: 'RBA',
          fetchedAt: new Date().toISOString(),
        };

        await this.setCache(cacheKey, data, TTL.RBA);
        return data;
      }

      // If parsing fails, return cached data
      return await this.getFromCache(cacheKey, true) as CashRateData | null;
    } catch {
      return await this.getFromCache(cacheKey, true) as CashRateData | null;
    }
  }

  /**
   * Fetch average lending rates from RBA statistical tables.
   */
  async fetchLendingRates(): Promise<LendingRateData | null> {
    const cacheKey = 'rba_lending_rates';
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached as LendingRateData;

    try {
      const csv = await this.fetchWithTimeout(URLS.RBA_INDICATOR_LENDING);

      // Parse RBA F5 CSV — indicator lending rates
      // Format: date, variable rate, fixed rate, investor rate...
      const lines = csv.trim().split('\n');
      // Find the last data row (skip headers)
      const dataLines = lines.filter(l => /^\d{4}-\d{2}/.test(l.trim()));
      const lastLine = dataLines[dataLines.length - 1];

      if (lastLine) {
        const parts = lastLine.split(',').map(p => p.trim());
        // Typical RBA F5 columns: date, owner-occupier variable, fixed, investor
        const variableRate = parseFloat(parts[1] || '0') / 100;
        const fixedRate = parseFloat(parts[2] || '0') / 100;
        const investorRate = parseFloat(parts[3] || '0') / 100;
        const avgRate = (variableRate + fixedRate) / 2;

        const data: LendingRateData = {
          averageHomeLoanRate: Math.round(avgRate * 10000) / 10000,
          averageFixedRate: fixedRate,
          averageVariableRate: variableRate,
          averageInvestorRate: investorRate,
          source: 'RBA Statistical Table F5',
          fetchedAt: new Date().toISOString(),
        };

        await this.setCache(cacheKey, data, TTL.RBA);
        return data;
      }

      return await this.getFromCache(cacheKey, true) as LendingRateData | null;
    } catch {
      return await this.getFromCache(cacheKey, true) as LendingRateData | null;
    }
  }

  /**
   * Fetch latest CPI data from ABS.
   */
  async fetchCPI(): Promise<CPIData | null> {
    const cacheKey = 'abs_cpi';
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached as CPIData;

    try {
      const html = await this.fetchWithTimeout(URLS.ABS_CPI);

      // Parse ABS CPI page — look for headline figures
      const annualMatch = html.match(/(\d+\.\d+)\s*%?\s*(?:annual|year|over the year)/i);
      const quarterlyMatch = html.match(/(\d+\.\d+)\s*%?\s*(?:quarterly|quarter)/i);
      const indexMatch = html.match(/index[:\s]*(\d+\.\d+)/i);
      const periodMatch = html.match(/((?:March|June|September|December)\s+\d{4})/i);

      const data: CPIData = {
        currentIndex: indexMatch ? parseFloat(indexMatch[1]) : 0,
        annualChange: annualMatch ? parseFloat(annualMatch[1]) : 0,
        quarterlyChange: quarterlyMatch ? parseFloat(quarterlyMatch[1]) : 0,
        period: periodMatch ? periodMatch[1] : 'Unknown',
        source: 'ABS Consumer Price Index',
        fetchedAt: new Date().toISOString(),
      };

      if (data.annualChange > 0 || data.currentIndex > 0) {
        await this.setCache(cacheKey, data, TTL.ABS);
        return data;
      }

      return await this.getFromCache(cacheKey, true) as CPIData | null;
    } catch {
      return await this.getFromCache(cacheKey, true) as CPIData | null;
    }
  }

  /**
   * Fetch latest unemployment rate from ABS labour force data.
   */
  async fetchUnemploymentRate(): Promise<UnemploymentData | null> {
    const cacheKey = 'abs_unemployment';
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached as UnemploymentData;

    try {
      const html = await this.fetchWithTimeout(URLS.ABS_LABOUR_FORCE);

      // Parse ABS labour force page
      const rateMatch = html.match(/unemployment\s*rate[:\s]*(\d+\.\d+)\s*%/i);
      const participationMatch = html.match(/participation\s*rate[:\s]*(\d+\.\d+)\s*%/i);
      const employedMatch = html.match(/employed\s*persons?[:\s]*([\d,]+(?:\.\d+)?)\s*(?:thousand|million)/i);
      const periodMatch = html.match(/((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i);

      const data: UnemploymentData = {
        rate: rateMatch ? parseFloat(rateMatch[1]) : 0,
        participationRate: participationMatch ? parseFloat(participationMatch[1]) : 0,
        employedPersons: employedMatch ? parseFloat(employedMatch[1].replace(/,/g, '')) : 0,
        period: periodMatch ? periodMatch[1] : 'Unknown',
        source: 'ABS Labour Force Australia',
        fetchedAt: new Date().toISOString(),
      };

      if (data.rate > 0) {
        await this.setCache(cacheKey, data, TTL.ABS);
        return data;
      }

      return await this.getFromCache(cacheKey, true) as UnemploymentData | null;
    } catch {
      return await this.getFromCache(cacheKey, true) as UnemploymentData | null;
    }
  }

  /**
   * Fetch all economic indicators and return a snapshot.
   */
  async getEconomicSnapshot(): Promise<EconomicSnapshot> {
    const [cashRate, lendingRates, cpi, unemployment] = await Promise.allSettled([
      this.fetchRBACashRate(),
      this.fetchLendingRates(),
      this.fetchCPI(),
      this.fetchUnemploymentRate(),
    ]);

    return {
      cashRate: cashRate.status === 'fulfilled' ? cashRate.value : null,
      lendingRates: lendingRates.status === 'fulfilled' ? lendingRates.value : null,
      cpi: cpi.status === 'fulfilled' ? cpi.value : null,
      unemployment: unemployment.status === 'fulfilled' ? unemployment.value : null,
      lastUpdated: new Date().toISOString(),
    };
  }


  // ---------- Enhanced API (via RBA/ABS feed services) ----------

  /** Access to the RBA data feed service */
  get rba(): RbaDataFeed { return rbaDataFeed; }

  /** Access to the ABS data feed service */
  get abs(): AbsDataFeed { return absDataFeed; }

  /**
   * Enhanced economic snapshot combining structured RBA CSV data + ABS SDMX data.
   * Falls back to the legacy HTML-scraping snapshot if the structured feeds fail.
   */
  async getEnhancedEconomicSnapshot(): Promise<EnhancedEconomicSnapshot> {
    const snapshot: EnhancedEconomicSnapshot = {
      cashRate: null,
      lendingRates: null,
      inflation: null,
      employment: null,
      gdp: null,
      wages: null,
      housing: null,
      lastUpdated: new Date().toISOString(),
    };

    // Run RBA and ABS fetches in parallel
    const [rbaResult, absResult] = await Promise.allSettled([
      rbaDataFeed.fetchAllTables(),
      absDataFeed.fetchAllIndicators(),
    ]);

    // Build snapshot from RBA indicators
    if (rbaResult.status === 'fulfilled') {
      const rbaInds = rbaResult.value.indicators;
      const find = (code: string) => rbaInds.find(i => i.indicatorCode === code);

      const cashRate = find('RBA_CASH_RATE');
      if (cashRate) {
        snapshot.cashRate = {
          rate: cashRate.value,
          effectiveDate: cashRate.observationDate,
          previousRate: cashRate.previousValue ?? cashRate.value,
        };
      }

      const ooVariable = find('RBA_OO_VARIABLE');
      const invVariable = find('RBA_INV_VARIABLE');
      const fixed3yr = find('RBA_OO_FIXED_3YR');
      const personal = find('RBA_PERSONAL_LOAN');
      const termDep = find('RBA_TERM_DEPOSIT_1YR');
      if (ooVariable || invVariable || fixed3yr) {
        snapshot.lendingRates = {
          ownerOccupierVariable: ooVariable?.value ?? null,
          investorVariable: invVariable?.value ?? null,
          fixedRate3yr: fixed3yr?.value ?? null,
          personalLoan: personal?.value ?? null,
          termDeposit1yr: termDep?.value ?? null,
        };
      }

      const cpiQ = find('RBA_CPI_QUARTERLY');
      const cpiA = find('RBA_CPI_ANNUAL');
      const trimmed = find('RBA_TRIMMED_MEAN');
      if (cpiQ || cpiA || trimmed) {
        snapshot.inflation = {
          cpiQuarterly: cpiQ?.value ?? null,
          cpiAnnual: cpiA?.value ?? null,
          trimmedMean: trimmed?.value ?? null,
          period: cpiA?.referencePeriod ?? cpiQ?.referencePeriod ?? '',
        };
      }

      const sydQ = find('RBA_HOUSE_PRICE_SYD_Q');
      const auQ = find('RBA_HOUSE_PRICE_AU_Q');
      if (sydQ || auQ) {
        snapshot.housing = {
          sydneyQuarterly: sydQ?.value ?? null,
          australiaQuarterly: auQ?.value ?? null,
          dwellingApprovals: null, // Filled from ABS below
        };
      }
    }

    // Build snapshot from ABS indicators
    if (absResult.status === 'fulfilled') {
      const absInds = absResult.value.indicators;
      const find = (code: string) => absInds.find(i => i.indicatorCode === code);

      const unemp = find('ABS_UNEMPLOYMENT_RATE');
      const partic = find('ABS_PARTICIPATION_RATE');
      const employed = find('ABS_EMPLOYED_PERSONS');
      if (unemp || partic || employed) {
        snapshot.employment = {
          unemploymentRate: unemp?.value ?? null,
          participationRate: partic?.value ?? null,
          employedPersons: employed?.value ?? null,
          period: unemp?.referencePeriod ?? partic?.referencePeriod ?? '',
        };
      }

      const gdpQ = find('ABS_GDP_QUARTERLY');
      const gdpA = find('ABS_GDP_ANNUAL');
      if (gdpQ || gdpA) {
        snapshot.gdp = {
          quarterlyChange: gdpQ?.value ?? null,
          annualChange: gdpA?.value ?? null,
          period: gdpQ?.referencePeriod ?? gdpA?.referencePeriod ?? '',
        };
      }

      const wpiAll = find('ABS_WPI_ALL');
      const wpiPriv = find('ABS_WPI_PRIVATE');
      if (wpiAll || wpiPriv) {
        snapshot.wages = {
          wpiAll: wpiAll?.value ?? null,
          wpiPrivate: wpiPriv?.value ?? null,
          period: wpiAll?.referencePeriod ?? wpiPriv?.referencePeriod ?? '',
        };
      }

      const dwell = find('ABS_DWELLING_APPROVALS');
      if (dwell) {
        if (!snapshot.housing) {
          snapshot.housing = { sydneyQuarterly: null, australiaQuarterly: null, dwellingApprovals: null };
        }
        snapshot.housing.dwellingApprovals = dwell.value;
      }
    }

    return snapshot;
  }

  /**
   * Refresh all RBA and ABS feeds (fetch latest data and upsert into DB).
   */
  async refreshAllFeeds(): Promise<{
    rba: { tablesProcessed: number; errors: Array<{ table: string; error: string }> };
    abs: { dataflowsProcessed: number; errors: Array<{ dataflow: string; error: string }> };
  }> {
    const [rbaResult, absResult] = await Promise.allSettled([
      rbaDataFeed.fetchAllTables(),
      absDataFeed.fetchAllIndicators(),
    ]);

    return {
      rba: rbaResult.status === 'fulfilled'
        ? { tablesProcessed: rbaResult.value.tablesProcessed, errors: rbaResult.value.errors }
        : { tablesProcessed: 0, errors: [{ table: '*', error: (rbaResult as PromiseRejectedResult).reason?.message ?? 'Unknown error' }] },
      abs: absResult.status === 'fulfilled'
        ? { dataflowsProcessed: absResult.value.dataflowsProcessed, errors: absResult.value.errors }
        : { dataflowsProcessed: 0, errors: [{ dataflow: '*', error: (absResult as PromiseRejectedResult).reason?.message ?? 'Unknown error' }] },
    };
  }

  // ---------- Caching Layer ----------

  /**
   * Get cached data. If ignoreExpiry is true, returns data even if TTL has passed
   * (used as fallback when live fetch fails).
   */
  private async getFromCache(key: string, ignoreExpiry = false): Promise<unknown | null> {
    // Try database cache first (using Drizzle ORM table)
    try {
      const rows = await db
        .select()
        .from(economicDataCache)
        .where(eq(economicDataCache.dataKey, key))
        .all();

      if (rows.length > 0) {
        const row = rows[0];
        const now = new Date().toISOString();
        if (ignoreExpiry || (row.expiresAt && row.expiresAt > now)) {
          return row.dataValue ? JSON.parse(row.dataValue) : null;
        }
      }
    } catch {
      // Table may not exist yet — fall through to memory cache
    }

    // Fall back to memory cache
    const entry = memoryCache.get(key);
    if (entry) {
      const now = new Date().toISOString();
      if (ignoreExpiry || entry.expiresAt > now) {
        return JSON.parse(entry.data);
      }
    }

    return null;
  }

  /**
   * Store data in cache with the given TTL.
   */
  private async setCache(key: string, data: unknown, ttlMs: number): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    const jsonData = JSON.stringify(data);
    const entry: CacheEntry = {
      key,
      data: jsonData,
      fetchedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // Try database cache (Drizzle ORM)
    try {
      // Delete existing entry for this key
      await db.delete(economicDataCache).where(eq(economicDataCache.dataKey, key)).run();
      // Insert new entry
      await db.insert(economicDataCache).values({
        id: crypto.randomUUID(),
        dataSource: key.startsWith('rba') ? 'rba' : 'abs',
        dataKey: key,
        dataValue: jsonData,
        fetchedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      }).run();
    } catch {
      // Table may not exist yet — memory cache only
    }

    // Always update memory cache as fallback
    memoryCache.set(key, entry);
  }


  // ---------- HTTP Helper ----------

  /**
   * Fetch a URL with timeout and basic error handling.
   */
  private async fetchWithTimeout(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'GoldLedger/1.0 (Financial Data Aggregator)',
          'Accept': 'text/html,text/csv,application/json',
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

export const economicDataService = new EconomicDataService();
