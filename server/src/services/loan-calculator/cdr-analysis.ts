/**
 * Loan Calculator — CDR-Powered Borrowing Capacity & Refinance Analysis
 *
 * Uses CDR market rates to estimate borrowing capacity and evaluate refinancing.
 */

import type { CdrProductService } from '../cdr-products.js';
import type {
  CdrBorrowingCapacityParams,
  CdrBorrowingCapacityResult,
  CdrRefinanceParams,
  CdrRefinanceResult,
} from './types.js';
import { pmt, hemFloorCents, defaultSwitchingCosts } from './helpers.js';
import { getMarketRates } from './scenarios.js';

/**
 * CDR Borrowing Capacity
 *
 * Uses the best variable rate from CDR data plus the APRA 3% serviceability
 * buffer to estimate maximum borrowing capacity.
 */
export async function borrowingCapacity(
  cdrProductService: CdrProductService | null,
  params: CdrBorrowingCapacityParams,
): Promise<CdrBorrowingCapacityResult> {
  const {
    grossAnnualIncome,
    otherIncome = 0,
    existingDebts = 0,
    livingExpenses = 0,
    dependants = 0,
    loanPurpose,
  } = params;

  const bufferRate = 0.03; // APRA mandatory 3% serviceability buffer

  const category = loanPurpose ?? 'RESIDENTIAL_MORTGAGES';
  const marketRates = await getMarketRates(cdrProductService, category);
  const baseRate = marketRates.lowestVariable;
  const assessmentRate = baseRate + bufferRate;

  // Net monthly income (70% of gross as approximate after-tax)
  const totalAnnualIncome = grossAnnualIncome + otherIncome;
  const netMonthlyIncome = Math.round((totalAnnualIncome * 0.7) / 12);

  // HEM floor
  const hem = hemFloorCents(dependants);
  const effectiveLivingExpenses = Math.max(livingExpenses, hem);

  // Surplus
  const monthlyCommitments = existingDebts + effectiveLivingExpenses;
  const surplusIncome = Math.max(0, netMonthlyIncome - monthlyCommitments);

  // Max borrowing at assessment rate over 30 years
  const monthlyAssessmentRate = assessmentRate / 12;
  const periods = 360;
  let maxBorrowing = 0;

  if (surplusIncome > 0 && monthlyAssessmentRate > 0) {
    const factor = Math.pow(1 + monthlyAssessmentRate, periods);
    maxBorrowing = Math.round((surplusIncome * (factor - 1)) / (monthlyAssessmentRate * factor));
  }

  // DSR cap: 6x gross annual income
  const dsrCap = totalAnnualIncome * 6;
  maxBorrowing = Math.min(maxBorrowing, dsrCap);

  const monthlyRepayment = maxBorrowing > 0 ? pmt(maxBorrowing, monthlyAssessmentRate, periods) : 0;

  const dsr =
    totalAnnualIncome > 0 ? Math.round((maxBorrowing / totalAnnualIncome) * 100) / 100 : 0;

  const maxPropertyPrice = Math.round(maxBorrowing / 0.8);

  return {
    maxBorrowing,
    assessmentRate,
    baseRate,
    rateSource: marketRates.source,
    monthlyRepayment,
    netMonthlyIncome,
    monthlyCommitments,
    surplusIncome,
    dsr,
    hemFloor: hem,
    maxPropertyPrice,
    disclaimer:
      'This is an estimate only. Actual borrowing capacity depends on lender criteria, credit history, and full financial assessment. Assessment uses APRA 3% serviceability buffer above the best available CDR variable rate.',
  };
}

/**
 * CDR Refinance Analysis
 *
 * Compares current loan against CDR market rates to find better alternatives.
 */
export async function refinanceAnalysis(
  cdrProductService: CdrProductService | null,
  params: CdrRefinanceParams,
): Promise<CdrRefinanceResult> {
  const { currentBalance, currentRate, currentRemainingMonths, loanPurpose, topN = 5 } = params;

  const currentMonthlyPayment = pmt(currentBalance, currentRate / 12, currentRemainingMonths);
  const switching = defaultSwitchingCosts();

  const category = loanPurpose ?? 'RESIDENTIAL_MORTGAGES';
  const marketRates = await getMarketRates(cdrProductService, category);

  const benchmarkRates = [
    { label: 'Best Variable', rate: marketRates.lowestVariable },
    { label: 'Best Fixed 1yr', rate: marketRates.lowestFixed1yr },
    { label: 'Best Fixed 2yr', rate: marketRates.lowestFixed2yr },
    { label: 'Best Fixed 3yr', rate: marketRates.lowestFixed3yr },
  ];

  const alternatives = benchmarkRates
    .filter((b) => b.rate < currentRate)
    .slice(0, topN)
    .map((b) => {
      const newMonthlyPayment = pmt(currentBalance, b.rate / 12, currentRemainingMonths);
      const monthlySaving = currentMonthlyPayment - newMonthlyPayment;
      const totalLifetimeSaving = monthlySaving * currentRemainingMonths - switching.totalCents;
      const breakEvenMonths =
        monthlySaving > 0 ? Math.ceil(switching.totalCents / monthlySaving) : 0;

      return {
        productId: b.label.toLowerCase().replace(/\s+/g, '-'),
        productName: b.label,
        dataHolderName: marketRates.source === 'cdr' ? 'CDR Market' : 'Benchmark',
        newRate: b.rate,
        comparisonRate: null,
        newMonthlyPayment,
        monthlySaving,
        totalLifetimeSaving,
        breakEvenMonths,
        switchingCostBreakdown: switching,
      };
    });

  alternatives.sort((a, b) => b.totalLifetimeSaving - a.totalLifetimeSaving);

  const bestAlternative = alternatives.length > 0 ? alternatives[0] : null;
  const recommendation =
    bestAlternative && bestAlternative.totalLifetimeSaving > 0 ? 'switch' : 'stay';
  const reasoning =
    recommendation === 'switch'
      ? `Switching could save $${Math.round(bestAlternative!.totalLifetimeSaving / 100).toLocaleString()} over the remaining term (break-even in ${bestAlternative!.breakEvenMonths} months).`
      : 'Current rate is competitive with available market rates. Switching costs would likely exceed savings.';

  return {
    currentRate,
    currentMonthlyPayment,
    recommendation,
    reasoning,
    alternatives,
    bestAlternative,
  };
}
