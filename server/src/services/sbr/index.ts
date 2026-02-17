/**
 * SBR (Standard Business Reporting) Export Service
 *
 * Generates ATO-compliant XML for BAS lodgement using the SBR format.
 * Also provides CSV summary and PDF report exports.
 *
 * Based on ATO SBR specifications for Activity Statements.
 */

import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

import type {
  BASData,
  BusinessProfile,
  SBRExportResult,
  ExportHistoryEntry,
  ValidationResult,
} from './types.js';
import { validateBASData } from './validator.js';
import { calculateDerivedValues } from './helpers.js';
import { generateSBRXml } from './xml-generator.js';
import { generateCSVSummary } from './csv-exporter.js';
import { generatePDFReport } from './pdf-exporter.js';
import {
  getExportHistory as getExportHistoryDb,
  saveExportRecord,
  markExportCompleted,
  markExportFailed,
  loadBASFromDatabase as loadBASFromDb,
} from './export-history.js';

// Re-export all types, constants, and utility functions
export type {
  BusinessProfile,
  BASData,
  ValidationError,
  ValidationResult,
  SBRExportResult,
  ExportHistoryEntry,
} from './types.js';
export { VALID_STATES, SBR_NAMESPACES } from './types.js';
export { validateBASData } from './validator.js';
export { generateSBRXml } from './xml-generator.js';
export { generateCSVSummary } from './csv-exporter.js';
export { generatePDFReport } from './pdf-exporter.js';
export {
  getExportHistory,
  saveExportRecord,
  markExportCompleted,
  markExportFailed,
  loadBASFromDatabase,
} from './export-history.js';
export {
  validateABN,
  validateACN,
  formatATOAmount,
  parseATOAmount,
  calculateDerivedValues,
  formatABN,
  centsToWholeNumber,
  formatCurrency,
  formatCurrencyCSV,
  formatCurrencyReport,
  escapeXml,
  escapeCSV,
  isValidDate,
} from './helpers.js';

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
    const calculatedData = calculateDerivedValues(basData);

    // Generate XML
    return generateSBRXml(calculatedData, businessProfile);
  }

  /**
   * Validate BAS data against ATO rules
   */
  validateBASData(basData: BASData): ValidationResult {
    return validateBASData(basData);
  }

  /**
   * Get export history for a user
   */
  async getExportHistory(userId: string, limit: number = 20): Promise<ExportHistoryEntry[]> {
    return getExportHistoryDb(userId, limit);
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
    await saveExportRecord(exportId, userId, basData, format, expiresAt, now);

    try {
      let content: string;
      let fileName: string;

      switch (format) {
        case 'xml':
          content = await this.generateBASXML(basData, businessProfile);
          fileName = `BAS_${basData.financialYear}_Q${basData.quarter}_${now.toISOString().slice(0, 10)}.xml`;
          break;
        case 'csv':
          content = generateCSVSummary(basData, businessProfile);
          fileName = `BAS_${basData.financialYear}_Q${basData.quarter}_${now.toISOString().slice(0, 10)}.csv`;
          break;
        case 'pdf':
          content = generatePDFReport(basData, businessProfile);
          fileName = `BAS_${basData.financialYear}_Q${basData.quarter}_${now.toISOString().slice(0, 10)}.txt`;
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      const filePath = path.join(this.exportDir, userId, fileName);
      await fs.writeFile(filePath, content, 'utf-8');
      const stats = await fs.stat(filePath);

      // Update export record
      await markExportCompleted(exportId, filePath, stats.size);

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
      await markExportFailed(exportId, error);
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
    return loadBASFromDb(userId, financialYear, quarter);
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

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
