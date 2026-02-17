/**
 * Income Tax and PAYG Calculation Functions
 * Australian income tax brackets, PAYG withholding, HELP repayments, and instalment calculations
 */

import type { PayPeriod, PAYGWithholdingResult, PAYGInstalmentResult } from './types.js';
import {
  TAX_BRACKETS_2024_25,
  PAYG_COEFFICIENTS_TAX_FREE,
  PAYG_COEFFICIENTS_NO_TAX_FREE,
  HELP_REPAYMENT_THRESHOLDS,
  PAY_PERIOD_MULTIPLIERS,
  WEEKS_PER_YEAR,
} from './types.js';
import { calculateMedicareLevyAmount } from './gst-calculator.js';

/**
 * Get current Australian financial year
 */
export function getCurrentFinancialYear(): string {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  if (month >= 7) {
    return `${year}-${(year + 1).toString().slice(2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(2)}`;
  }
}

/**
 * Get financial year dates
 */
export function getFinancialYearDates(taxYear: string): { start: string; end: string } {
  const startYear = parseInt(taxYear.split('-')[0]);
  return {
    start: `${startYear}-07-01`,
    end: `${startYear + 1}-06-30`,
  };
}

/**
 * Calculate income tax using ATO 2024-25 brackets
 *
 * Formula: baseTax + (taxableIncome - (min - 1)) * rate
 * The baseTax covers cumulative tax up to (min - 1), then the marginal rate applies.
 *
 * Example at $50,000 (falls in $45,001-$135,000 bracket at 30%):
 * - baseTax = $4,288 (tax on first $45,000)
 * - Tax = $4,288 + ($50,000 - $45,000) * 0.30 = $5,788
 */
export function calculateIncomeTax(taxableIncome: number): number {
  // Handle edge case of zero or negative income
  if (taxableIncome <= 0) {
    return 0;
  }

  for (const bracket of TAX_BRACKETS_2024_25) {
    if (taxableIncome <= bracket.max) {
      // Amount taxed at this bracket's marginal rate
      // (min - 1) is the threshold; income above this is taxed at bracket.rate
      const taxableInBracket = taxableIncome - bracket.min + 1;
      const tax = bracket.baseTax + taxableInBracket * bracket.rate;
      // Round to cents (2 decimal places)
      return Math.round(tax * 100) / 100;
    }
  }
  return 0;
}

/**
 * Calculate PAYG withholding for an employee payment
 * Uses ATO Schedule 1 formula method for 2024-25
 *
 * @param grossPay - Gross pay amount for the period
 * @param payPeriod - 'weekly', 'fortnightly', or 'monthly'
 * @param taxFreeThreshold - Whether employee has claimed tax-free threshold
 * @param helpDebt - Whether employee has HELP/HECS-HELP debt
 * @param medicareVariation - Medicare levy variation (full, half, exempt)
 * @returns PAYGWithholdingResult with all withholding components
 */
export function calculatePAYGWithholding(
  grossPay: number,
  payPeriod: PayPeriod = 'weekly',
  taxFreeThreshold: boolean = true,
  helpDebt: boolean = false,
  medicareVariation: 'full' | 'half' | 'exempt' = 'full',
): PAYGWithholdingResult {
  // Convert to weekly equivalent for calculation
  const multiplier = PAY_PERIOD_MULTIPLIERS[payPeriod];
  const weeklyGross = grossPay / multiplier;

  // Calculate annualised income for HELP thresholds
  const annualisedGross = weeklyGross * WEEKS_PER_YEAR;

  // Select coefficient table based on tax-free threshold claim
  const coefficients = taxFreeThreshold
    ? PAYG_COEFFICIENTS_TAX_FREE
    : PAYG_COEFFICIENTS_NO_TAX_FREE;

  // Find applicable coefficient bracket
  let weeklyTax = 0;
  const x = weeklyGross + 0.99; // Add 99 cents as per ATO formula

  for (const bracket of coefficients) {
    if (weeklyGross >= bracket.min && weeklyGross < bracket.max) {
      // Formula: y = ax - b
      weeklyTax = Math.max(0, bracket.a * x - bracket.b);
      break;
    }
  }

  // Round to nearest dollar
  weeklyTax = Math.round(weeklyTax);

  // Calculate HELP/HECS repayment if applicable
  let weeklyHelpRepayment = 0;
  if (helpDebt) {
    for (const threshold of HELP_REPAYMENT_THRESHOLDS) {
      if (annualisedGross >= threshold.min && annualisedGross < threshold.max) {
        // HELP is calculated on annualised income, then divided to pay period
        const annualHelpRepayment = annualisedGross * threshold.rate;
        weeklyHelpRepayment = annualHelpRepayment / WEEKS_PER_YEAR;
        break;
      }
    }
  }
  weeklyHelpRepayment = Math.round(weeklyHelpRepayment);

  // Calculate Medicare levy variation
  let weeklyMedicareLevy = 0;
  let weeklyMedicareVariation = 0;

  if (medicareVariation !== 'exempt') {
    // Standard Medicare levy is included in the PAYG coefficients
    // But we need to calculate it separately for variation purposes
    const annualMedicareLevy = calculateMedicareLevyAmount(annualisedGross);
    weeklyMedicareLevy = annualMedicareLevy / WEEKS_PER_YEAR;

    if (medicareVariation === 'half') {
      weeklyMedicareVariation = weeklyMedicareLevy * 0.5;
      weeklyTax -= weeklyMedicareVariation;
    }
  } else {
    // Full exemption - remove Medicare from withholding
    const annualMedicareLevy = calculateMedicareLevyAmount(annualisedGross);
    weeklyMedicareVariation = annualMedicareLevy / WEEKS_PER_YEAR;
    weeklyTax -= weeklyMedicareVariation;
  }

  // Convert back to pay period
  const taxWithheld = Math.round(weeklyTax * multiplier);
  const helpRepayment = Math.round(weeklyHelpRepayment * multiplier);
  const medicareLevy = Math.round(weeklyMedicareLevy * multiplier * 100) / 100;
  const medicareLevyVariation = Math.round(weeklyMedicareVariation * multiplier * 100) / 100;

  const totalWithholding = taxWithheld + helpRepayment;
  const netPay = grossPay - totalWithholding;

  const annualisedTax = weeklyTax * WEEKS_PER_YEAR;
  const effectiveRate = annualisedGross > 0 ? (annualisedTax / annualisedGross) * 100 : 0;

  return {
    grossPay: Math.round(grossPay * 100) / 100,
    payPeriod,
    taxWithheld: Math.round(taxWithheld * 100) / 100,
    helpRepayment: Math.round(helpRepayment * 100) / 100,
    medicareLevy,
    medicareLevyVariation,
    totalWithholding: Math.round(totalWithholding * 100) / 100,
    netPay: Math.round(netPay * 100) / 100,
    annualisedGross: Math.round(annualisedGross * 100) / 100,
    annualisedTax: Math.round(annualisedTax * 100) / 100,
    effectiveRate: Math.round(effectiveRate * 100) / 100,
  };
}

/**
 * Calculate PAYG instalment for business income
 * Used by businesses and sole traders to prepay tax on business income
 *
 * @param businessIncome - Annual business income (or year-to-date if calculating quarterly)
 * @param instalmentRate - The instalment rate from your latest tax assessment (e.g., 0.15 for 15%)
 * @param method - 'rate' (instalment rate method) or 'amount' (instalment amount method)
 * @returns PAYGInstalmentResult with instalment calculations
 */
export function calculatePAYGInstalment(
  businessIncome: number,
  instalmentRate: number,
  method: 'rate' | 'amount' = 'rate',
): PAYGInstalmentResult {
  let instalmentAmount: number;
  let description: string;

  if (method === 'rate') {
    // Instalment rate method: Income x Rate
    instalmentAmount = businessIncome * instalmentRate;
    description = `PAYG instalment calculated at ${(instalmentRate * 100).toFixed(2)}% of business income`;
  } else {
    // Amount method: The rate IS the fixed quarterly amount
    instalmentAmount = instalmentRate * 4; // Annual from quarterly
    description = `PAYG instalment using fixed amount method`;
  }

  // Quarterly instalment (4 instalments per year)
  const quarterlyInstalment = instalmentAmount / 4;

  return {
    businessIncome: Math.round(businessIncome * 100) / 100,
    instalmentRate: Math.round(instalmentRate * 10000) / 10000,
    instalmentAmount: Math.round(instalmentAmount * 100) / 100,
    quarterlyInstalment: Math.round(quarterlyInstalment * 100) / 100,
    description,
  };
}

/**
 * Calculate weekly PAYG withholding from annual salary
 * Convenience function for employers
 */
export function calculateWeeklyPAYGFromAnnual(
  annualSalary: number,
  taxFreeThreshold: boolean = true,
  helpDebt: boolean = false,
): PAYGWithholdingResult {
  const weeklyPay = annualSalary / WEEKS_PER_YEAR;
  return calculatePAYGWithholding(weeklyPay, 'weekly', taxFreeThreshold, helpDebt);
}

/**
 * Calculate fortnightly PAYG withholding from annual salary
 * Convenience function for employers
 */
export function calculateFortnightlyPAYGFromAnnual(
  annualSalary: number,
  taxFreeThreshold: boolean = true,
  helpDebt: boolean = false,
): PAYGWithholdingResult {
  const fortnightlyPay = annualSalary / 26;
  return calculatePAYGWithholding(fortnightlyPay, 'fortnightly', taxFreeThreshold, helpDebt);
}

/**
 * Calculate monthly PAYG withholding from annual salary
 * Convenience function for employers
 */
export function calculateMonthlyPAYGFromAnnual(
  annualSalary: number,
  taxFreeThreshold: boolean = true,
  helpDebt: boolean = false,
): PAYGWithholdingResult {
  const monthlyPay = annualSalary / 12;
  return calculatePAYGWithholding(monthlyPay, 'monthly', taxFreeThreshold, helpDebt);
}

/**
 * Get HELP/HECS repayment rate for a given income
 */
export function getHelpRepaymentRate(annualIncome: number): number {
  for (const threshold of HELP_REPAYMENT_THRESHOLDS) {
    if (annualIncome >= threshold.min && annualIncome < threshold.max) {
      return threshold.rate;
    }
  }
  return 0;
}

/**
 * Calculate total HELP/HECS repayment for a financial year
 */
export function calculateAnnualHelpRepayment(annualIncome: number): number {
  const rate = getHelpRepaymentRate(annualIncome);
  return Math.round(annualIncome * rate * 100) / 100;
}
