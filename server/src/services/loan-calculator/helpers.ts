/**
 * Loan Calculator — Internal Helpers
 *
 * Shared financial math utilities used across loan calculator sub-modules.
 * ALL monetary amounts are in CENTS (integer arithmetic).
 */

import type { RepaymentFrequency, MarketRates, SwitchingCosts } from './types.js';

/**
 * PMT formula — standard annuity payment calculation.
 *   payment = P * r * (1+r)^n / ((1+r)^n - 1)
 *
 * @param principalCents - loan amount in cents
 * @param periodicRate   - interest rate per period (annual / periods-per-year)
 * @param periods        - total number of payment periods
 * @returns payment in cents (rounded to nearest cent)
 */
export function pmt(principalCents: number, periodicRate: number, periods: number): number {
  if (periodicRate === 0) {
    return Math.round(principalCents / periods);
  }
  const factor = Math.pow(1 + periodicRate, periods);
  return Math.round((principalCents * periodicRate * factor) / (factor - 1));
}

/** Convert annual rate to periodic rate based on frequency */
export function periodicRate(annualRate: number, frequency: RepaymentFrequency): number {
  switch (frequency) {
    case 'weekly':
      return annualRate / 52;
    case 'fortnightly':
      return annualRate / 26;
    case 'monthly':
      return annualRate / 12;
  }
}

/** Convert term in months to number of periods */
export function toPeriods(termMonths: number, frequency: RepaymentFrequency): number {
  switch (frequency) {
    case 'weekly':
      return Math.round((termMonths * 52) / 12);
    case 'fortnightly':
      return Math.round((termMonths * 26) / 12);
    case 'monthly':
      return termMonths;
  }
}

/** Convert number of periods back to months */
export function periodsToMonths(periods: number, frequency: RepaymentFrequency): number {
  switch (frequency) {
    case 'weekly':
      return Math.round((periods * 12) / 52);
    case 'fortnightly':
      return Math.round((periods * 12) / 26);
    case 'monthly':
      return periods;
  }
}

/**
 * HEM (Household Expenditure Measure) floor — minimum living expenses
 * used by Australian lenders. Values are approximate monthly amounts in cents
 * based on single-income household benchmarks (simplified).
 */
export function hemFloorCents(dependants: number): number {
  // Base HEM for single adult (approx $1,600/month), each dependant adds ~$500/month
  const baseCents = 160_000;
  const perDependantCents = 50_000;
  return baseCents + dependants * perDependantCents;
}

/**
 * ATO residual value percentages for novated leases.
 * Percentage of vehicle cost that must remain as residual at end of lease.
 */
export function atoResidualPercentage(termYears: number): number {
  if (termYears <= 1) return 0.6556;
  if (termYears <= 2) return 0.5633;
  if (termYears <= 3) return 0.47;
  if (termYears <= 4) return 0.3644;
  return 0.2833;
}

/** Hardcoded Australian benchmark rates (Feb 2026 approximations) as fallback */
export function hardcodedMarketRates(): MarketRates {
  return {
    lowestVariable: 0.0589,
    lowestFixed1yr: 0.0569,
    lowestFixed2yr: 0.0549,
    lowestFixed3yr: 0.0559,
    lowestFixed5yr: 0.0579,
    averageVariable: 0.0649,
    medianVariable: 0.0635,
    source: 'hardcoded',
    sampleSize: 0,
    asAt: new Date().toISOString().split('T')[0],
  };
}

/** Standard switching costs for refinancing (Australian market averages in cents) */
export function defaultSwitchingCosts(): SwitchingCosts {
  return {
    dischargeFee: 35_000, // $350
    valuationFee: 30_000, // $300
    legalFee: 20_000, // $200
    applicationFee: 60_000, // $600
    totalCents: 145_000, // $1,450
  };
}

/** Compute median of a sorted numeric array */
export function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
