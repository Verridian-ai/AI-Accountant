/**
 * Economic Data Service Types and Constants
 */

export interface CashRateData {
  currentRate: number; // decimal, e.g. 0.0435 for 4.35%
  effectiveDate: string; // ISO date
  previousRate: number;
  previousDate: string;
  source: string;
  fetchedAt: string;
}

export interface LendingRateData {
  averageHomeLoanRate: number; // decimal
  averageFixedRate: number; // decimal
  averageVariableRate: number; // decimal
  averageInvestorRate: number; // decimal
  source: string;
  fetchedAt: string;
}

export interface CPIData {
  currentIndex: number;
  annualChange: number; // percentage, e.g. 3.4
  quarterlyChange: number; // percentage
  period: string; // e.g. "Dec 2025"
  source: string;
  fetchedAt: string;
}

export interface UnemploymentData {
  rate: number; // percentage, e.g. 4.1
  participationRate: number; // percentage
  employedPersons: number; // thousands
  period: string; // e.g. "Jan 2026"
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

export interface CacheEntry {
  key: string;
  data: string; // JSON
  fetchedAt: string; // ISO datetime
  expiresAt: string; // ISO datetime
}

export const FETCH_TIMEOUT_MS = 15_000;

/** TTL in milliseconds */
export const TTL = {
  RBA: 24 * 60 * 60 * 1000, // 24 hours
  ABS: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

/** Known public data source URLs */
export const URLS = {
  RBA_CASH_RATE: 'https://www.rba.gov.au/statistics/cash-rate/',
  RBA_INDICATOR_LENDING: 'https://www.rba.gov.au/statistics/tables/csv/f5-data.csv',
  ABS_CPI:
    'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release',
  ABS_LABOUR_FORCE:
    'https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release',
} as const;
