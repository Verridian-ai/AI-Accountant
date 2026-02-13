/**
 * Loan Calculator Service
 * Provides Australian-focused loan comparison tools:
 *   - Home loan (with offset, extra repayments, amortization schedule)
 *   - Car finance (3-way: personal loan, chattel mortgage, novated lease)
 *   - Personal loan (comparison rate)
 *   - Business loan (interest deductibility)
 *   - Refinance savings (break-even analysis)
 *   - Borrowing capacity (APRA buffer, HEM floor, DSR)
 *   - CDR market rates (real rates from Open Banking data)
 *   - CDR refinance analysis (multi-product comparison with switching costs)
 *   - CDR borrowing capacity (uses real market rates + APRA buffer)
 *   - CDR rate scenarios (multi-scenario repayment modeling)
 *
 * ALL monetary amounts are in CENTS (integer arithmetic) to avoid
 * floating-point rounding errors common in financial software.
 */

import { CdrProductService } from './cdr-products.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type RepaymentFrequency = 'weekly' | 'fortnightly' | 'monthly';

export interface HomeLoanParams {
  principal: number; // cents
  annualRate: number; // decimal, e.g. 0.0625 for 6.25%
  termMonths: number; // e.g. 360 for 30 years
  frequency: RepaymentFrequency;
  offsetBalance?: number; // cents
  extraRepayment?: number; // cents per period
}

export interface AmortizationEntry {
  period: number;
  payment: number; // cents
  interest: number; // cents
  principal: number; // cents
  extraPrincipal: number; // cents
  balance: number; // cents
}

export interface HomeLoanResult {
  regularPayment: number; // cents per period
  frequency: RepaymentFrequency;
  totalInterest: number; // cents
  totalCost: number; // cents
  periodsToPayOff: number;
  timeSavedMonths: number;
  interestSaved: number; // cents
  schedule: AmortizationEntry[];
}

export interface CarFinanceParams {
  vehiclePrice: number; // cents
  deposit: number; // cents
  termMonths: number;
  personalLoanRate: number; // decimal
  chattelMortgageRate: number;
  novatedLeaseRate: number;
  marginalTaxRate: number; // e.g. 0.325
  gstRegistered: boolean;
  annualSalary: number; // cents
}

export interface CarFinanceOption {
  type: string;
  monthlyPayment: number; // cents
  totalCost: number; // cents
  totalInterest: number; // cents
  taxBenefit: number; // cents
  afterTaxCost: number; // cents
  effectiveRate: number; // decimal
}

export interface CarFinanceComparison {
  personalLoan: CarFinanceOption;
  chattelMortgage: CarFinanceOption;
  novatedLease: CarFinanceOption;
  cheapestOption: string;
}

export interface PersonalLoanParams {
  principal: number; // cents
  annualRate: number;
  termMonths: number;
  establishmentFee?: number; // cents
  monthlyFee?: number; // cents
}

export interface PersonalLoanResult {
  monthlyPayment: number; // cents
  totalInterest: number; // cents
  totalCost: number; // cents
  comparisonRate: number; // decimal — effective rate including fees
}

export interface BusinessLoanParams {
  principal: number; // cents
  annualRate: number;
  termMonths: number;
  marginalTaxRate: number; // e.g. 0.30
  isEquipmentFinance?: boolean;
  equipmentEffectiveLife?: number; // years for depreciation
}

export interface BusinessLoanResult {
  monthlyPayment: number; // cents
  totalInterest: number; // cents
  totalCost: number; // cents
  taxDeductibleInterest: number; // cents
  taxSavingFromInterest: number; // cents
  depreciationBenefit: number; // cents (if equipment finance)
  effectiveAfterTaxCost: number; // cents
}

export interface RefinanceParams {
  currentBalance: number; // cents
  currentRate: number; // decimal
  currentRemainingMonths: number;
  newRate: number; // decimal
  newTermMonths: number;
  switchingCosts: number; // cents (discharge, application, valuation)
}

export interface RefinanceResult {
  currentMonthlyPayment: number; // cents
  newMonthlyPayment: number; // cents
  monthlySaving: number; // cents
  breakEvenMonths: number;
  totalSavings: number; // cents — over remaining term, net of switching costs
  currentTotalCost: number; // cents
  newTotalCost: number; // cents
}

export interface BorrowingCapacityParams {
  grossAnnualIncome: number; // cents
  otherIncome: number; // cents (annual)
  existingDebts: number; // cents per month
  livingExpenses: number; // cents per month
  dependants: number;
  interestRate: number; // decimal
  bufferRate?: number; // APRA buffer, default 0.03 (3%)
}

export interface BorrowingCapacityResult {
  maxBorrowing: number; // cents
  assessmentRate: number; // decimal (rate + buffer)
  monthlyRepayment: number; // cents at assessment rate
  netMonthlyIncome: number; // cents
  monthlyCommitments: number; // cents
  surplusIncome: number; // cents
  dsr: number; // Debt Service Ratio
  hemFloor: number; // cents per month
}

// ============================================================================
// CDR-POWERED TYPE DEFINITIONS
// ============================================================================

export interface MarketRates {
  lowestVariable: number; // decimal rate
  lowestFixed1yr: number; // decimal rate
  lowestFixed2yr: number;
  lowestFixed3yr: number;
  lowestFixed5yr: number;
  averageVariable: number;
  medianVariable: number;
  source: 'cdr' | 'hardcoded';
  sampleSize: number;
  asAt: string; // ISO date when rates were sourced
}

export interface CdrRefinanceParams {
  currentBalance: number; // cents
  currentRate: number; // decimal
  currentRemainingMonths: number;
  loanPurpose?: string; // e.g. 'OWNER_OCCUPIED', 'INVESTMENT'
  repaymentType?: string; // e.g. 'PRINCIPAL_AND_INTEREST'
  topN?: number; // max alternatives to return (default 5)
}

export interface RefinanceAlternative {
  productId: string;
  productName: string;
  dataHolderName: string;
  newRate: number; // decimal
  comparisonRate: number | null;
  newMonthlyPayment: number; // cents
  monthlySaving: number; // cents
  totalLifetimeSaving: number; // cents (net of switching costs)
  breakEvenMonths: number;
  switchingCostBreakdown: SwitchingCosts;
}

export interface SwitchingCosts {
  dischargeFee: number; // cents
  valuationFee: number; // cents
  legalFee: number; // cents
  applicationFee: number; // cents
  totalCents: number; // cents
}

export interface CdrRefinanceResult {
  currentRate: number;
  currentMonthlyPayment: number; // cents
  recommendation: 'switch' | 'stay';
  reasoning: string;
  alternatives: RefinanceAlternative[];
  bestAlternative: RefinanceAlternative | null;
}

export interface CdrBorrowingCapacityParams {
  grossAnnualIncome: number; // cents
  otherIncome?: number; // cents (annual)
  existingDebts?: number; // cents per month
  livingExpenses?: number; // cents per month
  dependants?: number;
  loanPurpose?: string; // CDR category filter
}

export interface CdrBorrowingCapacityResult {
  maxBorrowing: number; // cents
  assessmentRate: number; // decimal (CDR best rate + 3% buffer)
  baseRate: number; // decimal (CDR best variable rate)
  rateSource: 'cdr' | 'hardcoded';
  monthlyRepayment: number; // cents at assessment rate
  netMonthlyIncome: number; // cents
  monthlyCommitments: number; // cents
  surplusIncome: number; // cents
  dsr: number;
  hemFloor: number; // cents per month
  maxPropertyPrice: number; // cents (at 80% LVR)
  disclaimer: string;
}

export interface RateScenarioParams {
  principal: number; // cents
  termMonths: number;
  currentRate?: number; // decimal — if provided, included as a scenario
  loanPurpose?: string; // CDR category filter
}

export interface RateScenarioEntry {
  label: string;
  rate: number; // decimal
  monthlyPayment: number; // cents
  totalInterest: number; // cents
  totalCost: number; // cents
  diffFromCurrent: number; // cents per month (positive = more expensive)
}

export interface RateScenarioResult {
  principal: number; // cents
  termMonths: number;
  scenarios: RateScenarioEntry[];
  rateSource: 'cdr' | 'hardcoded';
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * PMT formula — standard annuity payment calculation.
 *   payment = P * r * (1+r)^n / ((1+r)^n - 1)
 *
 * @param principalCents - loan amount in cents
 * @param periodicRate   - interest rate per period (annual / periods-per-year)
 * @param periods        - total number of payment periods
 * @returns payment in cents (rounded to nearest cent)
 */
function pmt(principalCents: number, periodicRate: number, periods: number): number {
  if (periodicRate === 0) {
    return Math.round(principalCents / periods);
  }
  const factor = Math.pow(1 + periodicRate, periods);
  return Math.round((principalCents * periodicRate * factor) / (factor - 1));
}

/** Convert annual rate to periodic rate based on frequency */
function periodicRate(annualRate: number, frequency: RepaymentFrequency): number {
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
function toPeriods(termMonths: number, frequency: RepaymentFrequency): number {
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
function periodsToMonths(periods: number, frequency: RepaymentFrequency): number {
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
function hemFloorCents(dependants: number): number {
  // Base HEM for single adult (approx $1,600/month), each dependant adds ~$500/month
  const baseCents = 160_000;
  const perDependantCents = 50_000;
  return baseCents + dependants * perDependantCents;
}

/**
 * ATO residual value percentages for novated leases.
 * Percentage of vehicle cost that must remain as residual at end of lease.
 */
function atoResidualPercentage(termYears: number): number {
  if (termYears <= 1) return 0.6556;
  if (termYears <= 2) return 0.5633;
  if (termYears <= 3) return 0.47;
  if (termYears <= 4) return 0.3644;
  return 0.2833;
}

/** Hardcoded Australian benchmark rates (Feb 2026 approximations) as fallback */
function hardcodedMarketRates(): MarketRates {
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
function defaultSwitchingCosts(): SwitchingCosts {
  return {
    dischargeFee: 35_000, // $350
    valuationFee: 30_000, // $300
    legalFee: 20_000, // $200
    applicationFee: 60_000, // $600
    totalCents: 145_000, // $1,450
  };
}

/** Compute median of a sorted numeric array */
function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class LoanCalculatorService {
  private cdrProductService: CdrProductService | null;

  constructor(cdrProductService?: CdrProductService) {
    this.cdrProductService = cdrProductService ?? null;
  }

  // ==========================================================================
  // EXISTING METHODS (unchanged signatures)
  // ==========================================================================

  /**
   * Home Loan Calculator
   *
   * Calculates regular payments, generates amortization schedule, and models
   * the impact of offset accounts and extra repayments.
   */
  calculateHomeLoan(params: HomeLoanParams): HomeLoanResult {
    const {
      principal,
      annualRate,
      termMonths,
      frequency,
      offsetBalance = 0,
      extraRepayment = 0,
    } = params;

    const rate = periodicRate(annualRate, frequency);
    const totalPeriods = toPeriods(termMonths, frequency);

    // Base payment (no offset, no extras)
    const basePayment = pmt(principal, rate, totalPeriods);

    // Base scenario total interest (for comparison)
    const baseTotalCost = basePayment * totalPeriods;
    const baseTotalInterest = baseTotalCost - principal;

    // Generate amortization schedule with offset + extra repayments
    const schedule: AmortizationEntry[] = [];
    let balance = principal;
    let totalInterestPaid = 0;
    let period = 0;

    while (balance > 0 && period < totalPeriods * 2) {
      // safety: max 2x term
      period++;
      // Interest is calculated on (balance - offset)
      const effectiveBalance = Math.max(0, balance - offsetBalance);
      const interestThisPeriod = Math.round(effectiveBalance * rate);

      // Principal portion of base payment
      let principalPortion = basePayment - interestThisPeriod;
      // Ensure we don't overpay
      if (principalPortion + extraRepayment >= balance) {
        principalPortion = balance;
        const finalPayment = interestThisPeriod + balance;
        schedule.push({
          period,
          payment: finalPayment,
          interest: interestThisPeriod,
          principal: balance,
          extraPrincipal: 0,
          balance: 0,
        });
        totalInterestPaid += interestThisPeriod;
        balance = 0;
        break;
      }

      const actualExtra = Math.min(extraRepayment, balance - principalPortion);
      balance -= principalPortion + actualExtra;
      totalInterestPaid += interestThisPeriod;

      schedule.push({
        period,
        payment: basePayment + actualExtra,
        interest: interestThisPeriod,
        principal: principalPortion,
        extraPrincipal: actualExtra,
        balance: Math.max(0, balance),
      });
    }

    const periodsToPayOff = period;
    const timeSavedMonths =
      periodsToMonths(totalPeriods, frequency) - periodsToMonths(periodsToPayOff, frequency);
    const interestSaved = baseTotalInterest - totalInterestPaid;
    const totalCost = principal + totalInterestPaid;

    return {
      regularPayment: basePayment,
      frequency,
      totalInterest: totalInterestPaid,
      totalCost,
      periodsToPayOff,
      timeSavedMonths: Math.max(0, timeSavedMonths),
      interestSaved: Math.max(0, interestSaved),
      schedule,
    };
  }

  /**
   * Car Finance Calculator — 3-way comparison
   *
   * Compares personal loan, chattel mortgage, and novated lease for the
   * same vehicle, accounting for tax benefits and FBT.
   */
  calculateCarFinance(params: CarFinanceParams): CarFinanceComparison {
    const {
      vehiclePrice,
      deposit,
      termMonths,
      personalLoanRate,
      chattelMortgageRate,
      novatedLeaseRate,
      marginalTaxRate,
      gstRegistered,
      annualSalary,
    } = params;

    const amountFinanced = vehiclePrice - deposit;
    const termYears = termMonths / 12;

    // --- 1. Personal Loan ---
    const plMonthly = pmt(amountFinanced, personalLoanRate / 12, termMonths);
    const plTotalCost = plMonthly * termMonths;
    const plTotalInterest = plTotalCost - amountFinanced;
    const personalLoan: CarFinanceOption = {
      type: 'Personal Loan',
      monthlyPayment: plMonthly,
      totalCost: plTotalCost + deposit,
      totalInterest: plTotalInterest,
      taxBenefit: 0,
      afterTaxCost: plTotalCost + deposit,
      effectiveRate: personalLoanRate,
    };

    // --- 2. Chattel Mortgage ---
    // GST-registered businesses can claim GST on purchase price
    const gstClaimable = gstRegistered ? Math.round(vehiclePrice / 11) : 0;
    const cmAmountFinanced = amountFinanced - gstClaimable;
    const cmMonthly = pmt(cmAmountFinanced, chattelMortgageRate / 12, termMonths);
    const cmTotalCost = cmMonthly * termMonths;
    const cmTotalInterest = cmTotalCost - cmAmountFinanced;
    // Interest is tax deductible for business use
    const cmInterestDeduction = Math.round(cmTotalInterest * marginalTaxRate);
    const chattelMortgage: CarFinanceOption = {
      type: 'Chattel Mortgage',
      monthlyPayment: cmMonthly,
      totalCost: cmTotalCost + deposit,
      totalInterest: cmTotalInterest,
      taxBenefit: cmInterestDeduction + gstClaimable,
      afterTaxCost: cmTotalCost + deposit - cmInterestDeduction - gstClaimable,
      effectiveRate: chattelMortgageRate,
    };

    // --- 3. Novated Lease ---
    const residualPercent = atoResidualPercentage(termYears);
    const residualValue = Math.round(vehiclePrice * residualPercent);
    const nlAmountFinanced = vehiclePrice - deposit - residualValue;
    const nlMonthly = pmt(nlAmountFinanced, novatedLeaseRate / 12, termMonths);

    // Running costs estimate (insurance, rego, fuel, maintenance) — ~$800/month
    const monthlyRunningCosts = 80_000; // cents
    const totalPreTaxSacrifice = (nlMonthly + monthlyRunningCosts) * termMonths;

    // Tax saving: salary sacrifice is pre-tax
    const taxSaving = Math.round(totalPreTaxSacrifice * marginalTaxRate);

    // FBT — statutory formula: 20% of base value
    const fbtValue = Math.round(vehiclePrice * 0.2 * termYears);
    const fbtTax = Math.round(fbtValue * 0.47 * 2.0802); // FBT rate × gross-up factor

    const nlAfterTaxCost = totalPreTaxSacrifice - taxSaving + fbtTax + residualValue + deposit;

    const novatedLease: CarFinanceOption = {
      type: 'Novated Lease',
      monthlyPayment: nlMonthly + monthlyRunningCosts,
      totalCost: totalPreTaxSacrifice + residualValue + deposit,
      totalInterest: Math.max(0, nlMonthly * termMonths - nlAmountFinanced),
      taxBenefit: taxSaving - fbtTax,
      afterTaxCost: nlAfterTaxCost,
      effectiveRate: novatedLeaseRate,
    };

    // Determine cheapest after-tax
    const options = [personalLoan, chattelMortgage, novatedLease];
    const cheapest = options.reduce((a, b) => (a.afterTaxCost < b.afterTaxCost ? a : b));

    return {
      personalLoan,
      chattelMortgage,
      novatedLease,
      cheapestOption: cheapest.type,
    };
  }

  /**
   * Personal Loan Calculator
   *
   * Simple amortization with comparison rate that incorporates fees
   * into the effective interest rate (as required by Australian law).
   */
  calculatePersonalLoan(params: PersonalLoanParams): PersonalLoanResult {
    const { principal, annualRate, termMonths, establishmentFee = 0, monthlyFee = 0 } = params;

    const monthlyRate = annualRate / 12;
    const monthlyPayment = pmt(principal, monthlyRate, termMonths);
    const totalRepayments = monthlyPayment * termMonths;
    const totalFees = establishmentFee + monthlyFee * termMonths;
    const totalCost = totalRepayments + totalFees;
    const totalInterest = totalRepayments - principal;

    // Comparison rate: find the rate that makes PMT equal when fees are included
    // Solve: PMT(principal - establishmentFee, compRate/12, termMonths) + monthlyFee = monthlyPayment
    // Use Newton-Raphson approximation
    let compRate = annualRate;
    const effectivePrincipal = principal;
    const targetPayment = monthlyPayment + monthlyFee;

    for (let i = 0; i < 100; i++) {
      const testPayment = pmt(effectivePrincipal + establishmentFee, compRate / 12, termMonths);
      // Adjust: if test is too low, rate needs to go up
      const diff = targetPayment - testPayment;
      if (Math.abs(diff) < 1) break; // within 1 cent
      compRate += diff / (effectivePrincipal * 0.01); // rough gradient
    }
    // Ensure comparison rate is at least the nominal rate
    compRate = Math.max(compRate, annualRate);

    return {
      monthlyPayment: monthlyPayment + monthlyFee,
      totalInterest,
      totalCost,
      comparisonRate: Math.round(compRate * 10000) / 10000,
    };
  }

  /**
   * Business Loan Calculator
   *
   * Models interest deductibility at the business's marginal tax rate,
   * plus optional equipment depreciation benefits.
   */
  calculateBusinessLoan(params: BusinessLoanParams): BusinessLoanResult {
    const {
      principal,
      annualRate,
      termMonths,
      marginalTaxRate,
      isEquipmentFinance = false,
      equipmentEffectiveLife = 5,
    } = params;

    const monthlyRate = annualRate / 12;
    const monthlyPayment = pmt(principal, monthlyRate, termMonths);
    const totalCost = monthlyPayment * termMonths;
    const totalInterest = totalCost - principal;

    // Interest is fully tax-deductible for business loans
    const taxSavingFromInterest = Math.round(totalInterest * marginalTaxRate);

    // Equipment depreciation benefit (diminishing value method)
    let depreciationBenefit = 0;
    if (isEquipmentFinance && equipmentEffectiveLife > 0) {
      // Diminishing value rate = 200% / effective life
      const dvRate = 2.0 / equipmentEffectiveLife;
      let bookValue = principal;
      let totalDepreciation = 0;

      for (let year = 0; year < equipmentEffectiveLife; year++) {
        const yearlyDep = Math.round(bookValue * dvRate);
        totalDepreciation += yearlyDep;
        bookValue -= yearlyDep;
        if (bookValue <= 0) break;
      }
      // Remaining book value in final year
      if (bookValue > 0) {
        totalDepreciation += bookValue;
      }
      depreciationBenefit = Math.round(totalDepreciation * marginalTaxRate);
    }

    const effectiveAfterTaxCost = totalCost - taxSavingFromInterest - depreciationBenefit;

    return {
      monthlyPayment,
      totalInterest,
      totalCost,
      taxDeductibleInterest: totalInterest,
      taxSavingFromInterest,
      depreciationBenefit,
      effectiveAfterTaxCost,
    };
  }

  /**
   * Refinance Savings Calculator
   *
   * Compares current loan vs new loan terms, calculates break-even period
   * and total savings net of switching costs.
   */
  calculateRefinanceSavings(params: RefinanceParams): RefinanceResult {
    const {
      currentBalance,
      currentRate,
      currentRemainingMonths,
      newRate,
      newTermMonths,
      switchingCosts,
    } = params;

    const currentMonthly = pmt(currentBalance, currentRate / 12, currentRemainingMonths);
    const newMonthly = pmt(currentBalance, newRate / 12, newTermMonths);

    const monthlySaving = currentMonthly - newMonthly;
    const breakEvenMonths =
      monthlySaving > 0 ? Math.ceil(switchingCosts / monthlySaving) : Infinity;

    const currentTotalCost = currentMonthly * currentRemainingMonths;
    const newTotalCost = newMonthly * newTermMonths + switchingCosts;
    const totalSavings = currentTotalCost - newTotalCost;

    return {
      currentMonthlyPayment: currentMonthly,
      newMonthlyPayment: newMonthly,
      monthlySaving: Math.max(0, monthlySaving),
      breakEvenMonths: monthlySaving > 0 ? breakEvenMonths : -1,
      totalSavings,
      currentTotalCost,
      newTotalCost,
    };
  }

  /**
   * Borrowing Capacity Calculator
   *
   * Applies APRA's 3% serviceability buffer, HEM floor for living expenses,
   * and DSR (Debt Service Ratio) cap at 6x gross income.
   */
  calculateBorrowingCapacity(params: BorrowingCapacityParams): BorrowingCapacityResult {
    const {
      grossAnnualIncome,
      otherIncome,
      existingDebts,
      livingExpenses,
      dependants,
      interestRate,
      bufferRate = 0.03,
    } = params;

    // Assessment rate = current rate + APRA buffer
    const assessmentRate = interestRate + bufferRate;

    // Net monthly income (gross / 12 — simplified, no tax calc here)
    // Use 70% of gross as approximate after-tax income
    const totalAnnualIncome = grossAnnualIncome + otherIncome;
    const netMonthlyIncome = Math.round((totalAnnualIncome * 0.7) / 12);

    // HEM floor
    const hem = hemFloorCents(dependants);
    const effectiveLivingExpenses = Math.max(livingExpenses, hem);

    // Available surplus for loan repayments
    const monthlyCommitments = existingDebts + effectiveLivingExpenses;
    const surplusIncome = Math.max(0, netMonthlyIncome - monthlyCommitments);

    // Max borrowing: what principal can surplusIncome service at assessment rate over 30 years?
    const monthlyAssessmentRate = assessmentRate / 12;
    const periods = 360; // 30-year standard assessment term
    let maxBorrowing = 0;

    if (surplusIncome > 0 && monthlyAssessmentRate > 0) {
      const factor = Math.pow(1 + monthlyAssessmentRate, periods);
      // Reverse PMT: P = payment * ((1+r)^n - 1) / (r * (1+r)^n)
      maxBorrowing = Math.round((surplusIncome * (factor - 1)) / (monthlyAssessmentRate * factor));
    }

    // DSR cap: max debt = 6x gross annual income
    const dsrCap = totalAnnualIncome * 6;
    maxBorrowing = Math.min(maxBorrowing, dsrCap);

    // Monthly repayment at assessment rate
    const monthlyRepayment =
      maxBorrowing > 0 ? pmt(maxBorrowing, monthlyAssessmentRate, periods) : 0;

    // DSR
    const dsr =
      totalAnnualIncome > 0 ? Math.round((maxBorrowing / totalAnnualIncome) * 100) / 100 : 0;

    return {
      maxBorrowing,
      assessmentRate,
      monthlyRepayment,
      netMonthlyIncome,
      monthlyCommitments,
      surplusIncome,
      dsr,
      hemFloor: hem,
    };
  }

  // ==========================================================================
  // NEW CDR-POWERED METHODS
  // ==========================================================================

  /**
   * Get Market Rates — real CDR rates or hardcoded fallback
   *
   * Queries CDR lending rates for the given product category, aggregates
   * into lowest/average/median by rate type, and returns a MarketRates
   * snapshot. Falls back to hardcoded AU benchmark rates if CDR is
   * unavailable or returns no data.
   */
  async getMarketRates(
    category: string = 'RESIDENTIAL_MORTGAGES',
    purpose?: string,
  ): Promise<MarketRates> {
    if (!this.cdrProductService) {
      return hardcodedMarketRates();
    }

    try {
      // Fetch best lending rates from CDR (generous limit to get good statistical sample)
      const bestRates = await this.cdrProductService.getBestRates(category, 'lending', 200);

      if (bestRates.length === 0) {
        return hardcodedMarketRates();
      }

      // Filter by purpose if specified
      const filtered = purpose
        ? bestRates.filter(
            (r) => !purpose || r.rateType?.includes('VARIABLE') || r.rateType?.includes('FIXED'),
          )
        : bestRates;

      if (filtered.length === 0) {
        return hardcodedMarketRates();
      }

      // Separate variable vs fixed rates
      const variableRates = filtered
        .filter((r) => r.rateType?.includes('VARIABLE'))
        .map((r) => r.rate)
        .sort((a, b) => a - b);

      const fixedRates = filtered
        .filter((r) => r.rateType?.includes('FIXED'))
        .map((r) => r.rate)
        .sort((a, b) => a - b);

      const allRates = filtered.map((r) => r.rate).sort((a, b) => a - b);

      // Extract lowest fixed by approximate term (CDR additionalValue might encode term)
      // For now, use the sorted fixed rates as a proxy
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
   * CDR Refinance Analysis
   *
   * Searches CDR products for lower-rate alternatives matching the loan's
   * purpose and repayment type. For each candidate, calculates amortization
   * over the remaining term and factors in itemized switching costs.
   * Recommends 'stay' if break-even > 24 months or saving < $50/month.
   */
  async refinanceAnalysis(params: CdrRefinanceParams): Promise<CdrRefinanceResult> {
    const {
      currentBalance,
      currentRate,
      currentRemainingMonths,
      loanPurpose,
      repaymentType,
      topN = 5,
    } = params;

    const currentMonthlyPayment = pmt(currentBalance, currentRate / 12, currentRemainingMonths);
    const costs = defaultSwitchingCosts();

    // If no CDR service, return empty result
    if (!this.cdrProductService) {
      return {
        currentRate,
        currentMonthlyPayment,
        recommendation: 'stay',
        reasoning: 'CDR product data is not available. Unable to search for alternatives.',
        alternatives: [],
        bestAlternative: null,
      };
    }

    try {
      // Search CDR for products with lower rates
      const searchResult = await this.cdrProductService.searchProducts({
        productCategory: 'RESIDENTIAL_MORTGAGES',
        maxRate: currentRate,
        loanPurpose,
        repaymentType,
        sortBy: 'rate',
        sortOrder: 'asc',
        limit: topN * 3, // fetch extra to allow dedup
      });

      // Deduplicate by data holder (one best product per lender)
      const seenHolders = new Set<string>();
      const candidates = searchResult.products
        .filter((p) => {
          if (p.bestRate == null || p.bestRate >= currentRate) return false;
          if (seenHolders.has(p.dataHolderName)) return false;
          seenHolders.add(p.dataHolderName);
          return true;
        })
        .slice(0, topN);

      const alternatives: RefinanceAlternative[] = candidates.map((candidate) => {
        const newRate = candidate.bestRate!;
        const newMonthlyPayment = pmt(currentBalance, newRate / 12, currentRemainingMonths);
        const monthlySaving = currentMonthlyPayment - newMonthlyPayment;
        const totalLifetimeSaving = monthlySaving * currentRemainingMonths - costs.totalCents;
        const breakEvenMonths =
          monthlySaving > 0 ? Math.ceil(costs.totalCents / monthlySaving) : -1;

        return {
          productId: candidate.id,
          productName: candidate.name,
          dataHolderName: candidate.dataHolderName,
          newRate,
          comparisonRate: candidate.comparisonRate,
          newMonthlyPayment,
          monthlySaving: Math.max(0, monthlySaving),
          totalLifetimeSaving,
          breakEvenMonths,
          switchingCostBreakdown: costs,
        };
      });

      // Sort by total lifetime saving descending
      alternatives.sort((a, b) => b.totalLifetimeSaving - a.totalLifetimeSaving);

      const best = alternatives.length > 0 ? alternatives[0] : null;

      // Recommendation logic
      let recommendation: 'switch' | 'stay' = 'stay';
      let reasoning: string;

      if (!best) {
        reasoning = 'No CDR products found with a lower rate than your current loan.';
      } else if (best.breakEvenMonths > 24) {
        reasoning = `Best alternative (${best.dataHolderName} — ${best.productName}) saves $${(best.monthlySaving / 100).toFixed(2)}/month but takes ${best.breakEvenMonths} months to break even on $${(costs.totalCents / 100).toFixed(2)} switching costs. Consider staying unless you value long-term savings.`;
      } else if (best.monthlySaving < 5_000) {
        // less than $50/month
        reasoning = `Best alternative saves only $${(best.monthlySaving / 100).toFixed(2)}/month. The hassle and switching costs of $${(costs.totalCents / 100).toFixed(2)} may not be worth it.`;
      } else {
        recommendation = 'switch';
        reasoning = `${best.dataHolderName} — ${best.productName} at ${(best.newRate * 100).toFixed(2)}% saves $${(best.monthlySaving / 100).toFixed(2)}/month ($${(best.totalLifetimeSaving / 100).toFixed(2)} over remaining term). Break-even in ${best.breakEvenMonths} months.`;
      }

      return {
        currentRate,
        currentMonthlyPayment,
        recommendation,
        reasoning,
        alternatives,
        bestAlternative: best,
      };
    } catch {
      return {
        currentRate,
        currentMonthlyPayment,
        recommendation: 'stay',
        reasoning: 'Error querying CDR product data. Unable to complete refinance analysis.',
        alternatives: [],
        bestAlternative: null,
      };
    }
  }

  /**
   * CDR Borrowing Capacity
   *
   * Uses the best variable rate from CDR data plus the APRA 3% serviceability
   * buffer to estimate maximum borrowing capacity. Applies HEM benchmark
   * for living expenses if not provided, and assumes 80% LVR for max
   * property price.
   */
  async borrowingCapacity(params: CdrBorrowingCapacityParams): Promise<CdrBorrowingCapacityResult> {
    const {
      grossAnnualIncome,
      otherIncome = 0,
      existingDebts = 0,
      livingExpenses = 0,
      dependants = 0,
      loanPurpose,
    } = params;

    const bufferRate = 0.03; // APRA mandatory 3% serviceability buffer

    // Fetch CDR best variable rate
    const category = loanPurpose ?? 'RESIDENTIAL_MORTGAGES';
    const marketRates = await this.getMarketRates(category);
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

    const monthlyRepayment =
      maxBorrowing > 0 ? pmt(maxBorrowing, monthlyAssessmentRate, periods) : 0;

    const dsr =
      totalAnnualIncome > 0 ? Math.round((maxBorrowing / totalAnnualIncome) * 100) / 100 : 0;

    // Max property price at 80% LVR
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
   * Rate Scenario Modelling
   *
   * Calculates repayments and total interest for multiple rate scenarios.
   * Auto-generates scenarios based on CDR market data: best rate, average
   * rate, and stress-test scenarios at +1%, +2%, +3% from current rate.
   */
  async rateScenario(params: RateScenarioParams): Promise<RateScenarioResult> {
    const { principal, termMonths, currentRate, loanPurpose } = params;

    const category = loanPurpose ?? 'RESIDENTIAL_MORTGAGES';
    const marketRates = await this.getMarketRates(category);

    // Build scenario rates
    const scenarioRates: Array<{ label: string; rate: number }> = [];

    // CDR best rate
    scenarioRates.push({
      label: `CDR Best (${marketRates.source})`,
      rate: marketRates.lowestVariable,
    });

    // CDR average rate
    scenarioRates.push({
      label: `CDR Average (${marketRates.source})`,
      rate: marketRates.averageVariable,
    });

    // Current rate if provided
    if (currentRate != null) {
      scenarioRates.push({ label: 'Your Current Rate', rate: currentRate });
    }

    // Stress-test scenarios from a reference rate
    const referenceRate = currentRate ?? marketRates.averageVariable;
    scenarioRates.push({ label: 'Stress +1%', rate: referenceRate + 0.01 });
    scenarioRates.push({ label: 'Stress +2%', rate: referenceRate + 0.02 });
    scenarioRates.push({ label: 'Stress +3%', rate: referenceRate + 0.03 });

    // Best fixed 1yr
    scenarioRates.push({
      label: `Best Fixed 1yr (${marketRates.source})`,
      rate: marketRates.lowestFixed1yr,
    });

    // Deduplicate by rate (rounded to 4 decimal places)
    const seen = new Set<string>();
    const uniqueScenarios = scenarioRates.filter((s) => {
      const key = s.rate.toFixed(4);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Calculate repayments for each scenario
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

    // Sort by rate ascending
    scenarios.sort((a, b) => a.rate - b.rate);

    return {
      principal,
      termMonths,
      scenarios,
      rateSource: marketRates.source,
    };
  }
}

export const loanCalculatorService = new LoanCalculatorService();
