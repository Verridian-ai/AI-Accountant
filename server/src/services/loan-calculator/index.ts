/**
 * Loan Calculator — Barrel Export
 *
 * Re-exports all public types, interfaces, and the main service class
 * from the loan calculator sub-modules.
 */

// All type definitions
export type {
  RepaymentFrequency,
  HomeLoanParams,
  AmortizationEntry,
  HomeLoanResult,
  CarFinanceParams,
  CarFinanceOption,
  CarFinanceComparison,
  PersonalLoanParams,
  PersonalLoanResult,
  BusinessLoanParams,
  BusinessLoanResult,
  RefinanceParams,
  RefinanceResult,
  BorrowingCapacityParams,
  BorrowingCapacityResult,
  MarketRates,
  CdrRefinanceParams,
  RefinanceAlternative,
  SwitchingCosts,
  CdrRefinanceResult,
  CdrBorrowingCapacityParams,
  CdrBorrowingCapacityResult,
  RateScenarioParams,
  RateScenarioEntry,
  RateScenarioResult,
} from './types.js';

// Main service class and singleton instance
export { LoanCalculatorService, loanCalculatorService } from './loan-calculator.js';

// Standalone functions (for direct use without the class)
export { calculateHomeLoan } from './amortization.js';
export {
  calculateCarFinance,
  calculatePersonalLoan,
  calculateBusinessLoan,
  calculateRefinanceSavings,
  calculateBorrowingCapacity,
} from './comparison.js';
export { getMarketRates, refinanceAnalysis, borrowingCapacity, rateScenario } from './scenarios.js';
