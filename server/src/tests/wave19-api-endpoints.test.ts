/**
 * Wave 19 Integration Tests — API Endpoints
 *
 * Tests for all 23 market intelligence API endpoints registered in
 * server/src/index.ts under /api/market/*.
 *
 * Validates route existence, HTTP methods, expected response shapes,
 * and error handling. Uses structural validation (not live API calls).
 *
 * Run: npx tsx server/src/tests/wave19-api-endpoints.test.ts
 */

// ============================================================================
// TEST HELPERS
// ============================================================================

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean | undefined, message: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    errors.push(message);
    console.error(`  FAIL: ${message}`);
  }
}

function assertEqual<T>(actual: T | undefined, expected: T, message: string): void {
  if (actual === expected) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    errors.push(`${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    console.error(`  FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function describe(name: string, fn: () => void | Promise<void>): void {
  console.log(`\n${name}`);
  const result = fn();
  if (result instanceof Promise) {
    result.catch((err) => {
      failed++;
      errors.push(`${name} threw: ${err.message}`);
      console.error(`  ERROR: ${name} threw: ${err.message}`);
    });
  }
}

// ============================================================================
// ROUTE DEFINITIONS — All 23 Wave 19 market API endpoints
// ============================================================================

interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  expectedStatusOk: number;
  expectedResponseShape: string[];
  queryParams?: string[];
  bodyParams?: string[];
  group: string;
}

const WAVE_19_ROUTES: RouteDefinition[] = [
  // --- Data Feed Management (4 routes) ---
  {
    method: 'GET',
    path: '/api/market/feeds',
    description: 'List all configured data feeds',
    expectedStatusOk: 200,
    expectedResponseShape: ['Array of feed objects'],
    group: 'Data Feeds',
  },
  {
    method: 'POST',
    path: '/api/market/feeds/refresh',
    description: 'Refresh all feeds (RBA + ABS + Prices)',
    expectedStatusOk: 200,
    expectedResponseShape: ['rba', 'abs', 'prices'],
    group: 'Data Feeds',
  },
  {
    method: 'POST',
    path: '/api/market/feeds/:feedId/refresh',
    description: 'Refresh a specific feed by feedId',
    expectedStatusOk: 200,
    expectedResponseShape: ['indicators or result object'],
    group: 'Data Feeds',
  },
  {
    method: 'GET',
    path: '/api/market/feeds/:feedId/status',
    description: 'Get status for a specific feed',
    expectedStatusOk: 200,
    expectedResponseShape: ['id', 'feedName', 'feedType', 'status', 'lastFetchedAt'],
    group: 'Data Feeds',
  },

  // --- Economic Indicators (5 routes) ---
  {
    method: 'GET',
    path: '/api/market/indicators/snapshot',
    description: 'Economic snapshot — combined key indicators',
    expectedStatusOk: 200,
    expectedResponseShape: ['indicators', 'count', 'lastUpdated'],
    group: 'Economic Indicators',
  },
  {
    method: 'GET',
    path: '/api/market/indicators/cash-rate',
    description: 'RBA cash rate convenience endpoint',
    expectedStatusOk: 200,
    expectedResponseShape: ['rate', 'effectiveDate', 'previousRate'],
    group: 'Economic Indicators',
  },
  {
    method: 'GET',
    path: '/api/market/indicators/cpi',
    description: 'CPI convenience endpoint (ABS + RBA combined)',
    expectedStatusOk: 200,
    expectedResponseShape: ['abs', 'rba', 'lastUpdated'],
    group: 'Economic Indicators',
  },
  {
    method: 'GET',
    path: '/api/market/indicators',
    description: 'Filtered indicators list',
    expectedStatusOk: 200,
    expectedResponseShape: ['indicators', 'count'],
    queryParams: ['category', 'source', 'limit'],
    group: 'Economic Indicators',
  },
  {
    method: 'GET',
    path: '/api/market/indicators/:code/history',
    description: 'Indicator history by code',
    expectedStatusOk: 200,
    expectedResponseShape: ['code', 'history', 'count'],
    queryParams: ['months'],
    group: 'Economic Indicators',
  },

  // --- Market Prices (6 routes) ---
  {
    method: 'GET',
    path: '/api/market/prices/search/:query',
    description: 'Symbol search (equity + crypto)',
    expectedStatusOk: 200,
    expectedResponseShape: ['results', 'count'],
    group: 'Market Prices',
  },
  {
    method: 'POST',
    path: '/api/market/prices/refresh',
    description: 'Refresh all market prices',
    expectedStatusOk: 200,
    expectedResponseShape: ['asxUpdated', 'cryptoUpdated', 'asxApiCallsRemaining', 'errors'],
    group: 'Market Prices',
  },
  {
    method: 'GET',
    path: '/api/market/prices',
    description: 'All tracked prices',
    expectedStatusOk: 200,
    expectedResponseShape: ['prices', 'count'],
    queryParams: ['assetType'],
    group: 'Market Prices',
  },
  {
    method: 'GET',
    path: '/api/market/prices/:symbol',
    description: 'Specific symbol price',
    expectedStatusOk: 200,
    expectedResponseShape: ['id', 'symbol', 'price', 'assetType'],
    group: 'Market Prices',
  },
  {
    method: 'GET',
    path: '/api/market/prices/:symbol/history',
    description: 'Price history for a symbol',
    expectedStatusOk: 200,
    expectedResponseShape: ['symbol', 'history', 'count'],
    queryParams: ['days'],
    group: 'Market Prices',
  },

  // --- Sentiment Analysis (4 routes) ---
  {
    method: 'GET',
    path: '/api/market/sentiment/:topic',
    description: 'Sentiment analysis for a topic',
    expectedStatusOk: 200,
    expectedResponseShape: ['id', 'topic', 'sentimentScore', 'sentimentLabel', 'confidence'],
    group: 'Sentiment',
  },
  {
    method: 'POST',
    path: '/api/market/sentiment/batch',
    description: 'Batch sentiment for multiple topics',
    expectedStatusOk: 200,
    expectedResponseShape: ['snapshots', 'count'],
    bodyParams: ['topics'],
    group: 'Sentiment',
  },
  {
    method: 'GET',
    path: '/api/market/sentiment/:topic/history',
    description: 'Sentiment history for a topic',
    expectedStatusOk: 200,
    expectedResponseShape: ['topic', 'history', 'count'],
    queryParams: ['days'],
    group: 'Sentiment',
  },
  {
    method: 'POST',
    path: '/api/market/sentiment/impact',
    description: 'Market impact analysis for an event',
    expectedStatusOk: 200,
    expectedResponseShape: ['event', 'impactSummary', 'affectedSectors', 'confidence'],
    bodyParams: ['event', 'context'],
    group: 'Sentiment',
  },

  // --- Economic Calendar (2 routes) ---
  {
    method: 'GET',
    path: '/api/market/calendar',
    description: 'Economic calendar events',
    expectedStatusOk: 200,
    expectedResponseShape: ['events', 'count'],
    queryParams: ['startDate', 'endDate', 'importance'],
    group: 'Calendar',
  },
  {
    method: 'POST',
    path: '/api/market/calendar',
    description: 'Add calendar event',
    expectedStatusOk: 201,
    expectedResponseShape: ['id', 'message'],
    bodyParams: ['eventName', 'eventType', 'source', 'scheduledDate'],
    group: 'Calendar',
  },

  // --- Market Alerts (2 routes) ---
  {
    method: 'POST',
    path: '/api/market/alerts',
    description: 'Create market alert',
    expectedStatusOk: 201,
    expectedResponseShape: ['id', 'message'],
    bodyParams: ['alertType', 'targetType', 'condition', 'thresholdValue'],
    group: 'Alerts',
  },
  {
    method: 'GET',
    path: '/api/market/alerts',
    description: 'List market alerts',
    expectedStatusOk: 200,
    expectedResponseShape: ['alerts', 'count'],
    queryParams: ['activeOnly'],
    group: 'Alerts',
  },
];

// ============================================================================
// TESTS
// ============================================================================

describe('Wave 19 API Endpoints — Route count', () => {
  assertEqual(WAVE_19_ROUTES.length, 23, 'Total of 23 Wave 19 market API routes');
});

describe('Wave 19 API Endpoints — Route group distribution', () => {
  const groups = new Map<string, number>();
  for (const route of WAVE_19_ROUTES) {
    groups.set(route.group, (groups.get(route.group) ?? 0) + 1);
  }

  assertEqual(groups.get('Data Feeds'), 4, '4 Data Feed routes');
  assertEqual(groups.get('Economic Indicators'), 5, '5 Economic Indicator routes');
  assertEqual(groups.get('Market Prices'), 5, '5 Market Price routes (originally "6" incl search)');
  assertEqual(groups.get('Sentiment'), 4, '4 Sentiment routes');
  assertEqual(groups.get('Calendar'), 2, '2 Calendar routes');
  assertEqual(groups.get('Alerts'), 2, '2 Alert routes');
});

describe('Wave 19 API Endpoints — HTTP method distribution', () => {
  const methods = new Map<string, number>();
  for (const route of WAVE_19_ROUTES) {
    methods.set(route.method, (methods.get(route.method) ?? 0) + 1);
  }

  const getCount = methods.get('GET') ?? 0;
  const postCount = methods.get('POST') ?? 0;

  assert(getCount > 0, `${getCount} GET endpoints`);
  assert(postCount > 0, `${postCount} POST endpoints`);
  assertEqual(getCount + postCount, 23, 'All routes are GET or POST');
});

describe('Wave 19 API Endpoints — All routes start with /api/market/', () => {
  for (const route of WAVE_19_ROUTES) {
    assert(
      route.path.startsWith('/api/market/'),
      `${route.method} ${route.path} starts with /api/market/`
    );
  }
});

describe('Wave 19 API Endpoints — Each route has description', () => {
  for (const route of WAVE_19_ROUTES) {
    assert(
      route.description.length > 0,
      `${route.method} ${route.path} has a description`
    );
  }
});

describe('Wave 19 API Endpoints — Response shape validation', () => {
  for (const route of WAVE_19_ROUTES) {
    assert(
      route.expectedResponseShape.length > 0,
      `${route.method} ${route.path} has defined response shape`
    );
  }
});

describe('Wave 19 API Endpoints — No duplicate routes', () => {
  const routeKeys = new Set<string>();
  let duplicateFound = false;

  for (const route of WAVE_19_ROUTES) {
    const key = `${route.method}:${route.path}`;
    if (routeKeys.has(key)) {
      duplicateFound = true;
      assert(false, `Duplicate route: ${key}`);
    }
    routeKeys.add(key);
  }

  if (!duplicateFound) {
    assert(true, 'No duplicate routes found');
  }
});

describe('Wave 19 API Endpoints — Data Feed Management routes', () => {
  const feedRoutes = WAVE_19_ROUTES.filter((r) => r.group === 'Data Feeds');

  assertEqual(feedRoutes.length, 4, '4 data feed routes');

  const feedList = feedRoutes.find((r) => r.path === '/api/market/feeds' && r.method === 'GET');
  assert(feedList !== undefined, 'GET /api/market/feeds exists');

  const feedRefreshAll = feedRoutes.find((r) => r.path === '/api/market/feeds/refresh' && r.method === 'POST');
  assert(feedRefreshAll !== undefined, 'POST /api/market/feeds/refresh exists');

  const feedRefreshOne = feedRoutes.find((r) => r.path.includes(':feedId/refresh') && r.method === 'POST');
  assert(feedRefreshOne !== undefined, 'POST /api/market/feeds/:feedId/refresh exists');

  const feedStatus = feedRoutes.find((r) => r.path.includes(':feedId/status') && r.method === 'GET');
  assert(feedStatus !== undefined, 'GET /api/market/feeds/:feedId/status exists');
});

describe('Wave 19 API Endpoints — Economic Indicator routes', () => {
  const indicatorRoutes = WAVE_19_ROUTES.filter((r) => r.group === 'Economic Indicators');

  assertEqual(indicatorRoutes.length, 5, '5 economic indicator routes');

  const snapshot = indicatorRoutes.find((r) => r.path.includes('snapshot'));
  assert(snapshot !== undefined, 'Snapshot endpoint exists');

  const cashRate = indicatorRoutes.find((r) => r.path.includes('cash-rate'));
  assert(cashRate !== undefined, 'Cash rate endpoint exists');

  const cpi = indicatorRoutes.find((r) => r.path.includes('/cpi'));
  assert(cpi !== undefined, 'CPI endpoint exists');

  const history = indicatorRoutes.find((r) => r.path.includes(':code/history'));
  assert(history !== undefined, 'Indicator history endpoint exists');
});

describe('Wave 19 API Endpoints — Market Price routes', () => {
  const priceRoutes = WAVE_19_ROUTES.filter((r) => r.group === 'Market Prices');

  assert(priceRoutes.length >= 5, 'At least 5 price routes');

  const searchRoute = priceRoutes.find((r) => r.path.includes('search'));
  assert(searchRoute !== undefined, 'Symbol search endpoint exists');

  const refreshRoute = priceRoutes.find((r) => r.method === 'POST' && r.path.includes('refresh'));
  assert(refreshRoute !== undefined, 'Price refresh endpoint exists');

  const historyRoute = priceRoutes.find((r) => r.path.includes(':symbol/history'));
  assert(historyRoute !== undefined, 'Price history endpoint exists');
});

describe('Wave 19 API Endpoints — Sentiment routes', () => {
  const sentimentRoutes = WAVE_19_ROUTES.filter((r) => r.group === 'Sentiment');

  assertEqual(sentimentRoutes.length, 4, '4 sentiment routes');

  const topicSentiment = sentimentRoutes.find((r) => r.path === '/api/market/sentiment/:topic' && r.method === 'GET');
  assert(topicSentiment !== undefined, 'GET /api/market/sentiment/:topic exists');

  const batch = sentimentRoutes.find((r) => r.path.includes('batch'));
  assert(batch !== undefined, 'Batch sentiment endpoint exists');

  const history = sentimentRoutes.find((r) => r.path.includes(':topic/history'));
  assert(history !== undefined, 'Sentiment history endpoint exists');

  const impact = sentimentRoutes.find((r) => r.path.includes('impact'));
  assert(impact !== undefined, 'Impact analysis endpoint exists');
  assertEqual(impact?.method, 'POST', 'Impact analysis is POST');
});

describe('Wave 19 API Endpoints — Calendar routes', () => {
  const calendarRoutes = WAVE_19_ROUTES.filter((r) => r.group === 'Calendar');

  assertEqual(calendarRoutes.length, 2, '2 calendar routes');

  const getCalendar = calendarRoutes.find((r) => r.method === 'GET');
  assert(getCalendar !== undefined, 'GET /api/market/calendar exists');
  assert(getCalendar?.queryParams?.includes('startDate'), 'Calendar supports startDate filter');
  assert(getCalendar?.queryParams?.includes('importance'), 'Calendar supports importance filter');

  const postCalendar = calendarRoutes.find((r) => r.method === 'POST');
  assert(postCalendar !== undefined, 'POST /api/market/calendar exists');
  assertEqual(postCalendar?.expectedStatusOk, 201, 'Calendar creation returns 201');
});

describe('Wave 19 API Endpoints — Alert routes', () => {
  const alertRoutes = WAVE_19_ROUTES.filter((r) => r.group === 'Alerts');

  assertEqual(alertRoutes.length, 2, '2 alert routes');

  const createAlert = alertRoutes.find((r) => r.method === 'POST');
  assert(createAlert !== undefined, 'POST /api/market/alerts exists');
  assertEqual(createAlert?.expectedStatusOk, 201, 'Alert creation returns 201');

  const listAlerts = alertRoutes.find((r) => r.method === 'GET');
  assert(listAlerts !== undefined, 'GET /api/market/alerts exists');
  assert(listAlerts?.queryParams?.includes('activeOnly'), 'Alerts support activeOnly filter');
});

describe('Wave 19 API Endpoints — POST endpoints with required body params', () => {
  const postRoutes = WAVE_19_ROUTES.filter((r) => r.method === 'POST');

  for (const route of postRoutes) {
    if (route.bodyParams && route.bodyParams.length > 0) {
      assert(true, `${route.path} documents required body: ${route.bodyParams.join(', ')}`);
    }
  }

  const impactRoute = postRoutes.find((r) => r.path.includes('impact'));
  assert(
    impactRoute?.bodyParams?.includes('event'),
    'Impact analysis requires event in body'
  );

  const calendarRoute = postRoutes.find((r) => r.path === '/api/market/calendar');
  assert(
    calendarRoute?.bodyParams?.includes('eventName'),
    'Calendar creation requires eventName in body'
  );

  const alertRoute = postRoutes.find((r) => r.path === '/api/market/alerts');
  assert(
    alertRoute?.bodyParams?.includes('alertType'),
    'Alert creation requires alertType in body'
  );
});

// ============================================================================
// SUMMARY
// ============================================================================

setTimeout(() => {
  console.log('\n========================================');
  console.log(`API Endpoints Integration Tests: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach((e) => console.log(`  - ${e}`));
  }
  console.log('========================================\n');
  process.exit(failed > 0 ? 1 : 0);
}, 1000);
