import type { AbsDataflowDef } from '../economic-data/enhanced-types.js';

export const ABS_BASE_URL = 'https://data.api.abs.gov.au';
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const FETCH_TIMEOUT_MS = 30_000;
export const RATE_LIMIT_DELAY_MS = 700; // ~85 req/min, safely under 100

/**
 * 5 key ABS SDMX dataflows.
 * `key` is the dimension filter string passed in the URL path.
 */
export const ABS_DATAFLOWS: Record<string, AbsDataflowDef> = {
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

/** In-memory cache of parsed SDMX responses */
export const sdmxCache = new Map<string, { data: unknown; fetchedAt: number }>();

/** Timestamp of last ABS API request (for rate limiting) */
export let lastRequestAt = 0;
export function setLastRequestAt(ts: number) {
  lastRequestAt = ts;
}
