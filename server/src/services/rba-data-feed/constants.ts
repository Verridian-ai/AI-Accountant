import type { RbaTableDef } from '../economic-data/enhanced-types.js';

export const RBA_BASE_URL = 'https://www.rba.gov.au/statistics/tables';
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const FETCH_TIMEOUT_MS = 30_000;

/**
 * 5 key RBA statistical CSV tables and the indicators we extract from each.
 */
export const RBA_TABLES: Record<string, RbaTableDef> = {
  A2: {
    url: '/csv/a2-reserve-bank-interest-rates.csv',
    name: 'Reserve Bank Interest Rates',
    indicators: [
      {
        column: 'Cash Rate Target',
        code: 'RBA_CASH_RATE',
        category: 'interest_rates',
        unit: 'percent',
      },
      {
        column: 'Interbank Overnight Cash Rate',
        code: 'RBA_OVERNIGHT_RATE',
        category: 'interest_rates',
        unit: 'percent',
      },
    ],
  },
  F5: {
    url: '/csv/f5-indicator-lending-rates.csv',
    name: 'Indicator Lending Rates',
    indicators: [
      {
        column: 'Housing loans; Variable; Standard',
        code: 'RBA_HOME_LOAN_VARIABLE',
        category: 'interest_rates',
        unit: 'percent',
      },
      {
        column: 'Housing loans; Variable; Discounted',
        code: 'RBA_HOME_LOAN_DISCOUNTED',
        category: 'interest_rates',
        unit: 'percent',
      },
      {
        column: 'Personal loans; Variable',
        code: 'RBA_PERSONAL_LOAN',
        category: 'interest_rates',
        unit: 'percent',
      },
      {
        column: 'Term deposits; 1 year',
        code: 'RBA_TERM_DEPOSIT_1YR',
        category: 'interest_rates',
        unit: 'percent',
      },
    ],
  },
  F11: {
    url: '/csv/f11-housing-lending-rates.csv',
    name: 'Housing Lending Rates',
    indicators: [
      {
        column: 'Owner-occupier; Variable rate',
        code: 'RBA_OO_VARIABLE',
        category: 'interest_rates',
        unit: 'percent',
      },
      {
        column: 'Investor; Variable rate',
        code: 'RBA_INV_VARIABLE',
        category: 'interest_rates',
        unit: 'percent',
      },
      {
        column: 'Owner-occupier; Fixed rate; 3 year',
        code: 'RBA_OO_FIXED_3YR',
        category: 'interest_rates',
        unit: 'percent',
      },
    ],
  },
  G1: {
    url: '/csv/g1-consumer-price-inflation.csv',
    name: 'Consumer Price Inflation',
    indicators: [
      {
        column: 'All groups CPI; Percentage change; Quarterly',
        code: 'RBA_CPI_QUARTERLY',
        category: 'inflation',
        unit: 'percent',
      },
      {
        column: 'All groups CPI; Percentage change; Annual',
        code: 'RBA_CPI_ANNUAL',
        category: 'inflation',
        unit: 'percent',
      },
      {
        column: 'Trimmed mean; Percentage change; Annual',
        code: 'RBA_TRIMMED_MEAN',
        category: 'inflation',
        unit: 'percent',
      },
    ],
  },
  H1: {
    url: '/csv/h1-housing-price-indices.csv',
    name: 'Housing Price Indices',
    indicators: [
      {
        column: 'Sydney; Percentage change; Quarterly',
        code: 'RBA_HOUSE_PRICE_SYD_Q',
        category: 'housing',
        unit: 'percent',
      },
      {
        column: 'Australia; Percentage change; Quarterly',
        code: 'RBA_HOUSE_PRICE_AU_Q',
        category: 'housing',
        unit: 'percent',
      },
    ],
  },
};

/** Month name to 0-based index lookup for DD-MMM-YYYY parsing */
export const MONTH_MAP: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

/** In-memory cache of raw CSV strings (keyed by table key) */
export const csvCache = new Map<string, { csv: string; fetchedAt: number }>();
