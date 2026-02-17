/**
 * Tax Module - Barrel Export
 * Re-exports all tax types, functions, and the TaxService class
 */

export type {
  PayPeriod,
  TaxCalculationResult,
  CGTCalculationResult,
  DepreciationResult,
  PAYGWithholdingResult,
  PAYGInstalmentResult,
  MedicareLevySurchargeResult,
} from './types.js';

export {
  calculateMedicareLevy,
  calculateLITO,
  calculateMedicareLevyAmount,
  calculateMedicareLevySurcharge,
} from './gst-calculator.js';

export {
  getCurrentFinancialYear,
  getFinancialYearDates,
  calculateIncomeTax,
  calculatePAYGWithholding,
  calculatePAYGInstalment,
  calculateWeeklyPAYGFromAnnual,
  calculateFortnightlyPAYGFromAnnual,
  calculateMonthlyPAYGFromAnnual,
  getHelpRepaymentRate,
  calculateAnnualHelpRepayment,
} from './income-tax.js';

export { TaxService, taxService } from './tax-service.js';
