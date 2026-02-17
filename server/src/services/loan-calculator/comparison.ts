/**
 * Loan Calculator — Comparison Logic
 *
 * Car finance 3-way comparison, personal loan with comparison rate,
 * and business loan with tax deductibility.
 */

import type {
  CarFinanceParams,
  CarFinanceComparison,
  CarFinanceOption,
  PersonalLoanParams,
  PersonalLoanResult,
  BusinessLoanParams,
  BusinessLoanResult,
  RefinanceParams,
  RefinanceResult,
  BorrowingCapacityParams,
  BorrowingCapacityResult,
} from './types.js';
import { pmt, atoResidualPercentage, hemFloorCents } from './helpers.js';

/**
 * Car Finance Calculator — 3-way comparison
 *
 * Compares personal loan, chattel mortgage, and novated lease for the
 * same vehicle, accounting for tax benefits and FBT.
 */
export function calculateCarFinance(params: CarFinanceParams): CarFinanceComparison {
  const {
    vehiclePrice,
    deposit,
    termMonths,
    personalLoanRate,
    chattelMortgageRate,
    novatedLeaseRate,
    marginalTaxRate,
    gstRegistered,
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
  const fbtTax = Math.round(fbtValue * 0.47 * 2.0802); // FBT rate x gross-up factor

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
export function calculatePersonalLoan(params: PersonalLoanParams): PersonalLoanResult {
  const { principal, annualRate, termMonths, establishmentFee = 0, monthlyFee = 0 } = params;

  const monthlyRate = annualRate / 12;
  const monthlyPayment = pmt(principal, monthlyRate, termMonths);
  const totalRepayments = monthlyPayment * termMonths;
  const totalFees = establishmentFee + monthlyFee * termMonths;
  const totalCost = totalRepayments + totalFees;
  const totalInterest = totalRepayments - principal;

  // Comparison rate: find the rate that makes PMT equal when fees are included
  // Use Newton-Raphson approximation
  let compRate = annualRate;
  const effectivePrincipal = principal;
  const targetPayment = monthlyPayment + monthlyFee;

  for (let i = 0; i < 100; i++) {
    const testPayment = pmt(effectivePrincipal + establishmentFee, compRate / 12, termMonths);
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
export function calculateBusinessLoan(params: BusinessLoanParams): BusinessLoanResult {
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
export function calculateRefinanceSavings(params: RefinanceParams): RefinanceResult {
  const {
    currentBalance,
    currentRate,
    currentRemainingMonths,
    newRate,
    newTermMonths,
    switchingCosts,
  } = params;

  const currentMonthlyPayment = pmt(currentBalance, currentRate / 12, currentRemainingMonths);
  const newMonthlyPayment = pmt(currentBalance, newRate / 12, newTermMonths);
  const monthlySaving = currentMonthlyPayment - newMonthlyPayment;

  const breakEvenMonths = monthlySaving > 0 ? Math.ceil(switchingCosts / monthlySaving) : 0;

  const currentTotalCost = currentMonthlyPayment * currentRemainingMonths;
  const newTotalCost = newMonthlyPayment * newTermMonths + switchingCosts;
  const totalSavings = currentTotalCost - newTotalCost;

  return {
    currentMonthlyPayment,
    newMonthlyPayment,
    monthlySaving,
    breakEvenMonths,
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

  const assessmentRate = interestRate + bufferRate;
  const totalAnnualIncome = grossAnnualIncome + otherIncome;
  const netMonthlyIncome = Math.round((totalAnnualIncome * 0.7) / 12);

  const hem = hemFloorCents(dependants);
  const effectiveLivingExpenses = Math.max(livingExpenses, hem);

  const monthlyCommitments = existingDebts + effectiveLivingExpenses;
  const surplusIncome = Math.max(0, netMonthlyIncome - monthlyCommitments);

  const monthlyAssessmentRate = assessmentRate / 12;
  const periods = 360; // 30 years
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
