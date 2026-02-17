/**
 * SBR (Standard Business Reporting) Export Service
 *
 * Generates ATO-compliant XML for BAS lodgement using the SBR format.
 * Also provides CSV summary and PDF report exports.
 *
 * Based on ATO SBR specifications for Activity Statements.
 */

import { db, basPeriods, basCalculations, exportHistory } from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Business profile required for SBR submission
 */
export interface BusinessProfile {
  abn: string; // 11-digit ABN
  businessName: string;
  tradingName?: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  postalAddress: {
    line1: string;
    line2?: string;
    suburb: string;
    state: string; // NSW, VIC, QLD, SA, WA, TAS, NT, ACT
    postcode: string;
  };
  gstRegistered: boolean;
  gstBranch?: number; // For multi-branch GST registrations
  accountingBasis: 'accrual' | 'cash';
  annualReportingOption?: boolean; // GST annual reporting option
}

/**
 * BAS data structure for SBR export
 */
export interface BASData {
  financialYear: string; // e.g., '2024-25'
  quarter: number; // 1, 2, 3, or 4
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  lodgementDate?: string; // YYYY-MM-DD (defaults to today)

  // GST Section - G Labels (amounts in cents)
  gstLabels: {
    G1: number; // Total sales (including any GST)
    G2: number; // Export sales
    G3: number; // Other GST-free sales
    G4?: number; // Input taxed sales (optional)
    G5?: number; // Total GST-free and input taxed sales (calculated: G2 + G3 + G4)
    G6?: number; // Total sales subject to GST (calculated: G1 - G5)
    G7?: number; // Adjustments (optional)
    G8?: number; // Total sales subject to GST after adjustments (calculated: G6 + G7)
    G9?: number; // GST on sales (calculated: G8 / 11)
    G10: number; // Capital purchases
    G11: number; // Non-capital purchases
    G12?: number; // G10 + G11 (calculated)
    G13?: number; // Purchases for making input taxed sales
    G14?: number; // Purchases without GST in price
    G15?: number; // Estimated purchases for private use
    G16?: number; // Total purchases (calculated: G12 - G13 - G14 - G15)
    G17?: number; // Adjustments (optional)
    G18?: number; // Total purchases subject to GST (calculated: G16 + G17)
    G19?: number; // GST on purchases (calculated: G18 / 11)
    G20?: number; // GST payable (calculated: G9 - G19) - Can be negative for refund
  };

  // GST Summary Labels (amounts in cents)
  gstSummary: {
    '1A': number; // GST on sales
    '1B': number; // GST on purchases
    '1C'?: number; // Wine equalisation tax payable
    '1D'?: number; // Wine equalisation tax refundable
    '1E'?: number; // Luxury car tax payable
    '1F'?: number; // Luxury car tax refundable
    '1G'?: number; // GST amounts you owe ATO from WET/LCT
  };

  // PAYG Withholding - W Labels (amounts in cents)
  paygWithholding: {
    W1: number; // Total salary, wages, and other payments
    W2: number; // Amounts withheld from payments at W1
    W3?: number; // Other amounts withheld (excludes W2)
    W4?: number; // Total amounts withheld (calculated: W2 + W3)
    W5?: number; // Amounts withheld where no ABN quoted
  };

  // PAYG Instalment - 5 Labels (amounts in cents)
  paygInstalment: {
    '5A'?: number; // PAYG instalment income
    '5B'?: number; // New varied instalment amount (optional)
    T1?: number; // Instalment income
    T2?: number; // Varied commissioner's instalment rate
    T3?: number; // New varied instalment amount
    T4?: number; // Estimated tax for year
    T7?: number; // Reason code for variation
    T8?: number; // Varied PAYG instalment amount
    T9?: number; // Credit from PAYG instalment variation
  };

  // Fuel Tax Credits - 7 Labels (amounts in cents)
  fuelTaxCredits?: {
    '7A'?: number; // Fuel tax credits for eligible fuel use
    '7B'?: number; // Fuel tax credits for heavy vehicles
    '7C': number; // Fuel tax credits - business use
    '7D': number; // Fuel tax credits - other activities
  };

  // Deferred GST - Label 7 (amounts in cents)
  deferredGst?: {
    '7': number; // Deferred GST on imports
  };

  // FBT Instalment (amounts in cents)
  fbtInstalment?: {
    F1?: number; // ATO-notified FBT instalment
    F2?: number; // Varied FBT instalment amount
    F3?: number; // FBT tax for year
    F4?: number; // Reason code for FBT variation
  };
}

/**
 * Validation error structure
 */
export interface ValidationError {
  code: string;
  label: string;
  message: string;
  severity: 'error' | 'warning';
  expectedValue?: number;
  actualValue?: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * SBR Export result
 */
export interface SBRExportResult {
  id: string;
  format: 'xml' | 'csv' | 'pdf';
  filePath: string;
  fileName: string;
  fileSize: number;
  validation: ValidationResult;
  createdAt: string;
  expiresAt: string;
}

/**
 * Export history entry
 */
export interface ExportHistoryEntry {
  id: string;
  userId: string;
  financialYear: string;
  quarter: number;
  format: string;
  status: string;
  filePath?: string;
  createdAt: string;
  expiresAt?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// ATO State codes
const VALID_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

// SBR XML Namespaces
const SBR_NAMESPACES = {
  sbr: 'http://sbr.gov.au/ato/activity.statement.2023',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
  common: 'http://sbr.gov.au/comn/sbr.02.00.data',
  party: 'http://sbr.gov.au/rprt/party.details.01.00.data',
};

// Export directory
const DEFAULT_EXPORT_DIR = path.join(process.cwd(), 'exports', 'sbr');

// ============================================================================
// SBR EXPORTER CLASS
// ============================================================================

export class SBRExporter {
  private exportDir: string;
  private defaultExpiryDays: number;

  constructor(exportDir?: string, expiryDays?: number) {
    this.exportDir = exportDir || DEFAULT_EXPORT_DIR;
    this.defaultExpiryDays = expiryDays || 30;
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Generate ATO-compliant SBR XML for BAS lodgement
   */
  async generateBASXML(basData: BASData, businessProfile: BusinessProfile): Promise<string> {
    // Validate data first
    const validation = this.validateBASData(basData);
    if (!validation.isValid) {
      const errorMessages = validation.errors.map((e) => e.message).join('; ');
      throw new Error(`BAS validation failed: ${errorMessages}`);
    }

    // Calculate derived values
    const calculatedData = this.calculateDerivedValues(basData);

    // Generate XML
    return this.buildXML(calculatedData, businessProfile);
  }

  /**
   * Validate BAS data against ATO rules
   */
  validateBASData(basData: BASData): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // ========================================================================
    // REQUIRED FIELD VALIDATION
    // ========================================================================

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

    if (!basData.periodStart || !this.isValidDate(basData.periodStart)) {
      errors.push({
        code: 'INVALID_PERIOD_START',
        label: 'periodStart',
        message: 'Period start date must be in YYYY-MM-DD format',
        severity: 'error',
      });
    }

    if (!basData.periodEnd || !this.isValidDate(basData.periodEnd)) {
      errors.push({
        code: 'INVALID_PERIOD_END',
        label: 'periodEnd',
        message: 'Period end date must be in YYYY-MM-DD format',
        severity: 'error',
      });
    }

    // ========================================================================
    // MATHEMATICAL CONSISTENCY CHECKS - GST SALES
    // ========================================================================

    const g = basData.gstLabels;

    // G1 should equal G2 + G3 + G4 (if all provided)
    // ATO Rule: G1 = Total sales including exports and GST-free
    if (g.G1 !== undefined && g.G2 !== undefined && g.G3 !== undefined) {
      const g4 = g.G4 || 0;
      const expectedG1Total = g.G2 + g.G3 + g4;

      // G1 can be greater (includes taxable sales) but should be >= sum
      if (g.G1 < expectedG1Total) {
        warnings.push({
          code: 'G1_LESS_THAN_COMPONENTS',
          label: 'G1',
          message: `G1 (${this.formatCurrency(g.G1)}) is less than sum of G2+G3+G4 (${this.formatCurrency(expectedG1Total)}). G1 should include all sales.`,
          severity: 'warning',
          expectedValue: expectedG1Total,
          actualValue: g.G1,
        });
      }
    }

    // G5 = G2 + G3 + G4 (GST-free and input taxed sales)
    if (g.G5 !== undefined) {
      const expectedG5 = (g.G2 || 0) + (g.G3 || 0) + (g.G4 || 0);
      if (g.G5 !== expectedG5) {
        errors.push({
          code: 'G5_MISMATCH',
          label: 'G5',
          message: `G5 (${this.formatCurrency(g.G5)}) must equal G2 + G3 + G4 (${this.formatCurrency(expectedG5)})`,
          severity: 'error',
          expectedValue: expectedG5,
          actualValue: g.G5,
        });
      }
    }

    // G6 = G1 - G5 (Total sales subject to GST)
    if (g.G6 !== undefined && g.G1 !== undefined) {
      const g5 = g.G5 || (g.G2 || 0) + (g.G3 || 0) + (g.G4 || 0);
      const expectedG6 = g.G1 - g5;
      if (g.G6 !== expectedG6) {
        errors.push({
          code: 'G6_MISMATCH',
          label: 'G6',
          message: `G6 (${this.formatCurrency(g.G6)}) must equal G1 - G5 (${this.formatCurrency(expectedG6)})`,
          severity: 'error',
          expectedValue: expectedG6,
          actualValue: g.G6,
        });
      }
    }

    // ========================================================================
    // MATHEMATICAL CONSISTENCY CHECKS - GST PURCHASES
    // ========================================================================

    // G12 = G10 + G11
    if (g.G12 !== undefined) {
      const expectedG12 = (g.G10 || 0) + (g.G11 || 0);
      if (g.G12 !== expectedG12) {
        errors.push({
          code: 'G12_MISMATCH',
          label: 'G12',
          message: `G12 (${this.formatCurrency(g.G12)}) must equal G10 + G11 (${this.formatCurrency(expectedG12)})`,
          severity: 'error',
          expectedValue: expectedG12,
          actualValue: g.G12,
        });
      }
    }

    // G16 = G12 - G13 - G14 - G15 (Total purchases subject to GST)
    if (g.G16 !== undefined) {
      const g12 = g.G12 || (g.G10 || 0) + (g.G11 || 0);
      const expectedG16 = g12 - (g.G13 || 0) - (g.G14 || 0) - (g.G15 || 0);
      if (g.G16 !== expectedG16) {
        errors.push({
          code: 'G16_MISMATCH',
          label: 'G16',
          message: `G16 (${this.formatCurrency(g.G16)}) must equal G12 - G13 - G14 - G15 (${this.formatCurrency(expectedG16)})`,
          severity: 'error',
          expectedValue: expectedG16,
          actualValue: g.G16,
        });
      }
    }

    // G10 verification (Capital purchases with GST)
    // G10 = G11 - G12 - G13 - G14 - G15 - G16 - G17 - G18 (inverse calculation)
    // This is the ATO formula check for purchases section
    if (
      g.G10 !== undefined &&
      g.G11 !== undefined &&
      g.G12 === undefined // Only check if G12 not explicitly provided
    ) {
      // Simplified check: G10 + G11 should be total purchases before exclusions
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

    // ========================================================================
    // GST SUMMARY VALIDATION
    // ========================================================================

    const summary = basData.gstSummary;

    // 1A should be GST on sales (approximately G1/11 for standard rate)
    if (summary['1A'] !== undefined && g.G1 !== undefined && g.G1 > 0) {
      const maxExpectedGst = Math.round(g.G1 / 11);
      if (summary['1A'] > maxExpectedGst * 1.1) {
        // Allow 10% variance
        warnings.push({
          code: '1A_HIGH',
          label: '1A',
          message: `GST on sales (${this.formatCurrency(summary['1A'])}) seems high compared to total sales (${this.formatCurrency(g.G1)}). Expected max: ${this.formatCurrency(maxExpectedGst)}`,
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
            message: `GST on purchases (${this.formatCurrency(summary['1B'])}) seems high compared to total purchases (${this.formatCurrency(totalPurchases)})`,
            severity: 'warning',
            expectedValue: maxExpectedGstPurchases,
            actualValue: summary['1B'],
          });
        }
      }
    }

    // ========================================================================
    // PAYG WITHHOLDING VALIDATION
    // ========================================================================

    const payg = basData.paygWithholding;

    // W2 cannot exceed W1
    if (payg.W2 > payg.W1) {
      errors.push({
        code: 'W2_EXCEEDS_W1',
        label: 'W2',
        message: `Amounts withheld (${this.formatCurrency(payg.W2)}) cannot exceed total payments (${this.formatCurrency(payg.W1)})`,
        severity: 'error',
        expectedValue: payg.W1,
        actualValue: payg.W2,
      });
    }

    // W4 = W2 + W3 (if provided)
    if (payg.W4 !== undefined) {
      const expectedW4 = payg.W2 + (payg.W3 || 0);
      if (payg.W4 !== expectedW4) {
        errors.push({
          code: 'W4_MISMATCH',
          label: 'W4',
          message: `W4 (${this.formatCurrency(payg.W4)}) must equal W2 + W3 (${this.formatCurrency(expectedW4)})`,
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

    // ========================================================================
    // FUEL TAX CREDITS VALIDATION
    // ========================================================================

    if (basData.fuelTaxCredits) {
      const ftc = basData.fuelTaxCredits;

      // Cannot claim both 7C and 7D for same activities
      if ((ftc['7C'] || 0) > 0 && (ftc['7D'] || 0) > 0) {
        // This is allowed, just a note that they should be different activities
        warnings.push({
          code: 'FTC_DUAL_CLAIM',
          label: '7C/7D',
          message:
            'Claiming fuel tax credits for both business use (7C) and other activities (7D). Ensure these are for different fuel usage.',
          severity: 'warning',
        });
      }
    }

    // ========================================================================
    // NEGATIVE VALUE CHECKS
    // ========================================================================

    // Most values should be non-negative (except GST payable which can be negative for refund)
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
          message: `${label} cannot be negative (${this.formatCurrency(value)})`,
          severity: 'error',
          actualValue: value,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get export history for a user
   */
  async getExportHistory(userId: string, limit: number = 20): Promise<ExportHistoryEntry[]> {
    const history = await db
      .select()
      .from(exportHistory)
      .where(and(eq(exportHistory.userId, userId), eq(exportHistory.exportType, 'sbr_bas')))
      .orderBy(desc(exportHistory.createdAt))
      .limit(limit);

    return history.map((h: Record<string, unknown>) => {
      let financialYear = '';
      let quarter = 0;

      // Safely parse dateRange JSON
      if (h.dateRange) {
        try {
          const parsed = JSON.parse(String(h.dateRange));
          financialYear = parsed.financialYear || '';
          quarter = parsed.quarter || 0;
        } catch {
          // dateRange is malformed; use defaults
          console.warn(`Malformed dateRange in export history ${h.id}`);
        }
      }

      return {
        id: h.id,
        userId: h.userId,
        financialYear,
        quarter,
        format: h.format,
        status: h.status,
        filePath: h.filePath || undefined,
        createdAt: h.createdAt,
        expiresAt: h.expiresAt || undefined,
      };
    });
  }

  /**
   * Export BAS data in specified format
   */
  async exportBAS(
    userId: string,
    basData: BASData,
    businessProfile: BusinessProfile,
    format: 'xml' | 'csv' | 'pdf',
  ): Promise<SBRExportResult> {
    const exportId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.defaultExpiryDays * 24 * 60 * 60 * 1000);

    // Ensure export directory exists
    await this.ensureExportDir(userId);

    // Validate data
    const validation = this.validateBASData(basData);

    // Create pending export record
    await db.insert(exportHistory).values({
      id: exportId,
      userId,
      exportType: 'sbr_bas',
      format,
      dateRange: JSON.stringify({
        financialYear: basData.financialYear,
        quarter: basData.quarter,
        start: basData.periodStart,
        end: basData.periodEnd,
      }),
      status: 'processing',
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    });

    try {
      let content: string;
      let fileName: string;

      switch (format) {
        case 'xml':
          content = await this.generateBASXML(basData, businessProfile);
          fileName = `BAS_${basData.financialYear}_Q${basData.quarter}_${now.toISOString().slice(0, 10)}.xml`;
          break;
        case 'csv':
          content = this.generateBASCSV(basData, businessProfile);
          fileName = `BAS_${basData.financialYear}_Q${basData.quarter}_${now.toISOString().slice(0, 10)}.csv`;
          break;
        case 'pdf':
          content = this.generateBASTextReport(basData, businessProfile);
          fileName = `BAS_${basData.financialYear}_Q${basData.quarter}_${now.toISOString().slice(0, 10)}.txt`;
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      const filePath = path.join(this.exportDir, userId, fileName);
      await fs.writeFile(filePath, content, 'utf-8');
      const stats = await fs.stat(filePath);

      // Update export record
      await db
        .update(exportHistory)
        .set({
          status: 'completed',
          filePath,
          fileSizeBytes: stats.size,
          completedAt: new Date().toISOString(),
        })
        .where(eq(exportHistory.id, exportId));

      return {
        id: exportId,
        format,
        filePath,
        fileName,
        fileSize: stats.size,
        validation,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      // Mark export as failed
      await db
        .update(exportHistory)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(exportHistory.id, exportId));

      throw error;
    }
  }

  /**
   * Load BAS data from database
   */
  async loadBASFromDatabase(
    userId: string,
    financialYear: string,
    quarter: number,
  ): Promise<BASData | null> {
    const period = await db
      .select()
      .from(basPeriods)
      .where(
        and(
          eq(basPeriods.userId, userId),
          eq(basPeriods.financialYear, financialYear),
          eq(basPeriods.quarter, quarter),
        ),
      )
      .limit(1);

    if (period.length === 0) {
      return null;
    }

    const calc = await db
      .select()
      .from(basCalculations)
      .where(eq(basCalculations.basPeriodId, period[0].id))
      .limit(1);

    if (calc.length === 0) {
      return null;
    }

    const c = calc[0];
    const p = period[0];

    return {
      financialYear: p.financialYear,
      quarter: p.quarter,
      periodStart: p.startDate,
      periodEnd: p.endDate,
      lodgementDate: p.lodgementDate || undefined,

      gstLabels: {
        G1: c.labelG1 || 0,
        G2: c.labelG2 || 0,
        G3: c.labelG3 || 0,
        G10: c.labelG10 || 0,
        G11: c.labelG11 || 0,
      },

      gstSummary: {
        '1A': c.label1A || 0,
        '1B': c.label1B || 0,
      },

      paygWithholding: {
        W1: c.labelW1 || 0,
        W2: c.labelW2 || 0,
        W3: c.labelW3 || 0,
        W4: c.labelW4 || 0,
      },

      paygInstalment: {
        '5A': c.label5A || 0,
        '5B': c.label5B || 0,
      },

      fuelTaxCredits: {
        '7C': c.label7C || 0,
        '7D': c.label7D || 0,
      },
    };
  }

  // ==========================================================================
  // PRIVATE METHODS - XML GENERATION
  // ==========================================================================

  /**
   * Build the complete SBR XML document
   */
  private buildXML(basData: BASData, profile: BusinessProfile): string {
    const lodgementDate = basData.lodgementDate || new Date().toISOString().slice(0, 10);
    const documentId = `BAS-${profile.abn}-${basData.financialYear}-Q${basData.quarter}`;

    // Calculate net amounts
    const netGst = (basData.gstSummary['1A'] || 0) - (basData.gstSummary['1B'] || 0);
    const totalPaygWithholding = basData.paygWithholding.W4 || basData.paygWithholding.W2;
    const totalFuelTaxCredits =
      (basData.fuelTaxCredits?.['7C'] || 0) + (basData.fuelTaxCredits?.['7D'] || 0);
    const paygInstalment = basData.paygInstalment['5A'] || 0;
    const totalPayable = netGst + totalPaygWithholding + paygInstalment - totalFuelTaxCredits;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ActivityStatement xmlns="${SBR_NAMESPACES.sbr}"
    xmlns:xsi="${SBR_NAMESPACES.xsi}"
    xmlns:common="${SBR_NAMESPACES.common}"
    xmlns:party="${SBR_NAMESPACES.party}">

  <!-- Document Header -->
  <DocumentHeader>
    <DocumentID>${this.escapeXml(documentId)}</DocumentID>
    <DocumentType>BAS</DocumentType>
    <LodgementDate>${lodgementDate}</LodgementDate>
    <SoftwareProduct>
      <Name>GoldLedger</Name>
      <Version>1.0.0</Version>
    </SoftwareProduct>
  </DocumentHeader>

  <!-- Party Details -->
  <Party>
    <ABN>${this.formatABN(profile.abn)}</ABN>
    <BusinessName>${this.escapeXml(profile.businessName)}</BusinessName>
    ${profile.tradingName ? `<TradingName>${this.escapeXml(profile.tradingName)}</TradingName>` : ''}
    <GSTRegistered>${profile.gstRegistered ? 'Y' : 'N'}</GSTRegistered>
    ${profile.gstBranch ? `<GSTBranch>${profile.gstBranch}</GSTBranch>` : ''}
    <AccountingBasis>${profile.accountingBasis.toUpperCase()}</AccountingBasis>
    <Contact>
      <Name>${this.escapeXml(profile.contactName)}</Name>
      <Phone>${this.escapeXml(profile.contactPhone)}</Phone>
      <Email>${this.escapeXml(profile.contactEmail)}</Email>
    </Contact>
    <PostalAddress>
      <Line1>${this.escapeXml(profile.postalAddress.line1)}</Line1>
      ${profile.postalAddress.line2 ? `<Line2>${this.escapeXml(profile.postalAddress.line2)}</Line2>` : ''}
      <Suburb>${this.escapeXml(profile.postalAddress.suburb)}</Suburb>
      <State>${profile.postalAddress.state}</State>
      <Postcode>${profile.postalAddress.postcode}</Postcode>
      <Country>AU</Country>
    </PostalAddress>
  </Party>

  <!-- Period Details -->
  <Period>
    <FinancialYear>${basData.financialYear}</FinancialYear>
    <Quarter>${basData.quarter}</Quarter>
    <StartDate>${basData.periodStart}</StartDate>
    <EndDate>${basData.periodEnd}</EndDate>
  </Period>

  <!-- GST Section -->
  <GSTSection>
    <!-- Sales -->
    <Sales>
      <G1>${this.centsToWholeNumber(basData.gstLabels.G1)}</G1>
      <G2>${this.centsToWholeNumber(basData.gstLabels.G2)}</G2>
      <G3>${this.centsToWholeNumber(basData.gstLabels.G3)}</G3>
      ${basData.gstLabels.G4 !== undefined ? `<G4>${this.centsToWholeNumber(basData.gstLabels.G4)}</G4>` : ''}
      ${basData.gstLabels.G7 !== undefined ? `<G7>${this.centsToWholeNumber(basData.gstLabels.G7)}</G7>` : ''}
    </Sales>

    <!-- Purchases -->
    <Purchases>
      <G10>${this.centsToWholeNumber(basData.gstLabels.G10)}</G10>
      <G11>${this.centsToWholeNumber(basData.gstLabels.G11)}</G11>
      ${basData.gstLabels.G13 !== undefined ? `<G13>${this.centsToWholeNumber(basData.gstLabels.G13)}</G13>` : ''}
      ${basData.gstLabels.G14 !== undefined ? `<G14>${this.centsToWholeNumber(basData.gstLabels.G14)}</G14>` : ''}
      ${basData.gstLabels.G15 !== undefined ? `<G15>${this.centsToWholeNumber(basData.gstLabels.G15)}</G15>` : ''}
      ${basData.gstLabels.G17 !== undefined ? `<G17>${this.centsToWholeNumber(basData.gstLabels.G17)}</G17>` : ''}
    </Purchases>

    <!-- GST Summary -->
    <GSTSummary>
      <Label1A>${this.centsToWholeNumber(basData.gstSummary['1A'])}</Label1A>
      <Label1B>${this.centsToWholeNumber(basData.gstSummary['1B'])}</Label1B>
      ${basData.gstSummary['1C'] !== undefined ? `<Label1C>${this.centsToWholeNumber(basData.gstSummary['1C'])}</Label1C>` : ''}
      ${basData.gstSummary['1D'] !== undefined ? `<Label1D>${this.centsToWholeNumber(basData.gstSummary['1D'])}</Label1D>` : ''}
      ${basData.gstSummary['1E'] !== undefined ? `<Label1E>${this.centsToWholeNumber(basData.gstSummary['1E'])}</Label1E>` : ''}
      ${basData.gstSummary['1F'] !== undefined ? `<Label1F>${this.centsToWholeNumber(basData.gstSummary['1F'])}</Label1F>` : ''}
      <NetGST>${this.centsToWholeNumber(netGst)}</NetGST>
    </GSTSummary>
  </GSTSection>

  <!-- PAYG Withholding Section -->
  <PAYGWithholdingSection>
    <W1>${this.centsToWholeNumber(basData.paygWithholding.W1)}</W1>
    <W2>${this.centsToWholeNumber(basData.paygWithholding.W2)}</W2>
    ${basData.paygWithholding.W3 !== undefined ? `<W3>${this.centsToWholeNumber(basData.paygWithholding.W3)}</W3>` : ''}
    <W4>${this.centsToWholeNumber(totalPaygWithholding)}</W4>
    ${basData.paygWithholding.W5 !== undefined ? `<W5>${this.centsToWholeNumber(basData.paygWithholding.W5)}</W5>` : ''}
  </PAYGWithholdingSection>

  <!-- PAYG Instalment Section -->
  <PAYGInstalmentSection>
    ${basData.paygInstalment['5A'] !== undefined ? `<Label5A>${this.centsToWholeNumber(basData.paygInstalment['5A'])}</Label5A>` : ''}
    ${basData.paygInstalment['5B'] !== undefined ? `<Label5B>${this.centsToWholeNumber(basData.paygInstalment['5B'])}</Label5B>` : ''}
    ${basData.paygInstalment.T1 !== undefined ? `<T1>${this.centsToWholeNumber(basData.paygInstalment.T1)}</T1>` : ''}
    ${basData.paygInstalment.T2 !== undefined ? `<T2>${basData.paygInstalment.T2}</T2>` : ''}
    ${basData.paygInstalment.T7 !== undefined ? `<T7>${basData.paygInstalment.T7}</T7>` : ''}
    ${basData.paygInstalment.T8 !== undefined ? `<T8>${this.centsToWholeNumber(basData.paygInstalment.T8)}</T8>` : ''}
  </PAYGInstalmentSection>

  <!-- Fuel Tax Credits Section -->
  ${
    basData.fuelTaxCredits
      ? `
  <FuelTaxCreditsSection>
    ${basData.fuelTaxCredits['7A'] !== undefined ? `<Label7A>${this.centsToWholeNumber(basData.fuelTaxCredits['7A'])}</Label7A>` : ''}
    ${basData.fuelTaxCredits['7B'] !== undefined ? `<Label7B>${this.centsToWholeNumber(basData.fuelTaxCredits['7B'])}</Label7B>` : ''}
    <Label7C>${this.centsToWholeNumber(basData.fuelTaxCredits['7C'])}</Label7C>
    <Label7D>${this.centsToWholeNumber(basData.fuelTaxCredits['7D'])}</Label7D>
    <TotalFuelTaxCredits>${this.centsToWholeNumber(totalFuelTaxCredits)}</TotalFuelTaxCredits>
  </FuelTaxCreditsSection>
  `
      : ''
  }

  <!-- Deferred GST Section -->
  ${
    basData.deferredGst
      ? `
  <DeferredGSTSection>
    <Label7>${this.centsToWholeNumber(basData.deferredGst['7'])}</Label7>
  </DeferredGSTSection>
  `
      : ''
  }

  <!-- FBT Instalment Section -->
  ${
    basData.fbtInstalment
      ? `
  <FBTInstalmentSection>
    ${basData.fbtInstalment.F1 !== undefined ? `<F1>${this.centsToWholeNumber(basData.fbtInstalment.F1)}</F1>` : ''}
    ${basData.fbtInstalment.F2 !== undefined ? `<F2>${this.centsToWholeNumber(basData.fbtInstalment.F2)}</F2>` : ''}
    ${basData.fbtInstalment.F3 !== undefined ? `<F3>${this.centsToWholeNumber(basData.fbtInstalment.F3)}</F3>` : ''}
    ${basData.fbtInstalment.F4 !== undefined ? `<F4>${basData.fbtInstalment.F4}</F4>` : ''}
  </FBTInstalmentSection>
  `
      : ''
  }

  <!-- Summary -->
  <Summary>
    <NetGST>${this.centsToWholeNumber(netGst)}</NetGST>
    <PAYGWithholding>${this.centsToWholeNumber(totalPaygWithholding)}</PAYGWithholding>
    <PAYGInstalment>${this.centsToWholeNumber(paygInstalment)}</PAYGInstalment>
    <FuelTaxCredits>${this.centsToWholeNumber(totalFuelTaxCredits)}</FuelTaxCredits>
    <TotalPayable>${this.centsToWholeNumber(totalPayable)}</TotalPayable>
    <PaymentDirection>${totalPayable >= 0 ? 'PAYABLE' : 'REFUND'}</PaymentDirection>
  </Summary>

  <!-- Declaration -->
  <Declaration>
    <DeclarationText>I declare that the information in this activity statement is true and correct.</DeclarationText>
    <DeclarationDate>${lodgementDate}</DeclarationDate>
  </Declaration>

</ActivityStatement>`;

    return xml;
  }

  /**
   * Generate CSV summary
   */
  private generateBASCSV(basData: BASData, profile: BusinessProfile): string {
    const rows: string[][] = [];

    // Header
    rows.push(['Business Activity Statement Summary']);
    rows.push([]);
    rows.push(['Business Details']);
    rows.push(['ABN', this.formatABN(profile.abn)]);
    rows.push(['Business Name', profile.businessName]);
    rows.push(['Financial Year', basData.financialYear]);
    rows.push(['Quarter', `Q${basData.quarter}`]);
    rows.push(['Period', `${basData.periodStart} to ${basData.periodEnd}`]);
    rows.push([]);

    // GST Section
    rows.push(['GST - Sales']);
    rows.push(['Label', 'Description', 'Amount ($)']);
    rows.push(['G1', 'Total sales (including GST)', this.formatCurrencyCSV(basData.gstLabels.G1)]);
    rows.push(['G2', 'Export sales', this.formatCurrencyCSV(basData.gstLabels.G2)]);
    rows.push(['G3', 'Other GST-free sales', this.formatCurrencyCSV(basData.gstLabels.G3)]);
    if (basData.gstLabels.G4) {
      rows.push(['G4', 'Input taxed sales', this.formatCurrencyCSV(basData.gstLabels.G4)]);
    }
    rows.push([]);

    rows.push(['GST - Purchases']);
    rows.push(['G10', 'Capital purchases', this.formatCurrencyCSV(basData.gstLabels.G10)]);
    rows.push(['G11', 'Non-capital purchases', this.formatCurrencyCSV(basData.gstLabels.G11)]);
    rows.push([]);

    rows.push(['GST Summary']);
    rows.push(['1A', 'GST on sales', this.formatCurrencyCSV(basData.gstSummary['1A'])]);
    rows.push(['1B', 'GST on purchases', this.formatCurrencyCSV(basData.gstSummary['1B'])]);
    const netGst = (basData.gstSummary['1A'] || 0) - (basData.gstSummary['1B'] || 0);
    rows.push(['', 'Net GST', this.formatCurrencyCSV(netGst)]);
    rows.push([]);

    // PAYG Withholding
    rows.push(['PAYG Withholding']);
    rows.push([
      'W1',
      'Total salary, wages and payments',
      this.formatCurrencyCSV(basData.paygWithholding.W1),
    ]);
    rows.push(['W2', 'Amounts withheld', this.formatCurrencyCSV(basData.paygWithholding.W2)]);
    if (basData.paygWithholding.W3) {
      rows.push([
        'W3',
        'Other amounts withheld',
        this.formatCurrencyCSV(basData.paygWithholding.W3),
      ]);
    }
    rows.push([]);

    // PAYG Instalment
    if (basData.paygInstalment['5A']) {
      rows.push(['PAYG Instalment']);
      rows.push(['5A', 'PAYG instalment', this.formatCurrencyCSV(basData.paygInstalment['5A'])]);
      rows.push([]);
    }

    // Fuel Tax Credits
    if (basData.fuelTaxCredits?.['7C'] || basData.fuelTaxCredits?.['7D']) {
      rows.push(['Fuel Tax Credits']);
      rows.push(['7C', 'Business use', this.formatCurrencyCSV(basData.fuelTaxCredits['7C'])]);
      rows.push(['7D', 'Other activities', this.formatCurrencyCSV(basData.fuelTaxCredits['7D'])]);
      rows.push([]);
    }

    // Summary
    const totalPaygWithholding = basData.paygWithholding.W4 || basData.paygWithholding.W2;
    const totalFuelTaxCredits =
      (basData.fuelTaxCredits?.['7C'] || 0) + (basData.fuelTaxCredits?.['7D'] || 0);
    const paygInstalment = basData.paygInstalment['5A'] || 0;
    const totalPayable = netGst + totalPaygWithholding + paygInstalment - totalFuelTaxCredits;

    rows.push(['Total']);
    rows.push(['', 'Total amount payable/refundable', this.formatCurrencyCSV(totalPayable)]);
    rows.push(['', totalPayable >= 0 ? 'AMOUNT PAYABLE' : 'REFUND DUE', '']);

    // Convert to CSV
    return rows.map((row) => row.map((cell) => this.escapeCSV(cell)).join(',')).join('\n');
  }

  /**
   * Generate text report (placeholder for PDF)
   */
  private generateBASTextReport(basData: BASData, profile: BusinessProfile): string {
    const lines: string[] = [];
    const divider = '='.repeat(70);
    const subDivider = '-'.repeat(70);

    lines.push(divider);
    lines.push('                    BUSINESS ACTIVITY STATEMENT');
    lines.push(divider);
    lines.push('');
    lines.push('BUSINESS DETAILS');
    lines.push(subDivider);
    lines.push(`ABN:                ${this.formatABN(profile.abn)}`);
    lines.push(`Business Name:      ${profile.businessName}`);
    if (profile.tradingName) {
      lines.push(`Trading Name:       ${profile.tradingName}`);
    }
    lines.push('');
    lines.push('PERIOD DETAILS');
    lines.push(subDivider);
    lines.push(`Financial Year:     ${basData.financialYear}`);
    lines.push(`Quarter:            Q${basData.quarter}`);
    lines.push(`Period:             ${basData.periodStart} to ${basData.periodEnd}`);
    lines.push('');

    lines.push('GST - GOODS AND SERVICES TAX');
    lines.push(subDivider);
    lines.push('');
    lines.push('Sales');
    lines.push(
      `  G1  Total sales (including GST)       ${this.formatCurrencyReport(basData.gstLabels.G1)}`,
    );
    lines.push(
      `  G2  Export sales                      ${this.formatCurrencyReport(basData.gstLabels.G2)}`,
    );
    lines.push(
      `  G3  Other GST-free sales              ${this.formatCurrencyReport(basData.gstLabels.G3)}`,
    );
    lines.push('');
    lines.push('Purchases');
    lines.push(
      `  G10 Capital purchases                 ${this.formatCurrencyReport(basData.gstLabels.G10)}`,
    );
    lines.push(
      `  G11 Non-capital purchases             ${this.formatCurrencyReport(basData.gstLabels.G11)}`,
    );
    lines.push('');
    lines.push('GST Summary');
    lines.push(
      `  1A  GST on sales                      ${this.formatCurrencyReport(basData.gstSummary['1A'])}`,
    );
    lines.push(
      `  1B  GST on purchases                  ${this.formatCurrencyReport(basData.gstSummary['1B'])}`,
    );
    const netGst = (basData.gstSummary['1A'] || 0) - (basData.gstSummary['1B'] || 0);
    lines.push(`      Net GST                           ${this.formatCurrencyReport(netGst)}`);
    lines.push('');

    lines.push('PAYG WITHHOLDING');
    lines.push(subDivider);
    lines.push(
      `  W1  Total salary, wages and payments  ${this.formatCurrencyReport(basData.paygWithholding.W1)}`,
    );
    lines.push(
      `  W2  Amounts withheld                  ${this.formatCurrencyReport(basData.paygWithholding.W2)}`,
    );
    lines.push('');

    if (basData.paygInstalment['5A']) {
      lines.push('PAYG INSTALMENT');
      lines.push(subDivider);
      lines.push(
        `  5A  PAYG instalment                   ${this.formatCurrencyReport(basData.paygInstalment['5A'])}`,
      );
      lines.push('');
    }

    if (basData.fuelTaxCredits?.['7C'] || basData.fuelTaxCredits?.['7D']) {
      lines.push('FUEL TAX CREDITS');
      lines.push(subDivider);
      lines.push(
        `  7C  Business use                      ${this.formatCurrencyReport(basData.fuelTaxCredits['7C'])}`,
      );
      lines.push(
        `  7D  Other activities                  ${this.formatCurrencyReport(basData.fuelTaxCredits['7D'])}`,
      );
      lines.push('');
    }

    const totalPaygWithholding = basData.paygWithholding.W4 || basData.paygWithholding.W2;
    const totalFuelTaxCredits =
      (basData.fuelTaxCredits?.['7C'] || 0) + (basData.fuelTaxCredits?.['7D'] || 0);
    const paygInstalment = basData.paygInstalment['5A'] || 0;
    const totalPayable = netGst + totalPaygWithholding + paygInstalment - totalFuelTaxCredits;

    lines.push(divider);
    lines.push('SUMMARY');
    lines.push(divider);
    lines.push('');
    lines.push(`  Net GST                               ${this.formatCurrencyReport(netGst)}`);
    lines.push(
      `  PAYG Withholding                      ${this.formatCurrencyReport(totalPaygWithholding)}`,
    );
    lines.push(
      `  PAYG Instalment                       ${this.formatCurrencyReport(paygInstalment)}`,
    );
    lines.push(
      `  Fuel Tax Credits                      ${this.formatCurrencyReport(-totalFuelTaxCredits)}`,
    );
    lines.push(subDivider);
    lines.push(
      `  TOTAL ${totalPayable >= 0 ? 'PAYABLE' : 'REFUND'}                    ${this.formatCurrencyReport(Math.abs(totalPayable))}`,
    );
    lines.push('');
    lines.push(divider);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`This is a summary report for record keeping purposes.`);
    lines.push(`For official lodgement, use the XML export via SBR channels.`);
    lines.push(divider);

    return lines.join('\n');
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  /**
   * Calculate derived values for BAS
   */
  private calculateDerivedValues(basData: BASData): BASData {
    const g = { ...basData.gstLabels };

    // Calculate G5 if not provided
    if (g.G5 === undefined) {
      g.G5 = (g.G2 || 0) + (g.G3 || 0) + (g.G4 || 0);
    }

    // Calculate G6 if not provided
    if (g.G6 === undefined && g.G1 !== undefined) {
      g.G6 = g.G1 - g.G5;
    }

    // Calculate G8 if not provided
    if (g.G8 === undefined && g.G6 !== undefined) {
      g.G8 = g.G6 + (g.G7 || 0);
    }

    // Calculate G9 (GST on sales)
    if (g.G9 === undefined && g.G8 !== undefined) {
      g.G9 = Math.round(g.G8 / 11);
    }

    // Calculate G12
    if (g.G12 === undefined) {
      g.G12 = (g.G10 || 0) + (g.G11 || 0);
    }

    // Calculate G16
    if (g.G16 === undefined) {
      g.G16 = g.G12 - (g.G13 || 0) - (g.G14 || 0) - (g.G15 || 0);
    }

    // Calculate G18
    if (g.G18 === undefined) {
      g.G18 = g.G16 + (g.G17 || 0);
    }

    // Calculate G19 (GST on purchases)
    if (g.G19 === undefined && g.G18 !== undefined) {
      g.G19 = Math.round(g.G18 / 11);
    }

    // Calculate G20 (Net GST)
    if (g.G20 === undefined && g.G9 !== undefined && g.G19 !== undefined) {
      g.G20 = g.G9 - g.G19;
    }

    return {
      ...basData,
      gstLabels: g,
    };
  }

  /**
   * Validate date string
   */
  private isValidDate(dateStr: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  /**
   * Format ABN with spaces
   */
  private formatABN(abn: string): string {
    const clean = abn.replace(/\s/g, '');
    if (clean.length !== 11) return clean;
    return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 11)}`;
  }

  /**
   * Convert cents to whole dollars (rounded)
   */
  private centsToWholeNumber(cents: number): number {
    return Math.round(cents / 100);
  }

  /**
   * Format currency for display
   */
  private formatCurrency(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  /**
   * Format currency for CSV
   */
  private formatCurrencyCSV(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  /**
   * Format currency for report (right-aligned)
   */
  private formatCurrencyReport(cents: number): string {
    const formatted = `$${Math.abs(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const sign = cents < 0 ? '-' : ' ';
    return `${sign}${formatted}`.padStart(15);
  }

  /**
   * Escape XML special characters and control characters
   * Prevents XML injection attacks by sanitizing all user-provided content
   */
  private escapeXml(str: string): string {
    if (typeof str !== 'string') {
      return '';
    }

    return (
      str
        // Remove null bytes and other control characters (except tab, newline, carriage return)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Escape XML entities (order matters: & must be first)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        // Remove or escape any CDATA section attempts
        .replace(/\]\]>/g, ']]&gt;')
        // Remove XML declaration attempts
        .replace(/<\?xml/gi, '&lt;?xml')
        // Remove DOCTYPE attempts
        .replace(/<!DOCTYPE/gi, '&lt;!DOCTYPE')
        // Remove entity declaration attempts
        .replace(/<!ENTITY/gi, '&lt;!ENTITY')
    );
  }

  /**
   * Escape CSV value
   */
  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Ensure export directory exists
   */
  private async ensureExportDir(userId: string): Promise<void> {
    const userDir = path.join(this.exportDir, userId);
    await fs.mkdir(userDir, { recursive: true });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const sbrExporter = new SBRExporter();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate ABN (Australian Business Number)
 * Uses the official ATO algorithm
 */
export function validateABN(abn: string): boolean {
  const clean = abn.replace(/\s/g, '');

  if (!/^\d{11}$/.test(clean)) {
    return false;
  }

  // ATO ABN validation algorithm
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = clean.split('').map(Number);

  // Subtract 1 from first digit
  digits[0] -= 1;

  // Calculate weighted sum
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }

  // Valid if divisible by 89
  return sum % 89 === 0;
}

/**
 * Validate ACN (Australian Company Number)
 * Uses the official ASIC modulus 10 algorithm
 *
 * The ACN is a 9-digit number where the 9th digit is a check digit.
 * Algorithm:
 * 1. Multiply each of the first 8 digits by its weighting factor (8,7,6,5,4,3,2,1)
 * 2. Sum the products
 * 3. Divide by 10 and get remainder
 * 4. Complement of remainder (10 - remainder) mod 10 = check digit
 * 5. Compare calculated check digit with the 9th digit
 *
 * @see https://asic.gov.au/for-business/registering-a-company/steps-to-register-a-company/australian-company-numbers/
 */
export function validateACN(acn: string): boolean {
  const clean = acn.replace(/\s/g, '');

  if (!/^\d{9}$/.test(clean)) {
    return false;
  }

  // Weights for first 8 digits only (check digit is 9th)
  const weights = [8, 7, 6, 5, 4, 3, 2, 1];
  const digits = clean.split('').map(Number);

  // Calculate weighted sum of first 8 digits
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += digits[i] * weights[i];
  }

  // Calculate check digit: complement of (sum mod 10)
  const remainder = sum % 10;
  const expectedCheckDigit = (10 - remainder) % 10;

  // Compare with the actual 9th digit (index 8)
  return digits[8] === expectedCheckDigit;
}

/**
 * Format amount in cents to ATO currency format (whole dollars, no cents)
 */
export function formatATOAmount(cents: number): string {
  const dollars = Math.round(cents / 100);
  return dollars.toString();
}

/**
 * Parse ATO amount (whole dollars) to cents
 */
export function parseATOAmount(dollars: string | number): number {
  const num = typeof dollars === 'string' ? parseInt(dollars, 10) : dollars;
  return num * 100;
}
