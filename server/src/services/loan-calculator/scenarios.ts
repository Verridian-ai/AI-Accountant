/**
 * Loan Calculator — Scenario Modelling and CDR-Powered Analysis
 *
 * CDR market rates and multi-scenario rate modelling.
 * Borrowing capacity and refinance analysis in cdr-analysis.ts.
 */

import type { CdrProductService } from '../cdr-products.js';
import type {
  MarketRates,
  RateScenarioParams,
  RateScenarioResult,
  RateScenarioEntry,
} from './types.js';
import { pmt, hardcodedMarketRates, median } from './helpers.js';

/**
 * Get Market Rates -- real CDR rates or hardcoded fallback
 *
 * Queries CDR lending rates for the given product category, aggregates
 * into lowest/average/median by rate type, and returns a MarketRates
 * snapshot. Falls back to hardcoded AU benchmark rates if CDR is
 * unavailable or returns no data.
 */
export async function getMarketRates(
  cdrProductService: CdrProductService | null,
  category: string = 'RESIDENTIAL_MORTGAGES',
  purpose?: string,
): Promise<MarketRates> {
  if (!cdrProductService) {
    return hardcodedMarketRates();
  }

  try {
    const bestRates = await cdrProductService.getBestRates(category, 'lending', 200);
    if (bestRates.length === 0) return hardcodedMarketRates();

    const filtered = purpose
      ? bestRates.filter(
          (r) => !purpose || r.rateType?.includes('VARIABLE') || r.rateType?.includes('FIXED'),
        )
      : bestRates;

    if (filtered.length === 0) return hardcodedMarketRates();

    const variableRates = filtered
      .filter((r) => r.rateType?.includes('VARIABLE'))
      .map((r) => r.rate)
      .sort((a, b) => a - b);

    const fixedRates = filtered
      .filter((r) => r.rateType?.includes('FIXED'))
      .map((r) => r.rate)
      .sort((a, b) => a - b);

    const allRates = filtered.map((r) => r.rate).sort((a, b) => a - b);
    const lowestFixed = fixedRates.length > 0 ? fixedRates[0] : 0;
    const avgVariable =
      variableRates.length > 0
        ? variableRates.reduce((sum, r) => sum + r, 0) / variableRates.length
        : 0;

    const defaults = hardcodedMarketRates();

    return {
      lowestVariable: variableRates.length > 0 ? variableRates[0] : defaults.lowestVariable,
      lowestFixed1yr: lowestFixed || defaults.lowestFixed1yr,
      lowestFixed2yr:
        fixedRates.length > 1 ? fixedRates[1] : lowestFixed || defaults.lowestFixed2yr,
      lowestFixed3yr: fixedRates.length > 2 ? fixedRates[2] : defaults.lowestFixed3yr,
      lowestFixed5yr: fixedRates.length > 4 ? fixedRates[4] : defaults.lowestFixed5yr,
      averageVariable: avgVariable || defaults.averageVariable,
      medianVariable: variableRates.length > 0 ? median(variableRates) : defaults.medianVariable,
      source: 'cdr',
      sampleSize: allRates.length,
      asAt: new Date().toISOString().split('T')[0],
    };
  } catch {
    return hardcodedMarketRates();
  }
}

/**
 * Rate Scenario Modelling
 *
 * Calculates repayments and total interest for multiple rate scenarios.
 */
export async function rateScenario(
  cdrProductService: CdrProductService | null,
  params: RateScenarioParams,
): Promise<RateScenarioResult> {
  const { principal, termMonths, currentRate, loanPurpose } = params;

  const category = loanPurpose ?? 'RESIDENTIAL_MORTGAGES';
  const marketRates = await getMarketRates(cdrProductService, category);

  const scenarioRates: Array<{ label: string; rate: number }> = [];
  scenarioRates.push({
    label: `CDR Best (${marketRates.source})`,
    rate: marketRates.lowestVariable,
  });
  scenarioRates.push({
    label: `CDR Average (${marketRates.source})`,
    rate: marketRates.averageVariable,
  });

  if (currentRate != null) {
    scenarioRates.push({ label: 'Your Current Rate', rate: currentRate });
  }

  const referenceRate = currentRate ?? marketRates.averageVariable;
  scenarioRates.push({ label: 'Stress +1%', rate: referenceRate + 0.01 });
  scenarioRates.push({ label: 'Stress +2%', rate: referenceRate + 0.02 });
  scenarioRates.push({ label: 'Stress +3%', rate: referenceRate + 0.03 });
  scenarioRates.push({
    label: `Best Fixed 1yr (${marketRates.source})`,
    rate: marketRates.lowestFixed1yr,
  });

  // Deduplicate by rate
  const seen = new Set<string>();
  const uniqueScenarios = scenarioRates.filter((s) => {
    const key = s.rate.toFixed(4);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const currentMonthlyPayment =
    currentRate != null ? pmt(principal, currentRate / 12, termMonths) : 0;

  const scenarios: RateScenarioEntry[] = uniqueScenarios.map((s) => {
    const monthlyPayment = pmt(principal, s.rate / 12, termMonths);
    const totalCost = monthlyPayment * termMonths;
    const totalInterest = totalCost - principal;
    const diffFromCurrent = currentRate != null ? monthlyPayment - currentMonthlyPayment : 0;
    return {
      label: s.label,
      rate: s.rate,
      monthlyPayment,
      totalInterest,
      totalCost,
      diffFromCurrent,
    };
  });

  scenarios.sort((a, b) => a.rate - b.rate);

  return { principal, termMonths, scenarios, rateSource: marketRates.source };
}

// Re-export CDR analysis functions for backward compatibility
export { borrowingCapacity, refinanceAnalysis } from './cdr-analysis.js';
