/**
 * Tax Service
 * TypeScript service for Australian income tax calculations and management
 */

import {
    db,
    transactions,
    taxBrackets,
    taxOffsets,
    deductions,
    cgtAssets,
    cgtEvents,
    capitalLosses,
    depreciableAssets,
    depreciationSchedule,
    taxYearSummary,
    accounts,
} from '../schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';

// 2024-25 Tax Brackets (Stage 3)
// Note: 'min' is inclusive, 'max' is inclusive for each bracket
// baseTax is the cumulative tax payable at the start of the bracket
const TAX_BRACKETS_2024_25 = [
    { min: 0, max: 18200, rate: 0, baseTax: 0 },
    { min: 18201, max: 45000, rate: 0.16, baseTax: 0 },
    { min: 45001, max: 135000, rate: 0.30, baseTax: 4288 },
    { min: 135001, max: 190000, rate: 0.37, baseTax: 31288 },
    { min: 190001, max: Infinity, rate: 0.45, baseTax: 51638 },
];

// Deduction rates 2024-25
const DEDUCTION_RATES = {
    wfhHourlyRate: 0.67,  // $0.67 per hour
    motorVehicleCentsPerKm: 85,  // 85 cents per km
    motorVehicleMaxKm: 5000,
    instantWriteOffThreshold: 20000,  // $20,000
};

// ====== PAYG WITHHOLDING TABLES 2024-25 ======
// Based on ATO Tax Tables 2024-25 (NAT 1004)

export type PayPeriod = 'weekly' | 'fortnightly' | 'monthly';

// Coefficients for PAYG calculation (Schedule 1 - Statement of formulas)
// Formula: y = ax - b where x = gross weekly earnings + 0.99, y = weekly withholding
// Tax-free threshold claimed
const PAYG_COEFFICIENTS_TAX_FREE = [
    { min: 0, max: 359, a: 0, b: 0 },
    { min: 359, max: 438, a: 0.1900, b: 68.3462 },
    { min: 438, max: 548, a: 0.2900, b: 112.1942 },
    { min: 548, max: 721, a: 0.2100, b: 68.3465 },
    { min: 721, max: 865, a: 0.2190, b: 74.8369 },
    { min: 865, max: 1282, a: 0.3477, b: 186.2119 },
    { min: 1282, max: 2307, a: 0.3450, b: 182.7504 },
    { min: 2307, max: 2596, a: 0.3900, b: 286.5965 },
    { min: 2596, max: 3653, a: 0.4700, b: 494.4196 },
    { min: 3653, max: Infinity, a: 0.4700, b: 494.4196 },
];

// No tax-free threshold claimed
const PAYG_COEFFICIENTS_NO_TAX_FREE = [
    { min: 0, max: 88, a: 0.1900, b: 0.1900 },
    { min: 88, max: 371, a: 0.2348, b: 3.9639 },
    { min: 371, max: 515, a: 0.2190, b: -1.9003 },
    { min: 515, max: 932, a: 0.3477, b: 64.4297 },
    { min: 932, max: 1957, a: 0.3450, b: 61.9132 },
    { min: 1957, max: 2246, a: 0.3900, b: 150.0093 },
    { min: 2246, max: 3303, a: 0.4700, b: 329.8324 },
    { min: 3303, max: Infinity, a: 0.4700, b: 329.8324 },
];

// HELP/HECS-HELP repayment thresholds and rates 2024-25
const HELP_REPAYMENT_THRESHOLDS = [
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
    { min: 159663, max: Infinity, rate: 0.10 },
];

// Medicare levy variation reduction thresholds (singles)
const MEDICARE_LEVY_REDUCTION = {
    fullExemptionThreshold: 24276,  // Below this = no levy
    shadeInThreshold: 30345,         // Reduced levy between these thresholds
    shadeInRate: 0.10,               // 10% of excess over lower threshold
    standardRate: 0.02,              // 2% standard rate
};

// Medicare levy surcharge thresholds 2024-25 (singles)
const MLS_THRESHOLDS = {
    tier0Max: 93000,   // No surcharge below this
    tier1Max: 108000,  // 1.0% surcharge
    tier2Max: 144000,  // 1.25% surcharge
    tier3Min: 144001,  // 1.5% surcharge above this
    tier1Rate: 0.01,
    tier2Rate: 0.0125,
    tier3Rate: 0.015,
};

// Pay period multipliers
const PAY_PERIOD_MULTIPLIERS: Record<PayPeriod, number> = {
    weekly: 1,
    fortnightly: 2,
    monthly: 4.333,  // Average weeks per month
};

const WEEKS_PER_YEAR = 52;

// Interfaces
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
 * Calculate Medicare levy
 */
export function calculateMedicareLevy(
    taxableIncome: number,
    hasPrivateHealth: boolean = false
): { levy: number; surcharge: number } {
    let levy = 0;
    let surcharge = 0;

    // Base Medicare levy (2%)
    if (taxableIncome > 30345) {
        levy = taxableIncome * 0.02;
    } else if (taxableIncome > 24276) {
        // Shade-in range
        levy = (taxableIncome - 24276) * 0.10;
    }

    // Medicare levy surcharge (if no private health)
    if (!hasPrivateHealth && taxableIncome > 93000) {
        if (taxableIncome > 144000) {
            surcharge = taxableIncome * 0.015;  // 1.5%
        } else if (taxableIncome > 108000) {
            surcharge = taxableIncome * 0.0125; // 1.25%
        } else {
            surcharge = taxableIncome * 0.01;   // 1%
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

// ====== PAYG WITHHOLDING FUNCTIONS ======

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
    medicareVariation: 'full' | 'half' | 'exempt' = 'full'
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
 * Helper function to calculate Medicare levy amount (without surcharge)
 */
function calculateMedicareLevyAmount(taxableIncome: number): number {
    if (taxableIncome <= MEDICARE_LEVY_REDUCTION.fullExemptionThreshold) {
        return 0;
    } else if (taxableIncome <= MEDICARE_LEVY_REDUCTION.shadeInThreshold) {
        // Shade-in range: 10% of excess over lower threshold
        return (taxableIncome - MEDICARE_LEVY_REDUCTION.fullExemptionThreshold) *
            MEDICARE_LEVY_REDUCTION.shadeInRate;
    } else {
        // Standard 2% rate
        return taxableIncome * MEDICARE_LEVY_REDUCTION.standardRate;
    }
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
    method: 'rate' | 'amount' = 'rate'
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
 * Calculate Medicare Levy Surcharge
 * Applied to individuals without adequate private health insurance
 *
 * @param income - Income for MLS purposes (taxable income + reportable fringe benefits + reportable super contributions)
 * @param privateHealthCover - Whether the person has adequate private health insurance
 * @returns MedicareLevySurchargeResult with surcharge details
 */
export function calculateMedicareLevySurcharge(
    income: number,
    privateHealthCover: boolean = false
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

/**
 * Calculate weekly PAYG withholding from annual salary
 * Convenience function for employers
 */
export function calculateWeeklyPAYGFromAnnual(
    annualSalary: number,
    taxFreeThreshold: boolean = true,
    helpDebt: boolean = false
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
    helpDebt: boolean = false
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
    helpDebt: boolean = false
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
        applyLITO: boolean = true
    ): TaxCalculationResult {
        const taxableIncome = Math.max(0, grossIncome - totalDeductions);

        // Income tax
        const incomeTax = calculateIncomeTax(taxableIncome);

        // Medicare
        const medicare = calculateMedicareLevy(taxableIncome, hasPrivateHealth);

        // Offsets
        let taxOffsets = 0;
        if (applyLITO) {
            taxOffsets += calculateLITO(taxableIncome);
        }

        // Total tax
        const totalTax = Math.max(0, incomeTax + medicare.levy + medicare.surcharge - taxOffsets);

        // Effective rate
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
            takeHomeMonthly: Math.round((grossIncome - totalTax) / 12 * 100) / 100,
        };
    }

    /**
     * Calculate WFH deduction
     */
    calculateWFHDeduction(hoursPerWeek: number, weeksWorked: number = 48): number {
        const totalHours = hoursPerWeek * weeksWorked;
        return Math.round(totalHours * DEDUCTION_RATES.wfhHourlyRate * 100) / 100;
    }

    /**
     * Calculate motor vehicle deduction (cents per km method)
     */
    calculateMotorVehicleDeduction(kmTravelled: number): number {
        const claimableKm = Math.min(kmTravelled, DEDUCTION_RATES.motorVehicleMaxKm);
        return Math.round(claimableKm * DEDUCTION_RATES.motorVehicleCentsPerKm) / 100;
    }

    /**
     * Calculate capital gain
     */
    calculateCapitalGain(
        acquisitionDate: string,
        acquisitionCost: number,
        disposalDate: string,
        disposalProceeds: number,
        incidentalCosts: number = 0,
        disposalCosts: number = 0,
        carriedForwardLosses: number = 0
    ): CGTCalculationResult {
        const costBase = acquisitionCost + incidentalCosts;
        const capitalProceeds = disposalProceeds - disposalCosts;

        // Calculate holding period
        const acqDate = new Date(acquisitionDate);
        const dispDate = new Date(disposalDate);
        const holdingDays = Math.floor((dispDate.getTime() - acqDate.getTime()) / (1000 * 60 * 60 * 24));

        // Check discount eligibility (12+ months)
        const discountEligible = holdingDays >= 365;

        let grossGain = 0;
        let capitalLoss = 0;

        if (capitalProceeds > costBase) {
            grossGain = capitalProceeds - costBase;
        } else {
            capitalLoss = costBase - capitalProceeds;
        }

        // Apply carried forward losses
        if (grossGain > 0 && carriedForwardLosses > 0) {
            const lossOffset = Math.min(grossGain, carriedForwardLosses);
            grossGain -= lossOffset;
        }

        // Apply 50% discount if eligible
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

    /**
     * Calculate depreciation (diminishing value)
     */
    calculateDepreciation(
        purchaseCost: number,
        effectiveLife: number,
        openingValue?: number,
        method: 'diminishing' | 'prime_cost' = 'diminishing',
        businessUse: number = 100
    ): DepreciationResult {
        const currentValue = openingValue ?? purchaseCost;

        // Check instant write-off
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
            // Diminishing value: 200% / effective life
            const rate = 2.0 / effectiveLife;
            depreciation = currentValue * rate;
        } else {
            // Prime cost: 100% / effective life
            const rate = 1.0 / effectiveLife;
            depreciation = purchaseCost * rate;
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

    /**
     * Calculate PAYG withholding for employee payment
     */
    calculatePAYGWithholding(
        grossPay: number,
        payPeriod: PayPeriod = 'weekly',
        taxFreeThreshold: boolean = true,
        helpDebt: boolean = false,
        medicareVariation: 'full' | 'half' | 'exempt' = 'full'
    ): PAYGWithholdingResult {
        return calculatePAYGWithholding(grossPay, payPeriod, taxFreeThreshold, helpDebt, medicareVariation);
    }

    /**
     * Calculate PAYG instalment for business income
     */
    calculatePAYGInstalment(
        businessIncome: number,
        instalmentRate: number,
        method: 'rate' | 'amount' = 'rate'
    ): PAYGInstalmentResult {
        return calculatePAYGInstalment(businessIncome, instalmentRate, method);
    }

    /**
     * Calculate Medicare Levy Surcharge
     */
    calculateMedicareLevySurcharge(
        income: number,
        privateHealthCover: boolean = false
    ): MedicareLevySurchargeResult {
        return calculateMedicareLevySurcharge(income, privateHealthCover);
    }

    /**
     * Calculate PAYG for different pay periods from annual salary
     */
    calculateAnnualPAYGBreakdown(
        annualSalary: number,
        taxFreeThreshold: boolean = true,
        helpDebt: boolean = false
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

    /**
     * Get HELP repayment details
     */
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
            weeklyRepayment: Math.round(annualRepayment / 52 * 100) / 100,
            fortnightlyRepayment: Math.round(annualRepayment / 26 * 100) / 100,
            monthlyRepayment: Math.round(annualRepayment / 12 * 100) / 100,
        };
    }

    // ====== Database Operations ======

    /**
     * Save a deduction record
     */
    async saveDeduction(
        userId: string,
        taxYear: string,
        category: string,
        description: string,
        amountCents: number,
        calculationMethod?: string,
        calculationDetails?: object
    ) {
        const now = new Date().toISOString();

        const newDeduction = {
            id: crypto.randomUUID(),
            userId,
            taxYear,
            category,
            description,
            amount: amountCents,
            calculationMethod,
            calculationDetails: calculationDetails ? JSON.stringify(calculationDetails) : null,
            createdAt: now,
            updatedAt: now,
        };

        await db.insert(deductions).values(newDeduction);
        return newDeduction;
    }

    /**
     * Get deductions for a tax year
     */
    async getDeductions(userId: string, taxYear: string) {
        return db
            .select()
            .from(deductions)
            .where(and(eq(deductions.userId, userId), eq(deductions.taxYear, taxYear)))
            .all();
    }

    /**
     * Save a CGT asset
     */
    async saveCGTAsset(
        userId: string,
        assetName: string,
        assetType: string,
        acquisitionDate: string,
        acquisitionCostCents: number,
        incidentalCostsCents: number = 0,
        quantity: number = 1
    ) {
        const now = new Date().toISOString();

        const newAsset = {
            id: crypto.randomUUID(),
            userId,
            assetName,
            assetType,
            acquisitionDate,
            acquisitionCost: acquisitionCostCents,
            acquisitionCostsIncidental: incidentalCostsCents,
            quantity,
            status: 'held',
            createdAt: now,
            updatedAt: now,
        };

        await db.insert(cgtAssets).values(newAsset);
        return newAsset;
    }

    /**
     * Record a CGT disposal event
     */
    async recordCGTDisposal(
        assetId: string,
        userId: string,
        taxYear: string,
        disposalDate: string,
        disposalProceedsCents: number,
        disposalCostsCents: number = 0,
        quantityDisposed: number = 1
    ) {
        const now = new Date().toISOString();

        // Get asset
        const asset = await db
            .select()
            .from(cgtAssets)
            .where(eq(cgtAssets.id, assetId))
            .get();

        if (!asset) {
            throw new Error('Asset not found');
        }

        // Calculate cost base for disposed quantity
        const disposalRatio = quantityDisposed / (asset.quantity || 1);
        const costBase = Math.round(
            ((asset.acquisitionCost || 0) + (asset.acquisitionCostsIncidental || 0)) * disposalRatio
        );

        // Calculate gain/loss
        const proceeds = disposalProceedsCents - disposalCostsCents;
        const grossGain = proceeds > costBase ? proceeds - costBase : 0;
        const capitalLoss = proceeds < costBase ? costBase - proceeds : 0;

        // Check discount eligibility
        const acqDate = new Date(asset.acquisitionDate);
        const dispDate = new Date(disposalDate);
        const holdingDays = Math.floor((dispDate.getTime() - acqDate.getTime()) / (1000 * 60 * 60 * 24));
        const discountApplied = holdingDays >= 365 && grossGain > 0;
        const discountAmount = discountApplied ? Math.round(grossGain * 0.5) : 0;
        const netGain = grossGain - discountAmount;

        const newEvent = {
            id: crypto.randomUUID(),
            assetId,
            userId,
            taxYear,
            disposalDate,
            disposalProceeds: disposalProceedsCents,
            disposalCosts: disposalCostsCents,
            quantityDisposed,
            costBaseUsed: costBase,
            capitalGainGross: grossGain,
            discountApplied,
            discountAmount,
            capitalGainNet: netGain,
            capitalLoss,
            createdAt: now,
        };

        await db.insert(cgtEvents).values(newEvent);

        // Update asset status
        const newQuantity = (asset.quantity || 1) - quantityDisposed;
        await db
            .update(cgtAssets)
            .set({
                quantity: newQuantity,
                status: newQuantity <= 0 ? 'disposed' : 'partial',
                updatedAt: now,
            })
            .where(eq(cgtAssets.id, assetId));

        return newEvent;
    }

    /**
     * Get tax year summary
     */
    async getTaxYearSummary(userId: string, taxYear: string) {
        return db
            .select()
            .from(taxYearSummary)
            .where(and(eq(taxYearSummary.userId, userId), eq(taxYearSummary.taxYear, taxYear)))
            .get();
    }

    /**
     * Save/update tax year summary
     */
    async saveTaxYearSummary(
        userId: string,
        taxYear: string,
        summaryData: Partial<typeof taxYearSummary.$inferInsert>
    ) {
        const now = new Date().toISOString();
        const existing = await this.getTaxYearSummary(userId, taxYear);

        if (existing) {
            await db
                .update(taxYearSummary)
                .set({ ...summaryData, updatedAt: now })
                .where(eq(taxYearSummary.id, existing.id));
            return { ...existing, ...summaryData };
        } else {
            const newSummary = {
                id: crypto.randomUUID(),
                userId,
                taxYear,
                ...summaryData,
                createdAt: now,
                updatedAt: now,
            };
            await db.insert(taxYearSummary).values(newSummary as any);
            return newSummary;
        }
    }

    /**
     * Calculate tax from transactions for a year
     */
    async calculateFromTransactions(userId: string, taxYear: string) {
        const dates = getFinancialYearDates(taxYear);

        // Get transactions for the year, excluding personal accounts and transfers
        const yearTransactions = await db
            .select({
                id: transactions.id,
                amount: transactions.amount,
                date: transactions.date,
            })
            .from(transactions)
            .leftJoin(accounts, eq(transactions.accountId, accounts.id))
            .where(
                and(
                    eq(transactions.userId, userId),
                    gte(transactions.date, dates.start),
                    lte(transactions.date, dates.end),
                    eq(transactions.isTransfer, false),
                    // Exclude transactions from personal accounts
                    sql`(${transactions.accountId} IS NULL OR ${accounts.ownershipTag} IS NULL OR ${accounts.ownershipTag} != 'personal')`
                )
            )
            .all();

        // Calculate income and expenses
        let totalIncome = 0;
        let totalExpenses = 0;

        for (const tx of yearTransactions) {
            if (tx.amount > 0) {
                totalIncome += tx.amount;
            } else {
                totalExpenses += Math.abs(tx.amount);
            }
        }

        // Get saved deductions
        const savedDeductions = await this.getDeductions(userId, taxYear);
        const totalDeductions = savedDeductions.reduce((sum: number, d: any) => sum + d.amount, 0);

        // Calculate tax
        const result = this.calculateFullTax(
            totalIncome / 100,
            (totalDeductions + totalExpenses) / 100
        );

        return {
            transactionCount: yearTransactions.length,
            totalIncome: totalIncome / 100,
            totalExpenses: totalExpenses / 100,
            savedDeductions: totalDeductions / 100,
            ...result,
        };
    }
}

export const taxService = new TaxService();
