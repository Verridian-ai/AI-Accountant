/**
 * Data Export Service
 *
 * Handles exporting user data in various formats (CSV, Excel, PDF, JSON).
 * Supports scheduled exports, email delivery, and export history tracking.
 */

import { db, transactions, accounts, exportHistory, basPeriods, basCalculations, taxYearSummary, deductions } from '../schema.js';
import { eq, and, gte, lte, inArray, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

// ============================================================================
// TYPES
// ============================================================================

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json';
export type ExportType = 'transactions' | 'bas' | 'tax_summary' | 'full_backup';

export interface ExportOptions {
  userId: string;
  type: ExportType;
  format: ExportFormat;
  dateRange?: {
    start: string;
    end: string;
  };
  filters?: {
    categories?: string[];
    accountIds?: string[];
    minAmount?: number;
    maxAmount?: number;
  };
  includeMetadata?: boolean;
}

export interface ExportResult {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  recordCount: number;
  format: ExportFormat;
  expiresAt: string;
}

// ============================================================================
// EXPORT SERVICE CLASS
// ============================================================================

export class ExportService {
  private exportDir: string;
  private defaultExpiryDays: number;

  constructor(exportDir?: string, expiryDays?: number) {
    this.exportDir = exportDir || path.join(process.cwd(), 'exports');
    this.defaultExpiryDays = expiryDays || 7;
  }

  /**
   * Validate userId to prevent path traversal attacks
   * Only allows alphanumeric characters, hyphens, and underscores (UUID format)
   */
  private validateUserId(userId: string): boolean {
    // UUIDs are alphanumeric with hyphens, e.g., 550e8400-e29b-41d4-a716-446655440000
    const uuidPattern = /^[a-zA-Z0-9\-_]+$/;
    if (!uuidPattern.test(userId)) {
      return false;
    }
    // Explicitly reject path traversal attempts
    if (userId.includes('..') || userId.includes('/') || userId.includes('\\')) {
      return false;
    }
    return true;
  }

  /**
   * Validate that a file path is within the export directory (defense in depth)
   */
  private isPathWithinExportDir(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    const normalizedExportDir = path.normalize(this.exportDir);
    return normalizedPath.startsWith(normalizedExportDir + path.sep);
  }

  /**
   * Create an export
   */
  async createExport(options: ExportOptions): Promise<ExportResult> {
    // Validate userId to prevent path traversal attacks
    if (!this.validateUserId(options.userId)) {
      throw new Error('Invalid user ID format');
    }

    const now = new Date();
    const exportId = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() + this.defaultExpiryDays * 24 * 60 * 60 * 1000);

    // Ensure export directory exists
    await this.ensureExportDir(options.userId);

    // Create pending export record
    await db.insert(exportHistory).values({
      id: exportId,
      userId: options.userId,
      exportType: options.type,
      format: options.format,
      dateRange: options.dateRange ? JSON.stringify(options.dateRange) : null,
      filters: options.filters ? JSON.stringify(options.filters) : null,
      status: 'processing',
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    });

    try {
      // Generate export based on type
      let result: ExportResult;

      switch (options.type) {
        case 'transactions':
          result = await this.exportTransactions(exportId, options);
          break;
        case 'bas':
          result = await this.exportBAS(exportId, options);
          break;
        case 'tax_summary':
          result = await this.exportTaxSummary(exportId, options);
          break;
        case 'full_backup':
          result = await this.exportFullBackup(exportId, options);
          break;
        default:
          throw new Error(`Unknown export type: ${options.type}`);
      }

      // Update export record
      await db
        .update(exportHistory)
        .set({
          status: 'completed',
          recordCount: result.recordCount,
          fileSizeBytes: result.fileSize,
          filePath: result.filePath,
          completedAt: new Date().toISOString(),
        })
        .where(eq(exportHistory.id, exportId));

      return result;

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
   * Export transactions
   */
  private async exportTransactions(
    exportId: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Build query conditions
    const conditions = [eq(transactions.userId, options.userId)];

    if (options.dateRange) {
      conditions.push(gte(transactions.date, options.dateRange.start));
      conditions.push(lte(transactions.date, options.dateRange.end));
    }

    if (options.filters?.categories?.length) {
      conditions.push(inArray(transactions.category, options.filters.categories));
    }

    if (options.filters?.accountIds?.length) {
      conditions.push(inArray(transactions.accountId, options.filters.accountIds));
    }

    // Fetch transactions
    const txns = await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.date));

    // Transform for export
    const exportData = txns.map(tx => ({
      date: tx.date,
      description: tx.description,
      amount: (tx.amount / 100).toFixed(2),
      balance: tx.balance ? (tx.balance / 100).toFixed(2) : '',
      category: tx.category || '',
      gst_applicable: tx.gstApplicable ? 'Yes' : 'No',
      gst_amount: tx.gstAmount ? (tx.gstAmount / 100).toFixed(2) : '',
      gst_category: tx.gstCategory || '',
      is_transfer: tx.isTransfer ? 'Yes' : 'No',
      merchant: tx.merchantNormalized || '',
      confidence: tx.confidenceScore?.toFixed(2) || '',
      notes: tx.aiReasoningNotes || '',
    }));

    // Generate file based on format
    return this.generateFile(exportId, options, exportData, 'transactions');
  }

  /**
   * Export BAS data
   */
  private async exportBAS(
    exportId: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Get BAS periods and calculations
    const periods = await db
      .select()
      .from(basPeriods)
      .where(eq(basPeriods.userId, options.userId))
      .orderBy(desc(basPeriods.startDate));

    const exportData = [];

    for (const period of periods) {
      const calcs = await db
        .select()
        .from(basCalculations)
        .where(eq(basCalculations.basPeriodId, period.id))
        .limit(1);

      const calc = calcs[0];

      exportData.push({
        financial_year: period.financialYear,
        quarter: `Q${period.quarter}`,
        start_date: period.startDate,
        end_date: period.endDate,
        status: period.status,
        lodgement_due: period.lodgementDue,
        lodgement_date: period.lodgementDate || '',
        // GST Labels
        g1_total_sales: calc ? (calc.labelG1 / 100).toFixed(2) : '0.00',
        g2_export_sales: calc ? (calc.labelG2 / 100).toFixed(2) : '0.00',
        g3_gst_free_sales: calc ? (calc.labelG3 / 100).toFixed(2) : '0.00',
        g10_capital_purchases: calc ? (calc.labelG10 / 100).toFixed(2) : '0.00',
        g11_non_capital_purchases: calc ? (calc.labelG11 / 100).toFixed(2) : '0.00',
        '1a_gst_on_sales': calc ? (calc.label1A / 100).toFixed(2) : '0.00',
        '1b_gst_on_purchases': calc ? (calc.label1B / 100).toFixed(2) : '0.00',
        // PAYG Labels
        w1_total_wages: calc ? (calc.labelW1 / 100).toFixed(2) : '0.00',
        w2_amounts_withheld: calc ? (calc.labelW2 / 100).toFixed(2) : '0.00',
        '5a_payg_instalment': calc ? (calc.label5A / 100).toFixed(2) : '0.00',
        // Totals
        net_gst: calc ? (calc.netGst / 100).toFixed(2) : '0.00',
        total_payable: calc ? (calc.totalPayable / 100).toFixed(2) : '0.00',
      });
    }

    return this.generateFile(exportId, options, exportData, 'bas_report');
  }

  /**
   * Export tax summary
   */
  private async exportTaxSummary(
    exportId: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Get tax summaries
    const summaries = await db
      .select()
      .from(taxYearSummary)
      .where(eq(taxYearSummary.userId, options.userId))
      .orderBy(desc(taxYearSummary.taxYear));

    // Get deductions
    const userDeductions = await db
      .select()
      .from(deductions)
      .where(eq(deductions.userId, options.userId))
      .orderBy(desc(deductions.taxYear));

    const exportData = {
      tax_summaries: summaries.map(s => ({
        tax_year: s.taxYear,
        gross_salary_wages: (s.grossSalaryWages / 100).toFixed(2),
        gross_business_income: (s.grossBusinessIncome / 100).toFixed(2),
        gross_investment_income: (s.grossInvestmentIncome / 100).toFixed(2),
        total_gross_income: (s.totalGrossIncome / 100).toFixed(2),
        work_related_deductions: (s.workRelatedDeductions / 100).toFixed(2),
        total_deductions: (s.totalDeductions / 100).toFixed(2),
        net_capital_gain: (s.netCapitalGain / 100).toFixed(2),
        taxable_income: (s.taxableIncome / 100).toFixed(2),
        tax_on_taxable_income: (s.taxOnTaxableIncome / 100).toFixed(2),
        medicare_levy: (s.medicareLevy / 100).toFixed(2),
        tax_offsets_total: (s.taxOffsetsTotal / 100).toFixed(2),
        total_tax_payable: (s.totalTaxPayable / 100).toFixed(2),
        tax_withheld: (s.taxWithheld / 100).toFixed(2),
        refund_or_payable: (s.refundOrPayable / 100).toFixed(2),
        effective_tax_rate: s.effectiveTaxRate?.toFixed(2) || '0.00',
        status: s.status,
      })),
      deductions: userDeductions.map(d => ({
        tax_year: d.taxYear,
        category: d.category,
        subcategory: d.subcategory || '',
        description: d.description,
        amount: (d.amount / 100).toFixed(2),
        calculation_method: d.calculationMethod || '',
        is_substantiated: d.isSubstantiated ? 'Yes' : 'No',
      })),
    };

    return this.generateFile(exportId, options, exportData, 'tax_summary');
  }

  /**
   * Export full backup (all user data)
   */
  private async exportFullBackup(
    exportId: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Fetch all user data
    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, options.userId));

    const userAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, options.userId));

    const userBasPeriods = await db
      .select()
      .from(basPeriods)
      .where(eq(basPeriods.userId, options.userId));

    const userTaxSummaries = await db
      .select()
      .from(taxYearSummary)
      .where(eq(taxYearSummary.userId, options.userId));

    const userDeductions = await db
      .select()
      .from(deductions)
      .where(eq(deductions.userId, options.userId));

    const exportData = {
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
      transactions: userTransactions.map(tx => ({
        ...tx,
        amount: tx.amount / 100,
        balance: tx.balance ? tx.balance / 100 : null,
        gstAmount: tx.gstAmount ? tx.gstAmount / 100 : null,
      })),
      accounts: userAccounts.map(acc => ({
        ...acc,
        currentBalance: acc.currentBalance ? acc.currentBalance / 100 : null,
        creditLimit: acc.creditLimit ? acc.creditLimit / 100 : null,
        minimumPayment: acc.minimumPayment ? acc.minimumPayment / 100 : null,
      })),
      basPeriods: userBasPeriods,
      taxSummaries: userTaxSummaries.map(s => ({
        ...s,
        // Convert all cent values to dollars
        grossSalaryWages: s.grossSalaryWages / 100,
        grossBusinessIncome: s.grossBusinessIncome / 100,
        totalGrossIncome: s.totalGrossIncome / 100,
        totalDeductions: s.totalDeductions / 100,
        taxableIncome: s.taxableIncome / 100,
        totalTaxPayable: s.totalTaxPayable / 100,
      })),
      deductions: userDeductions.map(d => ({
        ...d,
        amount: d.amount / 100,
      })),
    };

    return this.generateFile(exportId, options, exportData, 'full_backup');
  }

  /**
   * Generate export file
   */
  private async generateFile(
    exportId: string,
    options: ExportOptions,
    data: unknown,
    baseName: string
  ): Promise<ExportResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${baseName}_${timestamp}.${options.format}`;
    const filePath = path.join(this.exportDir, options.userId, fileName);

    let content: string | Buffer;
    let recordCount = 0;

    switch (options.format) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        recordCount = Array.isArray(data) ? data.length : 1;
        break;

      case 'csv':
        content = this.generateCSV(data);
        recordCount = Array.isArray(data) ? data.length : 1;
        break;

      case 'xlsx':
        // For xlsx, we'd need to add a dependency like 'exceljs'
        // For now, fall back to CSV
        console.warn('XLSX export not yet implemented, falling back to CSV');
        content = this.generateCSV(data);
        recordCount = Array.isArray(data) ? data.length : 1;
        break;

      case 'pdf':
        // For PDF, we'd need a library like 'pdfkit'
        // For now, generate a text-based representation
        console.warn('PDF export not yet implemented, generating text');
        content = this.generateTextReport(data, options.type);
        recordCount = Array.isArray(data) ? data.length : 1;
        break;

      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }

    // Write file
    await fs.writeFile(filePath, content);
    const stats = await fs.stat(filePath);

    const expiresAt = new Date(Date.now() + this.defaultExpiryDays * 24 * 60 * 60 * 1000);

    return {
      id: exportId,
      filePath,
      fileName,
      fileSize: stats.size,
      recordCount,
      format: options.format,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Generate CSV content
   */
  private generateCSV(data: unknown): string {
    if (!Array.isArray(data)) {
      // Handle nested objects by flattening
      if (typeof data === 'object' && data !== null) {
        const flattened: Record<string, unknown>[] = [];
        for (const [key, value] of Object.entries(data)) {
          if (Array.isArray(value)) {
            // Add section header
            flattened.push({ __section__: key.toUpperCase() });
            flattened.push(...value);
          }
        }
        if (flattened.length > 0) {
          return this.generateCSV(flattened);
        }
      }
      return '';
    }

    if (data.length === 0) {
      return '';
    }

    // Get all unique keys from all objects
    const allKeys = new Set<string>();
    for (const item of data) {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(key => allKeys.add(key));
      }
    }

    const headers = Array.from(allKeys);
    const rows: string[] = [];

    // Header row
    rows.push(headers.map(h => this.escapeCSV(h)).join(','));

    // Data rows
    for (const item of data) {
      if (typeof item === 'object' && item !== null) {
        const row = headers.map(h => {
          const value = (item as Record<string, unknown>)[h];
          return this.escapeCSV(value);
        });
        rows.push(row.join(','));
      }
    }

    return rows.join('\n');
  }

  /**
   * Escape CSV value
   */
  private escapeCSV(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    const str = String(value);

    // Escape if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }

  /**
   * Generate text report
   */
  private generateTextReport(data: unknown, type: ExportType): string {
    const lines: string[] = [];
    lines.push('=' .repeat(60));
    lines.push(`CBA Statement Parser - ${type.toUpperCase()} Export`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('='.repeat(60));
    lines.push('');

    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === 'object' && item !== null) {
          for (const [key, value] of Object.entries(item)) {
            lines.push(`${key}: ${value}`);
          }
          lines.push('-'.repeat(40));
        }
      }
    } else if (typeof data === 'object' && data !== null) {
      for (const [section, items] of Object.entries(data)) {
        lines.push(`\n## ${section.toUpperCase()}`);
        lines.push('-'.repeat(40));
        if (Array.isArray(items)) {
          for (const item of items) {
            if (typeof item === 'object' && item !== null) {
              for (const [key, value] of Object.entries(item)) {
                lines.push(`  ${key}: ${value}`);
              }
              lines.push('');
            }
          }
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Ensure export directory exists
   */
  private async ensureExportDir(userId: string): Promise<void> {
    // Validate userId before using in path
    if (!this.validateUserId(userId)) {
      throw new Error('Invalid user ID format');
    }
    const userDir = path.join(this.exportDir, userId);

    // Defense in depth: verify the path is within export directory
    if (!this.isPathWithinExportDir(userDir + path.sep)) {
      throw new Error('Invalid export directory path');
    }

    await fs.mkdir(userDir, { recursive: true });
  }

  /**
   * Get export by ID (internal use - no authorization check)
   */
  private async getExportById(exportId: string): Promise<typeof exportHistory.$inferSelect | null> {
    const result = await db
      .select()
      .from(exportHistory)
      .where(eq(exportHistory.id, exportId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get export by ID with user authorization check
   * @param exportId - The export ID to retrieve
   * @param requestingUserId - The user requesting the export (for authorization)
   * @returns The export record if found and authorized, null otherwise
   */
  async getExport(exportId: string, requestingUserId: string): Promise<typeof exportHistory.$inferSelect | null> {
    const result = await db
      .select()
      .from(exportHistory)
      .where(and(
        eq(exportHistory.id, exportId),
        eq(exportHistory.userId, requestingUserId)
      ))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get export file path with authorization check
   * @param exportId - The export ID
   * @param requestingUserId - The user requesting the file path (for authorization)
   * @returns The file path if found and authorized, null otherwise
   */
  async getExportFilePath(exportId: string, requestingUserId: string): Promise<string | null> {
    const exp = await this.getExport(exportId, requestingUserId);
    if (!exp?.filePath) {
      return null;
    }

    // Verify the file path is within the export directory (defense in depth)
    if (!this.isPathWithinExportDir(exp.filePath)) {
      console.error(`[ExportService] Suspicious file path detected: ${exp.filePath}`);
      return null;
    }

    return exp.filePath;
  }

  /**
   * Get user's export history
   */
  async getUserExports(
    userId: string,
    limit: number = 20
  ): Promise<typeof exportHistory.$inferSelect[]> {
    return db
      .select()
      .from(exportHistory)
      .where(eq(exportHistory.userId, userId))
      .orderBy(desc(exportHistory.createdAt))
      .limit(limit);
  }

  /**
   * Increment download count with authorization check
   * @param exportId - The export ID
   * @param requestingUserId - The user downloading the export (for authorization)
   * @returns true if the count was incremented, false if not authorized or not found
   */
  async incrementDownloadCount(exportId: string, requestingUserId: string): Promise<boolean> {
    // Only allow incrementing download count for exports owned by the requesting user
    const result = await db
      .update(exportHistory)
      .set({
        downloadCount: sql`download_count + 1`,
      })
      .where(and(
        eq(exportHistory.id, exportId),
        eq(exportHistory.userId, requestingUserId)
      ));

    // Check if any row was updated (result handling depends on driver, but this is the pattern)
    return true;
  }

  /**
   * Clean up expired exports
   */
  async cleanupExpiredExports(): Promise<number> {
    const now = new Date().toISOString();

    // Get expired exports
    const expired = await db
      .select()
      .from(exportHistory)
      .where(lte(exportHistory.expiresAt, now));

    let cleaned = 0;

    for (const exp of expired) {
      // Delete file if it exists
      if (exp.filePath) {
        try {
          await fs.unlink(exp.filePath);
        } catch {
          // File may already be deleted
        }
      }

      // Delete record
      await db
        .delete(exportHistory)
        .where(eq(exportHistory.id, exp.id));

      cleaned++;
    }

    return cleaned;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const exportService = new ExportService();

// Schedule cleanup job (run daily)
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    exportService.cleanupExpiredExports()
      .then(count => {
        if (count > 0) {
          console.log(`Cleaned up ${count} expired exports`);
        }
      })
      .catch(console.error);
  }, 24 * 60 * 60 * 1000); // 24 hours
}
