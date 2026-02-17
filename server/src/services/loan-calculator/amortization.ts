/**
 * Loan Calculator — Amortization, Refinance, and Borrowing Capacity
 *
 * Home loan calculation with full amortization schedule generation,
 * refinance savings calculator, and borrowing capacity calculator.
 */

import type {
  HomeLoanParams,
  HomeLoanResult,
  AmortizationEntry,
  RefinanceParams,
  RefinanceResult,
  BorrowingCapacityParams,
  BorrowingCapacityResult,
} from './types.js';
import { pmt, periodicRate, toPeriods, periodsToMonths, hemFloorCents } from './helpers.js';

/**
 * Home Loan Calculator
 *
 * Calculates regular payments, generates amortization schedule, and models
 * the impact of offset accounts and extra repayments.
 */
export function calculateHomeLoan(params: HomeLoanParams): HomeLoanResult {
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
 * Refinance Savings Calculator
 *
 * Compares current loan vs new loan terms, calculates break-even period
 * and total savings net of switching costs.
 */
export function calculateRefinanceSavings(params: RefinanceParams): RefinanceResult {
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
  const breakEvenMonths = monthlySaving > 0 ? Math.ceil(switchingCosts / monthlySaving) : Infinity;

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
export function calculateBorrowingCapacity(
  params: BorrowingCapacityParams,
): BorrowingCapacityResult {
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

  // Net monthly income (70% of gross as approximate after-tax income)
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
  const monthlyRepayment = maxBorrowing > 0 ? pmt(maxBorrowing, monthlyAssessmentRate, periods) : 0;

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
