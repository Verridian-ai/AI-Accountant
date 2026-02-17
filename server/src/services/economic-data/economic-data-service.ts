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

import { rbaDataFeed, RbaDataFeed } from '../rba-data-feed.js';
import { absDataFeed, AbsDataFeed } from '../abs-data-feed.js';
import type { EconomicSnapshot as EnhancedEconomicSnapshot } from '../economic-data-types.js';
import { getEnhancedEconomicSnapshot } from './enhanced-snapshot.js';
import type {
  CashRateData,
  LendingRateData,
  CPIData,
  UnemploymentData,
  EconomicSnapshot,
} from './types.js';
import { FETCH_TIMEOUT_MS, TTL, URLS } from './types.js';
import { getFromCache, setCache, fetchWithTimeout } from './cache.js';

export class EconomicDataService {
  // ---------- Public API ----------

  /**
   * Fetch current RBA cash rate.
   * Tries live fetch -> falls back to cache.
   */
  async fetchRBACashRate(): Promise<CashRateData | null> {
    const cacheKey = 'rba_cash_rate';
    const cached = await getFromCache(cacheKey);
    if (cached) return cached as CashRateData;

    try {
      const html = await fetchWithTimeout(URLS.RBA_CASH_RATE, FETCH_TIMEOUT_MS);

      // Parse the RBA cash rate page for the current rate
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

        await setCache(cacheKey, data, TTL.RBA);
        return data;
      }

      return (await getFromCache(cacheKey, true)) as CashRateData | null;
    } catch {
      return (await getFromCache(cacheKey, true)) as CashRateData | null;
    }
  }

  /**
   * Fetch average lending rates from RBA statistical tables.
   */
  async fetchLendingRates(): Promise<LendingRateData | null> {
    const cacheKey = 'rba_lending_rates';
    const cached = await getFromCache(cacheKey);
    if (cached) return cached as LendingRateData;

    try {
      const csv = await fetchWithTimeout(URLS.RBA_INDICATOR_LENDING, FETCH_TIMEOUT_MS);

      // Parse RBA F5 CSV -- indicator lending rates
      const lines = csv.trim().split('\n');
      const dataLines = lines.filter((l) => /^\d{4}-\d{2}/.test(l.trim()));
      const lastLine = dataLines[dataLines.length - 1];

      if (lastLine) {
        const parts = lastLine.split(',').map((p) => p.trim());
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

        await setCache(cacheKey, data, TTL.RBA);
        return data;
      }

      return (await getFromCache(cacheKey, true)) as LendingRateData | null;
    } catch {
      return (await getFromCache(cacheKey, true)) as LendingRateData | null;
    }
  }

  /**
   * Fetch latest CPI data from ABS.
   */
  async fetchCPI(): Promise<CPIData | null> {
    const cacheKey = 'abs_cpi';
    const cached = await getFromCache(cacheKey);
    if (cached) return cached as CPIData;

    try {
      const html = await fetchWithTimeout(URLS.ABS_CPI, FETCH_TIMEOUT_MS);

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
        await setCache(cacheKey, data, TTL.ABS);
        return data;
      }

      return (await getFromCache(cacheKey, true)) as CPIData | null;
    } catch {
      return (await getFromCache(cacheKey, true)) as CPIData | null;
    }
  }

  /**
   * Fetch latest unemployment rate from ABS labour force data.
   */
  async fetchUnemploymentRate(): Promise<UnemploymentData | null> {
    const cacheKey = 'abs_unemployment';
    const cached = await getFromCache(cacheKey);
    if (cached) return cached as UnemploymentData;

    try {
      const html = await fetchWithTimeout(URLS.ABS_LABOUR_FORCE, FETCH_TIMEOUT_MS);

      const rateMatch = html.match(/unemployment\s*rate[:\s]*(\d+\.\d+)\s*%/i);
      const participationMatch = html.match(/participation\s*rate[:\s]*(\d+\.\d+)\s*%/i);
      const employedMatch = html.match(
        /employed\s*persons?[:\s]*([\d,]+(?:\.\d+)?)\s*(?:thousand|million)/i,
      );
      const periodMatch = html.match(
        /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
      );

      const data: UnemploymentData = {
        rate: rateMatch ? parseFloat(rateMatch[1]) : 0,
        participationRate: participationMatch ? parseFloat(participationMatch[1]) : 0,
        employedPersons: employedMatch ? parseFloat(employedMatch[1].replace(/,/g, '')) : 0,
        period: periodMatch ? periodMatch[1] : 'Unknown',
        source: 'ABS Labour Force Australia',
        fetchedAt: new Date().toISOString(),
      };

      if (data.rate > 0) {
        await setCache(cacheKey, data, TTL.ABS);
        return data;
      }

      return (await getFromCache(cacheKey, true)) as UnemploymentData | null;
    } catch {
      return (await getFromCache(cacheKey, true)) as UnemploymentData | null;
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

  /**
   * Enhanced economic snapshot combining structured RBA CSV data + ABS SDMX data.
   * Falls back to the legacy HTML-scraping snapshot if the structured feeds fail.
   */
  async getEnhancedEconomicSnapshot(): Promise<EnhancedEconomicSnapshot> {
    return getEnhancedEconomicSnapshot();
  }

  /** Access to the RBA data feed service */
  get rba(): RbaDataFeed {
    return rbaDataFeed;
  }

  /** Access to the ABS data feed service */
  get abs(): AbsDataFeed {
    return absDataFeed;
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
      rba:
        rbaResult.status === 'fulfilled'
          ? { tablesProcessed: rbaResult.value.tablesProcessed, errors: rbaResult.value.errors }
          : {
              tablesProcessed: 0,
              errors: [
                {
                  table: '*',
                  error: (rbaResult as PromiseRejectedResult).reason?.message ?? 'Unknown error',
                },
              ],
            },
      abs:
        absResult.status === 'fulfilled'
          ? {
              dataflowsProcessed: absResult.value.dataflowsProcessed,
              errors: absResult.value.errors,
            }
          : {
              dataflowsProcessed: 0,
              errors: [
                {
                  dataflow: '*',
                  error: (absResult as PromiseRejectedResult).reason?.message ?? 'Unknown error',
                },
              ],
            },
    };
  }
}

export const economicDataService = new EconomicDataService();
