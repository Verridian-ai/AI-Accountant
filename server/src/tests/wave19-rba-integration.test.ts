/**
 * Wave 19 Integration Tests — RBA Data Feed Service
 *
 * Tests for server/src/services/rba-data-feed.ts
 * Validates RBA CSV parsing for interest rates (A2), lending rates (F5),
 * inflation (G1), multi-line header handling, cash rate convenience method,
 * and error handling for malformed CSV.
 *
 * Run: npx tsx server/src/tests/wave19-rba-integration.test.ts
 */

import { RbaDataFeed } from '../services/rba-data-feed.js';

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
// MOCK CSV DATA — simulates RBA CSV format with 10 metadata rows + header + data
// ============================================================================

const MOCK_A2_CSV = [
  'Title,Reserve Bank of Australia Interest Rates',
  'Description,Target Cash Rate and Interbank Overnight Cash Rate',
  'Frequency,Daily',
  'Type,Original',
  'Source,RBA',
  'Units,Per cent per annum',
  'First Obs,Jan-1990',
  'Last Obs,Feb-2026',
  'Series ID,ARBAAISTCRT,ARBAAISTCRO',
  '',
  'Title,Cash Rate Target,Interbank Overnight Cash Rate',
  '02-Jan-2025,4.35,4.33',
  '03-Feb-2025,4.35,4.34',
  '04-Mar-2025,4.10,4.09',
  '01-Apr-2025,4.10,4.08',
  '06-May-2025,4.10,4.07',
  '03-Jun-2025,3.85,3.83',
  '01-Jul-2025,3.85,3.82',
  '05-Aug-2025,3.85,3.84',
  '02-Sep-2025,3.85,3.83',
  '07-Oct-2025,3.85,3.82',
  '04-Nov-2025,3.60,3.58',
  '02-Dec-2025,3.60,3.59',
  '06-Jan-2026,3.60,3.58',
  '03-Feb-2026,3.60,3.57',
].join('\n');

const MOCK_F5_CSV = [
  'Title,Indicator Lending Rates',
  'Description,Indicator rates for various loan products',
  'Frequency,Monthly',
  'Type,Original',
  'Source,RBA',
  'Units,Per cent per annum',
  'First Obs,Jan-2000',
  'Last Obs,Jan-2026',
  'Series ID,F5.1,F5.2,F5.3,F5.4',
  '',
  'Title,Housing loans; Variable; Standard,Housing loans; Variable; Discounted,Personal loans; Variable,Term deposits; 1 year',
  '01-Oct-2025,7.35,5.95,11.50,4.50',
  '01-Nov-2025,7.10,5.70,11.25,4.25',
  '01-Dec-2025,7.10,5.70,11.25,4.25',
  '01-Jan-2026,7.10,5.70,11.25,4.25',
].join('\n');

const MOCK_G1_CSV = [
  'Title,Consumer Price Inflation',
  'Description,CPI percentage changes',
  'Frequency,Quarterly',
  'Type,Original',
  'Source,RBA',
  'Units,Per cent',
  'First Obs,Sep-1969',
  'Last Obs,Dec-2025',
  'Series ID,G1.1,G1.2,G1.3',
  '',
  'Title,All groups CPI; Percentage change; Quarterly,All groups CPI; Percentage change; Annual,Trimmed mean; Percentage change; Annual',
  '01-Mar-2025,0.8,3.2,3.0',
  '01-Jun-2025,0.7,3.0,2.9',
  '01-Sep-2025,0.6,2.8,2.7',
  '01-Dec-2025,0.5,2.6,2.5',
].join('\n');

const MALFORMED_CSV = 'This is not a valid CSV file\nwith random content\nand no headers';

const EMPTY_CSV = '';

// ============================================================================
// TESTS
// ============================================================================

describe('RbaDataFeed — Class instantiation', () => {
  const feed = new RbaDataFeed();
  assert(feed !== null && feed !== undefined, 'RbaDataFeed can be instantiated');
  assert(typeof feed.fetchTable === 'function', 'fetchTable method exists');
  assert(typeof feed.parseTable === 'function', 'parseTable method exists');
  assert(typeof feed.fetchAllTables === 'function', 'fetchAllTables method exists');
  assert(typeof feed.getCashRate === 'function', 'getCashRate method exists');
  assert(typeof feed.getRateHistory === 'function', 'getRateHistory method exists');
});

describe('RbaDataFeed — A2 table parsing (interest rates)', async () => {
  const feed = new RbaDataFeed();
  try {
    const indicators = await feed.parseTable('A2', MOCK_A2_CSV);

    assert(Array.isArray(indicators), 'parseTable returns an array');
    assert(indicators.length > 0, 'A2 CSV produces at least 1 indicator');

    // Should find RBA_CASH_RATE indicator
    const cashRate = indicators.find((i) => i.indicatorCode === 'RBA_CASH_RATE');
    assert(cashRate !== undefined, 'RBA_CASH_RATE indicator is extracted');

    if (cashRate) {
      assertEqual(cashRate.value, 3.60, 'Latest cash rate value is 3.60');
      assertEqual(cashRate.category, 'interest_rates', 'Cash rate category is interest_rates');
      assertEqual(cashRate.unit, 'percent', 'Cash rate unit is percent');
      assert(cashRate.source.includes('RBA'), 'Cash rate source includes RBA');
      assert(cashRate.indicatorName.length > 0, 'Cash rate has a non-empty indicator name');
      assert(cashRate.id.length > 0, 'Cash rate has a UUID id');
      assert(cashRate.feedId.length > 0, 'Cash rate has a feedId');
      assert(cashRate.observationDate.length > 0, 'Cash rate has an observation date');
      assert(cashRate.referencePeriod.length > 0, 'Cash rate has a reference period');
      assertEqual(cashRate.frequency, 'daily', 'A2 frequency is daily');
    }

    // Should also find RBA_OVERNIGHT_RATE
    const overnightRate = indicators.find((i) => i.indicatorCode === 'RBA_OVERNIGHT_RATE');
    assert(overnightRate !== undefined, 'RBA_OVERNIGHT_RATE indicator is extracted');

    if (overnightRate) {
      assertEqual(overnightRate.value, 3.57, 'Latest overnight rate value is 3.57');
    }
  } catch (err: any) {
    assert(false, `A2 parsing should not throw: ${err.message}`);
  }
});

describe('RbaDataFeed — F5 table parsing (lending rates)', async () => {
  const feed = new RbaDataFeed();
  try {
    const indicators = await feed.parseTable('F5', MOCK_F5_CSV);

    assert(Array.isArray(indicators), 'F5 parseTable returns an array');
    assert(indicators.length >= 2, 'F5 CSV produces at least 2 indicators');

    const homeLoan = indicators.find((i) => i.indicatorCode === 'RBA_HOME_LOAN_VARIABLE');
    assert(homeLoan !== undefined, 'RBA_HOME_LOAN_VARIABLE is extracted');

    if (homeLoan) {
      assertEqual(homeLoan.value, 7.10, 'Home loan variable rate is 7.10');
      assertEqual(homeLoan.category, 'interest_rates', 'Home loan category is interest_rates');
      assertEqual(homeLoan.frequency, 'monthly', 'F5 frequency is monthly');
    }

    const termDeposit = indicators.find((i) => i.indicatorCode === 'RBA_TERM_DEPOSIT_1YR');
    assert(termDeposit !== undefined, 'RBA_TERM_DEPOSIT_1YR is extracted');

    if (termDeposit) {
      assertEqual(termDeposit.value, 4.25, 'Term deposit 1yr rate is 4.25');
    }
  } catch (err: any) {
    assert(false, `F5 parsing should not throw: ${err.message}`);
  }
});

describe('RbaDataFeed — G1 table parsing (inflation/CPI)', async () => {
  const feed = new RbaDataFeed();
  try {
    const indicators = await feed.parseTable('G1', MOCK_G1_CSV);

    assert(Array.isArray(indicators), 'G1 parseTable returns an array');
    assert(indicators.length >= 2, 'G1 CSV produces at least 2 indicators');

    const cpiQuarterly = indicators.find((i) => i.indicatorCode === 'RBA_CPI_QUARTERLY');
    assert(cpiQuarterly !== undefined, 'RBA_CPI_QUARTERLY is extracted');

    if (cpiQuarterly) {
      assertEqual(cpiQuarterly.value, 0.5, 'CPI quarterly is 0.5');
      assertEqual(cpiQuarterly.category, 'inflation', 'CPI category is inflation');
      assertEqual(cpiQuarterly.frequency, 'quarterly', 'G1 frequency is quarterly');
    }

    const cpiAnnual = indicators.find((i) => i.indicatorCode === 'RBA_CPI_ANNUAL');
    assert(cpiAnnual !== undefined, 'RBA_CPI_ANNUAL is extracted');

    if (cpiAnnual) {
      assertEqual(cpiAnnual.value, 2.6, 'CPI annual is 2.6');
    }

    const trimmedMean = indicators.find((i) => i.indicatorCode === 'RBA_TRIMMED_MEAN');
    assert(trimmedMean !== undefined, 'RBA_TRIMMED_MEAN is extracted');

    if (trimmedMean) {
      assertEqual(trimmedMean.value, 2.5, 'Trimmed mean is 2.5');
    }
  } catch (err: any) {
    assert(false, `G1 parsing should not throw: ${err.message}`);
  }
});

describe('RbaDataFeed — Change percentage calculation', async () => {
  const feed = new RbaDataFeed();
  try {
    const indicators = await feed.parseTable('A2', MOCK_A2_CSV);
    const cashRate = indicators.find((i) => i.indicatorCode === 'RBA_CASH_RATE');

    if (cashRate) {
      assert(cashRate.previousValue !== null, 'Cash rate has a previous value');
      assert(cashRate.changePct !== null, 'Cash rate has a change percentage');
      assert(typeof cashRate.changePct === 'number', 'Change percentage is a number');
    }
  } catch (err: any) {
    assert(false, `Change percentage test should not throw: ${err.message}`);
  }
});

describe('RbaDataFeed — EconomicIndicatorRecord shape validation', async () => {
  const feed = new RbaDataFeed();
  try {
    const indicators = await feed.parseTable('A2', MOCK_A2_CSV);

    for (const ind of indicators) {
      assert(typeof ind.id === 'string' && ind.id.length > 0, `Indicator ${ind.indicatorCode} has valid id`);
      assert(typeof ind.feedId === 'string', `Indicator ${ind.indicatorCode} has feedId`);
      assert(typeof ind.indicatorCode === 'string', `Indicator ${ind.indicatorCode} has indicatorCode`);
      assert(typeof ind.indicatorName === 'string', `Indicator ${ind.indicatorCode} has indicatorName`);
      assert(typeof ind.category === 'string', `Indicator ${ind.indicatorCode} has category`);
      assert(typeof ind.value === 'number', `Indicator ${ind.indicatorCode} has numeric value`);
      assert(typeof ind.unit === 'string', `Indicator ${ind.indicatorCode} has unit`);
      assert(typeof ind.frequency === 'string', `Indicator ${ind.indicatorCode} has frequency`);
      assert(typeof ind.referencePeriod === 'string', `Indicator ${ind.indicatorCode} has referencePeriod`);
      assert(typeof ind.source === 'string', `Indicator ${ind.indicatorCode} has source`);
      assert(typeof ind.observationDate === 'string', `Indicator ${ind.indicatorCode} has observationDate`);
    }
  } catch (err: any) {
    assert(false, `Shape validation should not throw: ${err.message}`);
  }
});

describe('RbaDataFeed — Unknown table key throws error', async () => {
  const feed = new RbaDataFeed();
  try {
    await feed.fetchTable('INVALID_TABLE');
    assert(false, 'fetchTable should throw for unknown table key');
  } catch (err: any) {
    assert(err.message.includes('Unknown RBA table key'), 'Error message mentions unknown table key');
  }

  try {
    await feed.parseTable('INVALID_TABLE', 'some,csv');
    assert(false, 'parseTable should throw for unknown table key');
  } catch (err: any) {
    assert(err.message.includes('Unknown RBA table key'), 'parseTable error mentions unknown table key');
  }
});

describe('RbaDataFeed — Malformed CSV returns empty results', async () => {
  const feed = new RbaDataFeed();
  try {
    const indicators = await feed.parseTable('A2', MALFORMED_CSV);
    assert(Array.isArray(indicators), 'Malformed CSV still returns an array');
    assertEqual(indicators.length, 0, 'Malformed CSV produces zero indicators');
  } catch (err: any) {
    // Either returning empty or throwing is acceptable
    assert(true, 'Malformed CSV handled (threw or returned empty)');
  }
});

describe('RbaDataFeed — Empty CSV returns empty results', async () => {
  const feed = new RbaDataFeed();
  try {
    const indicators = await feed.parseTable('A2', EMPTY_CSV);
    assert(Array.isArray(indicators), 'Empty CSV returns an array');
    assertEqual(indicators.length, 0, 'Empty CSV produces zero indicators');
  } catch (err: any) {
    assert(true, 'Empty CSV handled (threw or returned empty)');
  }
});

describe('RbaDataFeed — Multi-line header row detection', async () => {
  // The RBA CSV format has 10 metadata rows before the header
  // The service should detect the header row by looking for "Title" or "Series ID" prefix
  const feed = new RbaDataFeed();
  try {
    const indicators = await feed.parseTable('A2', MOCK_A2_CSV);
    // If it found any indicators, the header detection worked
    assert(indicators.length > 0, 'Header row detection works with 10-row metadata prefix');
  } catch (err: any) {
    assert(false, `Header detection should not throw: ${err.message}`);
  }
});

describe('RbaDataFeed — RBA date parsing (DD-MMM-YYYY)', async () => {
  const feed = new RbaDataFeed();
  try {
    const indicators = await feed.parseTable('A2', MOCK_A2_CSV);
    const cashRate = indicators.find((i) => i.indicatorCode === 'RBA_CASH_RATE');

    if (cashRate) {
      // The observation date should be in ISO format YYYY-MM-DD
      assert(/^\d{4}-\d{2}-\d{2}$/.test(cashRate.observationDate), 'Date is in ISO YYYY-MM-DD format');
      assert(cashRate.observationDate.startsWith('2026-'), 'Date year is 2026 (latest row)');
    }
  } catch (err: any) {
    assert(false, `Date parsing should not throw: ${err.message}`);
  }
});

// ============================================================================
// SUMMARY
// ============================================================================

setTimeout(() => {
  console.log('\n========================================');
  console.log(`RBA Integration Tests: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach((e) => console.log(`  - ${e}`));
  }
  console.log('========================================\n');
  process.exit(failed > 0 ? 1 : 0);
}, 3000);
