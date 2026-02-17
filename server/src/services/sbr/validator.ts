/**
 * SBR BAS Data Validator — validates BAS data against ATO rules.
 */

import type { BASData, ValidationError, ValidationResult } from './types.js';
import { formatCurrency, isValidDate } from './helpers.js';

/** Validate BAS data against ATO rules */
export function validateBASData(basData: BASData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Required field validation
  if (!basData.financialYear || !/^\d{4}-\d{2}$/.test(basData.financialYear)) {
    errors.push({
      code: 'INVALID_FY',
      label: 'financialYear',
      message: 'Financial year must be in format YYYY-YY (e.g., 2024-25)',
      severity: 'error',
    });
  }

  if (!basData.quarter || basData.quarter < 1 || basData.quarter > 4) {
    errors.push({
      code: 'INVALID_QUARTER',
      label: 'quarter',
      message: 'Quarter must be between 1 and 4',
      severity: 'error',
    });
  }

  if (!basData.periodStart || !isValidDate(basData.periodStart)) {
    errors.push({
      code: 'INVALID_PERIOD_START',
      label: 'periodStart',
      message: 'Period start date must be in YYYY-MM-DD format',
      severity: 'error',
    });
  }

  if (!basData.periodEnd || !isValidDate(basData.periodEnd)) {
    errors.push({
      code: 'INVALID_PERIOD_END',
      label: 'periodEnd',
      message: 'Period end date must be in YYYY-MM-DD format',
      severity: 'error',
    });
  }

  validateGstSales(basData, errors, warnings);
  validateGstPurchases(basData, errors);
  validateGstSummary(basData, warnings);
  validatePaygWithholding(basData, errors, warnings);
  validateFuelTaxCredits(basData, warnings);
  validateNonNegativeValues(basData, errors);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateGstSales(
  basData: BASData,
  errors: ValidationError[],
  warnings: ValidationError[],
): void {
  const g = basData.gstLabels;

  // G1 should equal G2 + G3 + G4 (if all provided)
  if (g.G1 !== undefined && g.G2 !== undefined && g.G3 !== undefined) {
    const g4 = g.G4 || 0;
    const expectedG1Total = g.G2 + g.G3 + g4;
    if (g.G1 < expectedG1Total) {
      warnings.push({
        code: 'G1_LESS_THAN_COMPONENTS',
        label: 'G1',
        message: `G1 (${formatCurrency(g.G1)}) is less than sum of G2+G3+G4 (${formatCurrency(expectedG1Total)}). G1 should include all sales.`,
        severity: 'warning',
        expectedValue: expectedG1Total,
        actualValue: g.G1,
      });
    }
  }

  // G5 = G2 + G3 + G4
  if (g.G5 !== undefined) {
    const expectedG5 = (g.G2 || 0) + (g.G3 || 0) + (g.G4 || 0);
    if (g.G5 !== expectedG5) {
      errors.push({
        code: 'G5_MISMATCH',
        label: 'G5',
        message: `G5 (${formatCurrency(g.G5)}) must equal G2 + G3 + G4 (${formatCurrency(expectedG5)})`,
        severity: 'error',
        expectedValue: expectedG5,
        actualValue: g.G5,
      });
    }
  }

  // G6 = G1 - G5
  if (g.G6 !== undefined && g.G1 !== undefined) {
    const g5 = g.G5 || (g.G2 || 0) + (g.G3 || 0) + (g.G4 || 0);
    const expectedG6 = g.G1 - g5;
    if (g.G6 !== expectedG6) {
      errors.push({
        code: 'G6_MISMATCH',
        label: 'G6',
        message: `G6 (${formatCurrency(g.G6)}) must equal G1 - G5 (${formatCurrency(expectedG6)})`,
        severity: 'error',
        expectedValue: expectedG6,
        actualValue: g.G6,
      });
    }
  }
}

function validateGstPurchases(basData: BASData, errors: ValidationError[]): void {
  const g = basData.gstLabels;

  // G12 = G10 + G11
  if (g.G12 !== undefined) {
    const expectedG12 = (g.G10 || 0) + (g.G11 || 0);
    if (g.G12 !== expectedG12) {
      errors.push({
        code: 'G12_MISMATCH',
        label: 'G12',
        message: `G12 (${formatCurrency(g.G12)}) must equal G10 + G11 (${formatCurrency(expectedG12)})`,
        severity: 'error',
        expectedValue: expectedG12,
        actualValue: g.G12,
      });
    }
  }

  // G16 = G12 - G13 - G14 - G15
  if (g.G16 !== undefined) {
    const g12 = g.G12 || (g.G10 || 0) + (g.G11 || 0);
    const expectedG16 = g12 - (g.G13 || 0) - (g.G14 || 0) - (g.G15 || 0);
    if (g.G16 !== expectedG16) {
      errors.push({
        code: 'G16_MISMATCH',
        label: 'G16',
        message: `G16 (${formatCurrency(g.G16)}) must equal G12 - G13 - G14 - G15 (${formatCurrency(expectedG16)})`,
        severity: 'error',
        expectedValue: expectedG16,
        actualValue: g.G16,
      });
    }
  }

  // G10 + G11 should not be negative
  if (g.G10 !== undefined && g.G11 !== undefined && g.G12 === undefined) {
    const totalPurchases = g.G10 + g.G11;
    if (totalPurchases < 0) {
      errors.push({
        code: 'NEGATIVE_PURCHASES',
        label: 'G10/G11',
        message: 'Total purchases (G10 + G11) cannot be negative',
        severity: 'error',
        actualValue: totalPurchases,
      });
    }
  }
}

function validateGstSummary(basData: BASData, warnings: ValidationError[]): void {
  const g = basData.gstLabels;
  const summary = basData.gstSummary;

  // 1A should be GST on sales (approximately G1/11 for standard rate)
  if (summary['1A'] !== undefined && g.G1 !== undefined && g.G1 > 0) {
    const maxExpectedGst = Math.round(g.G1 / 11);
    if (summary['1A'] > maxExpectedGst * 1.1) {
      warnings.push({
        code: '1A_HIGH',
        label: '1A',
        message: `GST on sales (${formatCurrency(summary['1A'])}) seems high compared to total sales (${formatCurrency(g.G1)}). Expected max: ${formatCurrency(maxExpectedGst)}`,
        severity: 'warning',
        expectedValue: maxExpectedGst,
        actualValue: summary['1A'],
      });
    }
  }

  // 1B should be GST on purchases
  if (summary['1B'] !== undefined) {
    const totalPurchases = (g.G10 || 0) + (g.G11 || 0);
    if (totalPurchases > 0) {
      const maxExpectedGstPurchases = Math.round(totalPurchases / 11);
      if (summary['1B'] > maxExpectedGstPurchases * 1.1) {
        warnings.push({
          code: '1B_HIGH',
          label: '1B',
          message: `GST on purchases (${formatCurrency(summary['1B'])}) seems high compared to total purchases (${formatCurrency(totalPurchases)})`,
          severity: 'warning',
          expectedValue: maxExpectedGstPurchases,
          actualValue: summary['1B'],
        });
      }
    }
  }
}

function validatePaygWithholding(
  basData: BASData,
  errors: ValidationError[],
  warnings: ValidationError[],
): void {
  const payg = basData.paygWithholding;

  // W2 cannot exceed W1
  if (payg.W2 > payg.W1) {
    errors.push({
      code: 'W2_EXCEEDS_W1',
      label: 'W2',
      message: `Amounts withheld (${formatCurrency(payg.W2)}) cannot exceed total payments (${formatCurrency(payg.W1)})`,
      severity: 'error',
      expectedValue: payg.W1,
      actualValue: payg.W2,
    });
  }

  // W4 = W2 + W3
  if (payg.W4 !== undefined) {
    const expectedW4 = payg.W2 + (payg.W3 || 0);
    if (payg.W4 !== expectedW4) {
      errors.push({
        code: 'W4_MISMATCH',
        label: 'W4',
        message: `W4 (${formatCurrency(payg.W4)}) must equal W2 + W3 (${formatCurrency(expectedW4)})`,
        severity: 'error',
        expectedValue: expectedW4,
        actualValue: payg.W4,
      });
    }
  }

  // W2 should be reasonable percentage of W1 (typically 15-47%)
  if (payg.W1 > 0 && payg.W2 > 0) {
    const withholdingRate = payg.W2 / payg.W1;
    if (withholdingRate < 0.1) {
      warnings.push({
        code: 'W2_LOW_RATE',
        label: 'W2',
        message: `Withholding rate (${(withholdingRate * 100).toFixed(1)}%) seems low. Minimum tax rate is typically 16%+ for incomes over $18,200`,
        severity: 'warning',
      });
    }
    if (withholdingRate > 0.5) {
      warnings.push({
        code: 'W2_HIGH_RATE',
        label: 'W2',
        message: `Withholding rate (${(withholdingRate * 100).toFixed(1)}%) seems high. Maximum marginal rate is 45%`,
        severity: 'warning',
      });
    }
  }
}

function validateFuelTaxCredits(basData: BASData, warnings: ValidationError[]): void {
  if (!basData.fuelTaxCredits) return;
  const ftc = basData.fuelTaxCredits;
  if ((ftc['7C'] || 0) > 0 && (ftc['7D'] || 0) > 0) {
    warnings.push({
      code: 'FTC_DUAL_CLAIM',
      label: '7C/7D',
      message:
        'Claiming fuel tax credits for both business use (7C) and other activities (7D). Ensure these are for different fuel usage.',
      severity: 'warning',
    });
  }
}

function validateNonNegativeValues(basData: BASData, errors: ValidationError[]): void {
  const { gstLabels: g, paygWithholding: payg, gstSummary: summary } = basData;
  const nonNegativeFields: Array<[string, number | undefined]> = [
    ['G1', g.G1],
    ['G2', g.G2],
    ['G3', g.G3],
    ['G10', g.G10],
    ['G11', g.G11],
    ['W1', payg.W1],
    ['W2', payg.W2],
    ['1A', summary['1A']],
    ['1B', summary['1B']],
  ];

  for (const [label, value] of nonNegativeFields) {
    if (value !== undefined && value < 0) {
      errors.push({
        code: 'NEGATIVE_VALUE',
        label,
        message: `${label} cannot be negative (${formatCurrency(value)})`,
        severity: 'error',
        actualValue: value,
      });
    }
  }
}
