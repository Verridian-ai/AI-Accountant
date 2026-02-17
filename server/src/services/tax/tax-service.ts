/**
 * Tax Service Class
 * Main TaxService with full tax liability calculation, deductions, CGT, depreciation,
 * and PAYG withholding methods. Database operations delegated to tax-db.
 */

import type {
  PayPeriod,
  TaxCalculationResult,
  CGTCalculationResult,
  DepreciationResult,
  PAYGWithholdingResult,
  PAYGInstalmentResult,
  MedicareLevySurchargeResult,
} from './types.js';
import { DEDUCTION_RATES } from './types.js';

import { calculateIncomeTax } from './income-tax.js';
import {
  calculateMedicareLevy,
  calculateLITO,
  calculateMedicareLevySurcharge,
} from './gst-calculator.js';
import {
  calculatePAYGWithholding,
  calculatePAYGInstalment,
  calculateWeeklyPAYGFromAnnual,
  calculateFortnightlyPAYGFromAnnual,
  calculateMonthlyPAYGFromAnnual,
  getHelpRepaymentRate,
  calculateAnnualHelpRepayment,
} from './income-tax.js';
import {
  saveDeduction,
  getDeductions,
  saveCGTAsset,
  recordCGTDisposal,
  getTaxYearSummary,
  saveTaxYearSummary,
  calculateFromTransactions,
} from './tax-db.js';

/**
 * Tax Service class
 */
export class TaxService {
  /**
   * Calculate full tax liability
   */
  calculateFullTax(
    grossIncome: number,
    totalDeductions: number = 0,
    hasPrivateHealth: boolean = false,
    applyLITO: boolean = true,
  ): TaxCalculationResult {
    const taxableIncome = Math.max(0, grossIncome - totalDeductions);
    const incomeTax = calculateIncomeTax(taxableIncome);
    const medicare = calculateMedicareLevy(taxableIncome, hasPrivateHealth);

    let taxOffsets = 0;
    if (applyLITO) {
      taxOffsets += calculateLITO(taxableIncome);
    }

    const totalTax = Math.max(0, incomeTax + medicare.levy + medicare.surcharge - taxOffsets);
    const effectiveTaxRate = grossIncome > 0 ? (totalTax / grossIncome) * 100 : 0;

    return {
      grossIncome,
      deductions: totalDeductions,
      taxableIncome,
      incomeTax: Math.round(incomeTax * 100) / 100,
      medicareLevy: medicare.levy,
      medicareSurcharge: medicare.surcharge,
      taxOffsets: Math.round(taxOffsets * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      effectiveTaxRate: Math.round(effectiveTaxRate * 100) / 100,
      takeHomeAnnual: Math.round((grossIncome - totalTax) * 100) / 100,
      takeHomeMonthly: Math.round(((grossIncome - totalTax) / 12) * 100) / 100,
    };
  }

  /** Calculate WFH deduction */
  calculateWFHDeduction(hoursPerWeek: number, weeksWorked: number = 48): number {
    const totalHours = hoursPerWeek * weeksWorked;
    return Math.round(totalHours * DEDUCTION_RATES.wfhHourlyRate * 100) / 100;
  }

  /** Calculate motor vehicle deduction (cents per km method) */
  calculateMotorVehicleDeduction(kmTravelled: number): number {
    const claimableKm = Math.min(kmTravelled, DEDUCTION_RATES.motorVehicleMaxKm);
    return Math.round(claimableKm * DEDUCTION_RATES.motorVehicleCentsPerKm) / 100;
  }

  /** Calculate capital gain */
  calculateCapitalGain(
    acquisitionDate: string,
    acquisitionCost: number,
    disposalDate: string,
    disposalProceeds: number,
    incidentalCosts: number = 0,
    disposalCosts: number = 0,
    carriedForwardLosses: number = 0,
  ): CGTCalculationResult {
    const costBase = acquisitionCost + incidentalCosts;
    const capitalProceeds = disposalProceeds - disposalCosts;
    const acqDate = new Date(acquisitionDate);
    const dispDate = new Date(disposalDate);
    const holdingDays = Math.floor(
      (dispDate.getTime() - acqDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const discountEligible = holdingDays >= 365;

    let grossGain = 0;
    let capitalLoss = 0;
    if (capitalProceeds > costBase) {
      grossGain = capitalProceeds - costBase;
    } else {
      capitalLoss = costBase - capitalProceeds;
    }

    if (grossGain > 0 && carriedForwardLosses > 0) {
      const lossOffset = Math.min(grossGain, carriedForwardLosses);
      grossGain -= lossOffset;
    }

    let discountAmount = 0;
    let netGain = grossGain;
    if (discountEligible && grossGain > 0) {
      discountAmount = grossGain * 0.5;
      netGain = grossGain - discountAmount;
    }

    return {
      costBase,
      capitalProceeds,
      grossGain,
      discountEligible,
      discountAmount: Math.round(discountAmount * 100) / 100,
      netGain: Math.round(netGain * 100) / 100,
      capitalLoss,
      holdingDays,
    };
  }

  /** Calculate depreciation (diminishing value or prime cost) */
  calculateDepreciation(
    purchaseCost: number,
    effectiveLife: number,
    openingValue?: number,
    method: 'diminishing' | 'prime_cost' = 'diminishing',
    businessUse: number = 100,
  ): DepreciationResult {
    const currentValue = openingValue ?? purchaseCost;

    if (purchaseCost < DEDUCTION_RATES.instantWriteOffThreshold) {
      const deductible = currentValue * (businessUse / 100);
      return {
        openingValue: currentValue,
        depreciation: currentValue,
        closingValue: 0,
        deductibleAmount: Math.round(deductible * 100) / 100,
        method: 'instant_write_off',
      };
    }

    let depreciation: number;
    if (method === 'diminishing') {
      depreciation = currentValue * (2.0 / effectiveLife);
    } else {
      depreciation = purchaseCost * (1.0 / effectiveLife);
    }

    depreciation = Math.min(depreciation, currentValue);
    const closingValue = currentValue - depreciation;
    const deductibleAmount = depreciation * (businessUse / 100);

    return {
      openingValue: currentValue,
      depreciation: Math.round(depreciation * 100) / 100,
      closingValue: Math.round(closingValue * 100) / 100,
      deductibleAmount: Math.round(deductibleAmount * 100) / 100,
      method,
    };
  }

  // ====== PAYG Withholding Methods ======

  calculatePAYGWithholding(
    grossPay: number,
    payPeriod: PayPeriod = 'weekly',
    taxFreeThreshold: boolean = true,
    helpDebt: boolean = false,
    medicareVariation: 'full' | 'half' | 'exempt' = 'full',
  ): PAYGWithholdingResult {
    return calculatePAYGWithholding(
      grossPay,
      payPeriod,
      taxFreeThreshold,
      helpDebt,
      medicareVariation,
    );
  }

  calculatePAYGInstalment(
    businessIncome: number,
    instalmentRate: number,
    method: 'rate' | 'amount' = 'rate',
  ): PAYGInstalmentResult {
    return calculatePAYGInstalment(businessIncome, instalmentRate, method);
  }

  calculateMedicareLevySurcharge(
    income: number,
    privateHealthCover: boolean = false,
  ): MedicareLevySurchargeResult {
    return calculateMedicareLevySurcharge(income, privateHealthCover);
  }

  calculateAnnualPAYGBreakdown(
    annualSalary: number,
    taxFreeThreshold: boolean = true,
    helpDebt: boolean = false,
  ): {
    weekly: PAYGWithholdingResult;
    fortnightly: PAYGWithholdingResult;
    monthly: PAYGWithholdingResult;
  } {
    return {
      weekly: calculateWeeklyPAYGFromAnnual(annualSalary, taxFreeThreshold, helpDebt),
      fortnightly: calculateFortnightlyPAYGFromAnnual(annualSalary, taxFreeThreshold, helpDebt),
      monthly: calculateMonthlyPAYGFromAnnual(annualSalary, taxFreeThreshold, helpDebt),
    };
  }

  getHelpRepaymentDetails(annualIncome: number): {
    rate: number;
    annualRepayment: number;
    weeklyRepayment: number;
    fortnightlyRepayment: number;
    monthlyRepayment: number;
  } {
    const rate = getHelpRepaymentRate(annualIncome);
    const annualRepayment = calculateAnnualHelpRepayment(annualIncome);
    return {
      rate,
      annualRepayment,
      weeklyRepayment: Math.round((annualRepayment / 52) * 100) / 100,
      fortnightlyRepayment: Math.round((annualRepayment / 26) * 100) / 100,
      monthlyRepayment: Math.round((annualRepayment / 12) * 100) / 100,
    };
  }

  // ====== Database Operations (delegated to tax-db) ======

  async saveDeduction(
    userId: string,
    taxYear: string,
    category: string,
    description: string,
    amountCents: number,
    calculationMethod?: string,
    calculationDetails?: object,
  ) {
    return saveDeduction(
      userId,
      taxYear,
      category,
      description,
      amountCents,
      calculationMethod,
      calculationDetails,
    );
  }

  async getDeductions(userId: string, taxYear: string) {
    return getDeductions(userId, taxYear);
  }

  async saveCGTAsset(
    userId: string,
    assetName: string,
    assetType: string,
    acquisitionDate: string,
    acquisitionCostCents: number,
    incidentalCostsCents: number = 0,
    quantity: number = 1,
  ) {
    return saveCGTAsset(
      userId,
      assetName,
      assetType,
      acquisitionDate,
      acquisitionCostCents,
      incidentalCostsCents,
      quantity,
    );
  }

  async recordCGTDisposal(
    assetId: string,
    userId: string,
    taxYear: string,
    disposalDate: string,
    disposalProceedsCents: number,
    disposalCostsCents: number = 0,
    quantityDisposed: number = 1,
  ) {
    return recordCGTDisposal(
      assetId,
      userId,
      taxYear,
      disposalDate,
      disposalProceedsCents,
      disposalCostsCents,
      quantityDisposed,
    );
  }

  async getTaxYearSummary(userId: string, taxYear: string) {
    return getTaxYearSummary(userId, taxYear);
  }

  async saveTaxYearSummary(
    userId: string,
    taxYear: string,
    summaryData: Parameters<typeof saveTaxYearSummary>[2],
  ) {
    return saveTaxYearSummary(userId, taxYear, summaryData);
  }

  async calculateFromTransactions(userId: string, taxYear: string) {
    return calculateFromTransactions(userId, taxYear, this.calculateFullTax.bind(this));
  }
}

export const taxService = new TaxService();
