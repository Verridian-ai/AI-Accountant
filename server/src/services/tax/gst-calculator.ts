/**
 * GST and Medicare Calculation Functions
 * Australian GST, Medicare levy, LITO, and Medicare Levy Surcharge calculations
 */

import type { MedicareLevySurchargeResult } from './types.js';
import { MEDICARE_LEVY_REDUCTION, MLS_THRESHOLDS } from './types.js';

/**
 * Calculate Medicare levy
 */
export function calculateMedicareLevy(
  taxableIncome: number,
  hasPrivateHealth: boolean = false,
): { levy: number; surcharge: number } {
  let levy = 0;
  let surcharge = 0;

  // Base Medicare levy (2%)
  if (taxableIncome > 30345) {
    levy = taxableIncome * 0.02;
  } else if (taxableIncome > 24276) {
    // Shade-in range
    levy = (taxableIncome - 24276) * 0.1;
  }

  // Medicare levy surcharge (if no private health)
  if (!hasPrivateHealth && taxableIncome > 93000) {
    if (taxableIncome > 144000) {
      surcharge = taxableIncome * 0.015; // 1.5%
    } else if (taxableIncome > 108000) {
      surcharge = taxableIncome * 0.0125; // 1.25%
    } else {
      surcharge = taxableIncome * 0.01; // 1%
    }
  }

  return { levy: Math.round(levy * 100) / 100, surcharge: Math.round(surcharge * 100) / 100 };
}

/**
 * Calculate LITO (Low Income Tax Offset)
 */
export function calculateLITO(taxableIncome: number): number {
  if (taxableIncome <= 37500) {
    return 700;
  } else if (taxableIncome < 66833) {
    return Math.max(0, 700 - (taxableIncome - 37500) * 0.05);
  }
  return 0;
}

/**
 * Helper function to calculate Medicare levy amount (without surcharge)
 */
export function calculateMedicareLevyAmount(taxableIncome: number): number {
  if (taxableIncome <= MEDICARE_LEVY_REDUCTION.fullExemptionThreshold) {
    return 0;
  } else if (taxableIncome <= MEDICARE_LEVY_REDUCTION.shadeInThreshold) {
    // Shade-in range: 10% of excess over lower threshold
    return (
      (taxableIncome - MEDICARE_LEVY_REDUCTION.fullExemptionThreshold) *
      MEDICARE_LEVY_REDUCTION.shadeInRate
    );
  } else {
    // Standard 2% rate
    return taxableIncome * MEDICARE_LEVY_REDUCTION.standardRate;
  }
}

/**
 * Calculate Medicare Levy Surcharge
 * Applied to individuals without adequate private health insurance
 *
 * @param income - Income for MLS purposes (taxable income + reportable fringe benefits + reportable super contributions)
 * @param privateHealthCover - Whether the person has adequate private health insurance
 * @returns MedicareLevySurchargeResult with surcharge details
 */
export function calculateMedicareLevySurcharge(
  income: number,
  privateHealthCover: boolean = false,
): MedicareLevySurchargeResult {
  // No surcharge if has private health cover
  if (privateHealthCover) {
    return {
      income: Math.round(income * 100) / 100,
      hasPrivateHealth: true,
      surchargeRate: 0,
      surchargeAmount: 0,
      tier: 'Exempt - has private health insurance',
    };
  }

  // No surcharge below threshold
  if (income <= MLS_THRESHOLDS.tier0Max) {
    return {
      income: Math.round(income * 100) / 100,
      hasPrivateHealth: false,
      surchargeRate: 0,
      surchargeAmount: 0,
      tier: 'Base tier - below threshold',
    };
  }

  let surchargeRate: number;
  let tier: string;

  if (income <= MLS_THRESHOLDS.tier1Max) {
    surchargeRate = MLS_THRESHOLDS.tier1Rate;
    tier = 'Tier 1 ($93,001 - $108,000)';
  } else if (income <= MLS_THRESHOLDS.tier2Max) {
    surchargeRate = MLS_THRESHOLDS.tier2Rate;
    tier = 'Tier 2 ($108,001 - $144,000)';
  } else {
    surchargeRate = MLS_THRESHOLDS.tier3Rate;
    tier = 'Tier 3 ($144,001+)';
  }

  const surchargeAmount = income * surchargeRate;

  return {
    income: Math.round(income * 100) / 100,
    hasPrivateHealth: false,
    surchargeRate,
    surchargeAmount: Math.round(surchargeAmount * 100) / 100,
    tier,
  };
}
