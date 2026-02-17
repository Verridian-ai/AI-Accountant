/**
 * Loan Calculator — Type Definitions
 *
 * All interfaces and type definitions used across the loan calculator
 * sub-modules. ALL monetary amounts are in CENTS (integer arithmetic)
 * to avoid floating-point rounding errors common in financial software.
 */

// ============================================================================
// CORE TYPE DEFINITIONS
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
