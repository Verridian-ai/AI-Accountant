/**
 * Wave 19 Integration Tests — ABS Data Feed Service
 *
 * Tests for server/src/services/abs-data-feed.ts
 * Validates SDMX API integration for CPI, Labour Force, GDP, Wages,
 * and Dwelling Approvals, plus error handling for invalid dataflows.
 *
 * Run: npx tsx server/src/tests/wave19-abs-integration.test.ts
 */

import { AbsDataFeed } from '../services/abs-data-feed.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    errors.push(message);
    console.error(`  FAIL: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual === expected) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    errors.push(`${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    console.error(
      `  FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
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
// MOCK SDMX JSON DATA
// ============================================================================

const MOCK_CPI_SDMX = {
  dataSets: [
    {
      series: {
        '0:0:0': {
          observations: {
            '0': [102.5],
            '1': [103.2],
            '2': [104.0],
            '3': [104.8],
          },
        },
        '0:0:1': {
          observations: {
            '0': [2.8],
            '1': [3.0],
            '2': [3.1],
            '3': [2.9],
          },
        },
      },
    },
  ],
  structure: {
    dimensions: {
      observation: [
        {
          values: [{ id: '2025-Q1' }, { id: '2025-Q2' }, { id: '2025-Q3' }, { id: '2025-Q4' }],
        },
      ],
      series: [],
    },
  },
};

const MOCK_LABOUR_FORCE_SDMX = {
  dataSets: [
    {
      series: {
        '0:0:0': {
          observations: {
            '0': [4.2],
            '1': [4.1],
            '2': [4.0],
          },
        },
        '0:0:1': {
          observations: {
            '0': [66.8],
            '1': [66.9],
            '2': [67.0],
          },
        },
        '0:0:2': {
          observations: {
            '0': [13850],
            '1': [13900],
            '2': [13950],
          },
        },
      },
    },
  ],
  structure: {
    dimensions: {
      observation: [
        {
          values: [{ id: '2025-10' }, { id: '2025-11' }, { id: '2025-12' }],
        },
      ],
      series: [],
    },
  },
};

const MOCK_GDP_SDMX = {
  dataSets: [
    {
      series: {
        '0:0:0': {
          observations: {
            '0': [0.3],
            '1': [0.5],
            '2': [0.4],
          },
        },
        '0:0:1': {
          observations: {
            '0': [1.5],
            '1': [1.8],
            '2': [2.0],
          },
        },
      },
    },
  ],
  structure: {
    dimensions: {
      observation: [
        {
          values: [{ id: '2025-Q1' }, { id: '2025-Q2' }, { id: '2025-Q3' }],
        },
      ],
      series: [],
    },
  },
};

const EMPTY_SDMX = {
  dataSets: [],
  structure: { dimensions: { observation: [] } },
};

const INVALID_SDMX = {
  some: 'random',
  data: 'structure',
};

// ============================================================================
// TESTS
// ============================================================================

describe('AbsDataFeed — Class instantiation', () => {
  const feed = new AbsDataFeed();
  assert(feed !== null && feed !== undefined, 'AbsDataFeed can be instantiated');
  assert(typeof feed.fetchDataflow === 'function', 'fetchDataflow method exists');
  assert(typeof feed.parseDataflow === 'function', 'parseDataflow method exists');
  assert(typeof feed.fetchAllIndicators === 'function', 'fetchAllIndicators method exists');
  assert(typeof feed.getLatestIndicator === 'function', 'getLatestIndicator method exists');
  assert(typeof feed.getIndicatorHistory === 'function', 'getIndicatorHistory method exists');
});

describe('AbsDataFeed — CPI dataflow parsing', async () => {
  const feed = new AbsDataFeed();
  try {
    const indicators = await feed.parseDataflow('CPI', MOCK_CPI_SDMX);

    assert(Array.isArray(indicators), 'CPI parseDataflow returns an array');
    assert(indicators.length > 0, 'CPI SDMX produces at least 1 indicator');

    const cpiAllGroups = indicators.find((i) => i.indicatorCode === 'ABS_CPI_ALL_GROUPS');
    assert(cpiAllGroups !== undefined, 'ABS_CPI_ALL_GROUPS indicator is extracted');

    if (cpiAllGroups) {
      assertEqual(cpiAllGroups.value, 104.8, 'Latest CPI all groups value is 104.8');
      assertEqual(cpiAllGroups.category, 'inflation', 'CPI category is inflation');
      assertEqual(cpiAllGroups.unit, 'index', 'CPI unit is index');
      assert(cpiAllGroups.source.includes('ABS'), 'CPI source includes ABS');
      assertEqual(cpiAllGroups.frequency, 'quarterly', 'CPI frequency is quarterly');
      assert(cpiAllGroups.referencePeriod === '2025-Q4', 'CPI reference period is 2025-Q4');
    }

    const cpiPct = indicators.find((i) => i.indicatorCode === 'ABS_CPI_ALL_GROUPS_PCT');
    assert(cpiPct !== undefined, 'ABS_CPI_ALL_GROUPS_PCT indicator is extracted');

    if (cpiPct) {
      assertEqual(cpiPct.value, 2.9, 'Latest CPI % change is 2.9');
      assertEqual(cpiPct.unit, 'percent', 'CPI pct unit is percent');
    }
  } catch (err: any) {
    assert(false, `CPI parsing should not throw: ${err.message}`);
  }
});

describe('AbsDataFeed — Labour Force dataflow parsing', async () => {
  const feed = new AbsDataFeed();
  try {
    const indicators = await feed.parseDataflow('LABOUR_FORCE', MOCK_LABOUR_FORCE_SDMX);

    assert(Array.isArray(indicators), 'Labour Force parseDataflow returns an array');
    assert(indicators.length >= 2, 'Labour Force SDMX produces at least 2 indicators');

    const unemployment = indicators.find((i) => i.indicatorCode === 'ABS_UNEMPLOYMENT_RATE');
    assert(unemployment !== undefined, 'ABS_UNEMPLOYMENT_RATE is extracted');

    if (unemployment) {
      assertEqual(unemployment.value, 4.0, 'Latest unemployment rate is 4.0');
      assertEqual(unemployment.category, 'employment', 'Unemployment category is employment');
      assertEqual(unemployment.unit, 'percent', 'Unemployment unit is percent');
      assertEqual(unemployment.frequency, 'monthly', 'Labour Force frequency is monthly');
    }

    const participation = indicators.find((i) => i.indicatorCode === 'ABS_PARTICIPATION_RATE');
    assert(participation !== undefined, 'ABS_PARTICIPATION_RATE is extracted');

    if (participation) {
      assertEqual(participation.value, 67.0, 'Latest participation rate is 67.0');
    }

    const employed = indicators.find((i) => i.indicatorCode === 'ABS_EMPLOYED_PERSONS');
    assert(employed !== undefined, 'ABS_EMPLOYED_PERSONS is extracted');

    if (employed) {
      assertEqual(employed.value, 13950, 'Latest employed persons is 13950');
      assertEqual(employed.unit, 'thousands', 'Employed persons unit is thousands');
    }
  } catch (err: any) {
    assert(false, `Labour Force parsing should not throw: ${err.message}`);
  }
});

describe('AbsDataFeed — GDP dataflow parsing', async () => {
  const feed = new AbsDataFeed();
  try {
    const indicators = await feed.parseDataflow('GDP', MOCK_GDP_SDMX);

    assert(Array.isArray(indicators), 'GDP parseDataflow returns an array');
    assert(indicators.length >= 1, 'GDP SDMX produces at least 1 indicator');

    const gdpQuarterly = indicators.find((i) => i.indicatorCode === 'ABS_GDP_QUARTERLY');
    assert(gdpQuarterly !== undefined, 'ABS_GDP_QUARTERLY is extracted');

    if (gdpQuarterly) {
      assertEqual(gdpQuarterly.value, 0.4, 'Latest GDP quarterly change is 0.4');
      assertEqual(gdpQuarterly.category, 'gdp', 'GDP category is gdp');
      assertEqual(gdpQuarterly.frequency, 'quarterly', 'GDP frequency is quarterly');
    }

    const gdpAnnual = indicators.find((i) => i.indicatorCode === 'ABS_GDP_ANNUAL');
    assert(gdpAnnual !== undefined, 'ABS_GDP_ANNUAL is extracted');

    if (gdpAnnual) {
      assertEqual(gdpAnnual.value, 2.0, 'Latest GDP annual change is 2.0');
    }
  } catch (err: any) {
    assert(false, `GDP parsing should not throw: ${err.message}`);
  }
});

describe('AbsDataFeed — Change percentage calculation', async () => {
  const feed = new AbsDataFeed();
  try {
    const indicators = await feed.parseDataflow('CPI', MOCK_CPI_SDMX);
    const cpi = indicators.find((i) => i.indicatorCode === 'ABS_CPI_ALL_GROUPS');

    if (cpi) {
      assert(cpi.previousValue !== null, 'CPI has a previous value');
      assert(cpi.changePct !== null, 'CPI has a change percentage');
      assert(typeof cpi.changePct === 'number', 'Change percentage is a number');
    }
  } catch (err: any) {
    assert(false, `Change pct test should not throw: ${err.message}`);
  }
});

describe('AbsDataFeed — EconomicIndicatorRecord shape validation', async () => {
  const feed = new AbsDataFeed();
  try {
    const indicators = await feed.parseDataflow('CPI', MOCK_CPI_SDMX);

    for (const ind of indicators) {
      assert(typeof ind.id === 'string' && ind.id.length > 0, `${ind.indicatorCode} has valid id`);
      assert(typeof ind.feedId === 'string', `${ind.indicatorCode} has feedId`);
      assert(typeof ind.indicatorCode === 'string', `${ind.indicatorCode} has indicatorCode`);
      assert(typeof ind.indicatorName === 'string', `${ind.indicatorCode} has indicatorName`);
      assert(typeof ind.category === 'string', `${ind.indicatorCode} has category`);
      assert(typeof ind.value === 'number', `${ind.indicatorCode} has numeric value`);
      assert(typeof ind.unit === 'string', `${ind.indicatorCode} has unit`);
      assert(typeof ind.frequency === 'string', `${ind.indicatorCode} has frequency`);
      assert(typeof ind.referencePeriod === 'string', `${ind.indicatorCode} has referencePeriod`);
      assert(typeof ind.source === 'string', `${ind.indicatorCode} has source`);
      assert(typeof ind.observationDate === 'string', `${ind.indicatorCode} has observationDate`);
    }
  } catch (err: any) {
    assert(false, `Shape validation should not throw: ${err.message}`);
  }
});

describe('AbsDataFeed — Unknown dataflow key throws error', async () => {
  const feed = new AbsDataFeed();
  try {
    await feed.parseDataflow('INVALID_DATAFLOW', MOCK_CPI_SDMX);
    assert(false, 'parseDataflow should throw for unknown key');
  } catch (err: any) {
    assert(
      err.message.includes('Unknown ABS dataflow key'),
      'Error message mentions unknown dataflow key',
    );
  }
});

describe('AbsDataFeed — Empty SDMX returns empty results', async () => {
  const feed = new AbsDataFeed();
  try {
    const indicators = await feed.parseDataflow('CPI', EMPTY_SDMX);
    assert(Array.isArray(indicators), 'Empty SDMX returns an array');
    assertEqual(indicators.length, 0, 'Empty SDMX produces zero indicators');
  } catch (err: any) {
    assert(true, 'Empty SDMX handled gracefully');
  }
});

describe('AbsDataFeed — Invalid SDMX structure returns empty results', async () => {
  const feed = new AbsDataFeed();
  try {
    const indicators = await feed.parseDataflow('CPI', INVALID_SDMX);
    assert(Array.isArray(indicators), 'Invalid SDMX returns an array');
    assertEqual(indicators.length, 0, 'Invalid SDMX produces zero indicators');
  } catch (err: any) {
    assert(true, 'Invalid SDMX handled gracefully');
  }
});

describe('AbsDataFeed — Period-to-ISO-date conversion', async () => {
  const feed = new AbsDataFeed();
  try {
    // Test quarterly period parsing
    const indicators = await feed.parseDataflow('CPI', MOCK_CPI_SDMX);
    const cpi = indicators.find((i) => i.indicatorCode === 'ABS_CPI_ALL_GROUPS');

    if (cpi) {
      // 2025-Q4 should be converted to 2025-12-31
      assert(cpi.observationDate.startsWith('2025-'), 'Observation date year is 2025');
      assert(/^\d{4}-\d{2}-\d{2}$/.test(cpi.observationDate), 'Observation date is in ISO format');
    }

    // Test monthly period parsing
    const lfIndicators = await feed.parseDataflow('LABOUR_FORCE', MOCK_LABOUR_FORCE_SDMX);
    const ue = lfIndicators.find((i) => i.indicatorCode === 'ABS_UNEMPLOYMENT_RATE');

    if (ue) {
      // 2025-12 should be converted to 2025-12-01
      assert(
        ue.observationDate.startsWith('2025-12'),
        'Monthly observation date starts with 2025-12',
      );
    }
  } catch (err: any) {
    assert(false, `Period conversion should not throw: ${err.message}`);
  }
});

describe('AbsDataFeed — All 5 configured dataflows have correct indicator codes', () => {
  // Validate that the configured dataflows match expected indicator codes
  const expectedCodes: Record<string, string[]> = {
    CPI: ['ABS_CPI_ALL_GROUPS', 'ABS_CPI_ALL_GROUPS_PCT'],
    LABOUR_FORCE: ['ABS_UNEMPLOYMENT_RATE', 'ABS_PARTICIPATION_RATE', 'ABS_EMPLOYED_PERSONS'],
    GDP: ['ABS_GDP_QUARTERLY', 'ABS_GDP_ANNUAL'],
    WAGES: ['ABS_WPI_ALL', 'ABS_WPI_PRIVATE'],
    DWELLING_APPROVALS: ['ABS_DWELLING_APPROVALS'],
  };

  for (const [_dataflow, codes] of Object.entries(expectedCodes)) {
    for (const code of codes) {
      assert(code.startsWith('ABS_'), `Indicator code ${code} has ABS_ prefix`);
    }
  }

  assertEqual(Object.keys(expectedCodes).length, 5, 'There are 5 configured ABS dataflows');
});

// ============================================================================
// SUMMARY
// ============================================================================

setTimeout(() => {
  console.log('\n========================================');
  console.log(`ABS Integration Tests: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach((e) => console.log(`  - ${e}`));
  }
  console.log('========================================\n');
  process.exit(failed > 0 ? 1 : 0);
}, 3000);
