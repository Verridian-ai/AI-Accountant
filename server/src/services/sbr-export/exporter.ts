import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { db, basPeriods, basCalculations, exportHistory } from '../../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import type {
  BASData,
  BusinessProfile,
  SBRExportResult,
  ExportHistoryEntry,
  ValidationResult,
} from './types.js';
import { DEFAULT_EXPORT_DIR } from './constants.js';
import { validateBASData } from './validation.js';
import { calculateDerivedValues, ensureExportDir } from './helpers.js';
import { buildXML } from './xml-generator.js';
import { generateBASCSV } from './csv-generator.js';
import { generateBASTextReport } from './text-report.js';

export class SBRExporter {
  private exportDir: string;
  private defaultExpiryDays: number;

  constructor(exportDir?: string, expiryDays?: number) {
    this.exportDir = exportDir || DEFAULT_EXPORT_DIR;
    this.defaultExpiryDays = expiryDays || 30;
  }

  async generateBASXML(basData: BASData, businessProfile: BusinessProfile): Promise<string> {
    const validation = validateBASData(basData);
    if (!validation.isValid) {
      const errorMessages = validation.errors.map((e) => e.message).join('; ');
      throw new Error(`BAS validation failed: ${errorMessages}`);
    }
    const calculatedData = calculateDerivedValues(basData);
    return buildXML(calculatedData, businessProfile);
  }

  validateBASData(basData: BASData): ValidationResult {
    return validateBASData(basData);
  }

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

      if (h.dateRange) {
        try {
          const parsed = JSON.parse(String(h.dateRange));
          financialYear = parsed.financialYear || '';
          quarter = parsed.quarter || 0;
        } catch {
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

  async exportBAS(
    userId: string,
    basData: BASData,
    businessProfile: BusinessProfile,
    format: 'xml' | 'csv' | 'pdf',
  ): Promise<SBRExportResult> {
    const exportId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.defaultExpiryDays * 24 * 60 * 60 * 1000);

    await ensureExportDir(this.exportDir, userId);
    const validation = validateBASData(basData);

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
          content = generateBASCSV(basData, businessProfile);
          fileName = `BAS_${basData.financialYear}_Q${basData.quarter}_${now.toISOString().slice(0, 10)}.csv`;
          break;
        case 'pdf':
          content = generateBASTextReport(basData, businessProfile);
          fileName = `BAS_${basData.financialYear}_Q${basData.quarter}_${now.toISOString().slice(0, 10)}.txt`;
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      const filePath = path.join(this.exportDir, userId, fileName);
      await fs.writeFile(filePath, content, 'utf-8');
      const stats = await fs.stat(filePath);

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

    if (period.length === 0) return null;

    const calc = await db
      .select()
      .from(basCalculations)
      .where(eq(basCalculations.basPeriodId, period[0].id))
      .limit(1);

    if (calc.length === 0) return null;

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
}
