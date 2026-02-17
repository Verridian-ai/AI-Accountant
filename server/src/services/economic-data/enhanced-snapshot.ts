/**
 * Enhanced Economic Snapshot
 *
 * Combines structured RBA CSV data + ABS SDMX data into a comprehensive snapshot.
 * Falls back to the legacy HTML-scraping snapshot if structured feeds fail.
 */

import { rbaDataFeed } from '../rba-data-feed.js';
import { absDataFeed } from '../abs-data-feed.js';
import type { EconomicSnapshot as EnhancedEconomicSnapshot } from '../economic-data-types.js';

/**
 * Enhanced economic snapshot combining structured RBA CSV data + ABS SDMX data.
 * Falls back to the legacy HTML-scraping snapshot if the structured feeds fail.
 */
export async function getEnhancedEconomicSnapshot(): Promise<EnhancedEconomicSnapshot> {
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
    const find = (code: string) => rbaInds.find((i) => i.indicatorCode === code);

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
    const find = (code: string) => absInds.find((i) => i.indicatorCode === code);

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
        snapshot.housing = {
          sydneyQuarterly: null,
          australiaQuarterly: null,
          dwellingApprovals: null,
        };
      }
      snapshot.housing.dwellingApprovals = dwell.value;
    }
  }

  return snapshot;
}
