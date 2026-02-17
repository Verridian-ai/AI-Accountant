/**
 * Tax Types and Constants
 * All type definitions, interfaces, and tax bracket constants for Australian tax calculations
 */

// ====== Pay Period Type ======

export type PayPeriod = 'weekly' | 'fortnightly' | 'monthly';

// ====== Result Interfaces ======

export interface TaxCalculationResult {
  grossIncome: number;
  deductions: number;
  taxableIncome: number;
  incomeTax: number;
  medicareLevy: number;
  medicareSurcharge: number;
  taxOffsets: number;
  totalTax: number;
  effectiveTaxRate: number;
  takeHomeAnnual: number;
  takeHomeMonthly: number;
}

export interface CGTCalculationResult {
  costBase: number;
  capitalProceeds: number;
  grossGain: number;
  discountEligible: boolean;
  discountAmount: number;
  netGain: number;
  capitalLoss: number;
  holdingDays: number;
}

export interface DepreciationResult {
  openingValue: number;
  depreciation: number;
  closingValue: number;
  deductibleAmount: number;
  method: string;
}

export interface PAYGWithholdingResult {
  grossPay: number;
  payPeriod: PayPeriod;
  taxWithheld: number;
  helpRepayment: number;
  medicareLevy: number;
  medicareLevyVariation: number;
  totalWithholding: number;
  netPay: number;
  annualisedGross: number;
  annualisedTax: number;
  effectiveRate: number;
}

export interface PAYGInstalmentResult {
  businessIncome: number;
  instalmentRate: number;
  instalmentAmount: number;
  quarterlyInstalment: number;
  description: string;
}

export interface MedicareLevySurchargeResult {
  income: number;
  hasPrivateHealth: boolean;
  surchargeRate: number;
  surchargeAmount: number;
  tier: string;
}

// ====== Tax Bracket Constants (2024-25 Stage 3) ======

export const TAX_BRACKETS_2024_25 = [
  { min: 0, max: 18200, rate: 0, baseTax: 0 },
  { min: 18201, max: 45000, rate: 0.16, baseTax: 0 },
  { min: 45001, max: 135000, rate: 0.3, baseTax: 4288 },
  { min: 135001, max: 190000, rate: 0.37, baseTax: 31288 },
  { min: 190001, max: Infinity, rate: 0.45, baseTax: 51638 },
];

// ====== Deduction Rates 2024-25 ======

export const DEDUCTION_RATES = {
  wfhHourlyRate: 0.67, // $0.67 per hour
  motorVehicleCentsPerKm: 85, // 85 cents per km
  motorVehicleMaxKm: 5000,
  instantWriteOffThreshold: 20000, // $20,000
};

// ====== PAYG Withholding Coefficients (ATO NAT 1004) ======
// Formula: y = ax - b where x = gross weekly earnings + 0.99, y = weekly withholding

// Tax-free threshold claimed
export const PAYG_COEFFICIENTS_TAX_FREE = [
  { min: 0, max: 359, a: 0, b: 0 },
  { min: 359, max: 438, a: 0.19, b: 68.3462 },
  { min: 438, max: 548, a: 0.29, b: 112.1942 },
  { min: 548, max: 721, a: 0.21, b: 68.3465 },
  { min: 721, max: 865, a: 0.219, b: 74.8369 },
  { min: 865, max: 1282, a: 0.3477, b: 186.2119 },
  { min: 1282, max: 2307, a: 0.345, b: 182.7504 },
  { min: 2307, max: 2596, a: 0.39, b: 286.5965 },
  { min: 2596, max: 3653, a: 0.47, b: 494.4196 },
  { min: 3653, max: Infinity, a: 0.47, b: 494.4196 },
];

// No tax-free threshold claimed
export const PAYG_COEFFICIENTS_NO_TAX_FREE = [
  { min: 0, max: 88, a: 0.19, b: 0.19 },
  { min: 88, max: 371, a: 0.2348, b: 3.9639 },
  { min: 371, max: 515, a: 0.219, b: -1.9003 },
  { min: 515, max: 932, a: 0.3477, b: 64.4297 },
  { min: 932, max: 1957, a: 0.345, b: 61.9132 },
  { min: 1957, max: 2246, a: 0.39, b: 150.0093 },
  { min: 2246, max: 3303, a: 0.47, b: 329.8324 },
  { min: 3303, max: Infinity, a: 0.47, b: 329.8324 },
];

// ====== HELP/HECS-HELP Repayment Thresholds 2024-25 ======

export const HELP_REPAYMENT_THRESHOLDS = [
  { min: 0, max: 54435, rate: 0 },
  { min: 54435, max: 62850, rate: 0.01 },
  { min: 62850, max: 66620, rate: 0.02 },
  { min: 66620, max: 70618, rate: 0.025 },
  { min: 70618, max: 74855, rate: 0.03 },
  { min: 74855, max: 79346, rate: 0.035 },
  { min: 79346, max: 84107, rate: 0.04 },
  { min: 84107, max: 89154, rate: 0.045 },
  { min: 89154, max: 94503, rate: 0.05 },
  { min: 94503, max: 100174, rate: 0.055 },
  { min: 100174, max: 106185, rate: 0.06 },
  { min: 106185, max: 112556, rate: 0.065 },
  { min: 112556, max: 119309, rate: 0.07 },
  { min: 119309, max: 126467, rate: 0.075 },
  { min: 126467, max: 134056, rate: 0.08 },
  { min: 134056, max: 142100, rate: 0.085 },
  { min: 142100, max: 150626, rate: 0.09 },
  { min: 150626, max: 159663, rate: 0.095 },
  { min: 159663, max: Infinity, rate: 0.1 },
];

// ====== Medicare Levy Constants ======

export const MEDICARE_LEVY_REDUCTION = {
  fullExemptionThreshold: 24276, // Below this = no levy
  shadeInThreshold: 30345, // Reduced levy between these thresholds
  shadeInRate: 0.1, // 10% of excess over lower threshold
  standardRate: 0.02, // 2% standard rate
};

// Medicare levy surcharge thresholds 2024-25 (singles)
export const MLS_THRESHOLDS = {
  tier0Max: 93000, // No surcharge below this
  tier1Max: 108000, // 1.0% surcharge
  tier2Max: 144000, // 1.25% surcharge
  tier3Min: 144001, // 1.5% surcharge above this
  tier1Rate: 0.01,
  tier2Rate: 0.0125,
  tier3Rate: 0.015,
};

// ====== Pay Period Constants ======

export const PAY_PERIOD_MULTIPLIERS: Record<PayPeriod, number> = {
  weekly: 1,
  fortnightly: 2,
  monthly: 4.333, // Average weeks per month
};

export const WEEKS_PER_YEAR = 52;
