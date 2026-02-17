/**
 * Loan Calculator — Main Service Class
 *
 * Composes all loan calculator sub-modules into a single service class
 * with the same public API as the original monolithic file. Delegates
 * to standalone functions in amortization, comparison, and scenarios modules.
 */

import type { CdrProductService } from '../cdr-products.js';
import type {
  HomeLoanParams,
  HomeLoanResult,
  CarFinanceParams,
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
  CdrRefinanceResult,
  CdrBorrowingCapacityParams,
  CdrBorrowingCapacityResult,
  RateScenarioParams,
  RateScenarioResult,
} from './types.js';
import { calculateHomeLoan } from './amortization.js';
import {
  calculateCarFinance,
  calculatePersonalLoan,
  calculateBusinessLoan,
  calculateRefinanceSavings,
  calculateBorrowingCapacity,
} from './comparison.js';
import { getMarketRates, refinanceAnalysis, borrowingCapacity, rateScenario } from './scenarios.js';

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
    return calculateHomeLoan(params);
  }

  /**
   * Car Finance Calculator — 3-way comparison
   *
   * Compares personal loan, chattel mortgage, and novated lease for the
   * same vehicle, accounting for tax benefits and FBT.
   */
  calculateCarFinance(params: CarFinanceParams): CarFinanceComparison {
    return calculateCarFinance(params);
  }

  /**
   * Personal Loan Calculator
   *
   * Simple amortization with comparison rate that incorporates fees
   * into the effective interest rate (as required by Australian law).
   */
  calculatePersonalLoan(params: PersonalLoanParams): PersonalLoanResult {
    return calculatePersonalLoan(params);
  }

  /**
   * Business Loan Calculator
   *
   * Models interest deductibility at the business's marginal tax rate,
   * plus optional equipment depreciation benefits.
   */
  calculateBusinessLoan(params: BusinessLoanParams): BusinessLoanResult {
    return calculateBusinessLoan(params);
  }

  /**
   * Refinance Savings Calculator
   *
   * Compares current loan vs new loan terms, calculates break-even period
   * and total savings net of switching costs.
   */
  calculateRefinanceSavings(params: RefinanceParams): RefinanceResult {
    return calculateRefinanceSavings(params);
  }

  /**
   * Borrowing Capacity Calculator
   *
   * Applies APRA's 3% serviceability buffer, HEM floor for living expenses,
   * and DSR (Debt Service Ratio) cap at 6x gross income.
   */
  calculateBorrowingCapacity(params: BorrowingCapacityParams): BorrowingCapacityResult {
    return calculateBorrowingCapacity(params);
  }

  // ==========================================================================
  // CDR-POWERED METHODS
  // ==========================================================================

  /**
   * Get Market Rates — real CDR rates or hardcoded fallback
   */
  async getMarketRates(
    category: string = 'RESIDENTIAL_MORTGAGES',
    purpose?: string,
  ): Promise<MarketRates> {
    return getMarketRates(this.cdrProductService, category, purpose);
  }

  /**
   * CDR Refinance Analysis
   */
  async refinanceAnalysis(params: CdrRefinanceParams): Promise<CdrRefinanceResult> {
    return refinanceAnalysis(this.cdrProductService, params);
  }

  /**
   * CDR Borrowing Capacity
   */
  async borrowingCapacity(params: CdrBorrowingCapacityParams): Promise<CdrBorrowingCapacityResult> {
    return borrowingCapacity(this.cdrProductService, params);
  }

  /**
   * Rate Scenario Modelling
   */
  async rateScenario(params: RateScenarioParams): Promise<RateScenarioResult> {
    return rateScenario(this.cdrProductService, params);
  }
}

export const loanCalculatorService = new LoanCalculatorService();
