/**
 * Data Export Service — Core Service Class
 * Thin orchestrator delegating to export-data and formatters.
 */

import { db, exportHistory } from '../../schema.js';
import { logger } from '../../lib/logger.js';
import { config } from '../../lib/config.js';
import { eq, and, lte, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import type { ExportOptions, ExportResult } from './types.js';
import { generateCSV, generateTextReport } from './formatters.js';
import {
  exportTransactions,
  exportBAS,
  exportTaxSummary,
  exportFullBackup,
} from './export-data.js';

export class ExportService {
  private exportDir: string;
  private defaultExpiryDays: number;

  constructor(exportDir?: string, expiryDays?: number) {
    this.exportDir = exportDir || path.join(process.cwd(), 'exports');
    this.defaultExpiryDays = expiryDays || 7;
  }

  private validateUserId(userId: string): boolean {
    const uuidPattern = /^[a-zA-Z0-9\-_]+$/;
    if (!uuidPattern.test(userId)) return false;
    if (userId.includes('..') || userId.includes('/') || userId.includes('\\')) return false;
    return true;
  }

  private isPathWithinExportDir(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    const normalizedExportDir = path.normalize(this.exportDir);
    return normalizedPath.startsWith(normalizedExportDir + path.sep);
  }

  async createExport(options: ExportOptions): Promise<ExportResult> {
    if (!this.validateUserId(options.userId)) {
      throw new Error('Invalid user ID format');
    }

    const now = new Date();
    const exportId = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() + this.defaultExpiryDays * 24 * 60 * 60 * 1000);

    await this.ensureExportDir(options.userId);

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
      const genFile = this.generateFile.bind(this);
      let result: ExportResult;

      switch (options.type) {
        case 'transactions':
          result = await exportTransactions(exportId, options, genFile);
          break;
        case 'bas':
          result = await exportBAS(exportId, options, genFile);
          break;
        case 'tax_summary':
          result = await exportTaxSummary(exportId, options, genFile);
          break;
        case 'full_backup':
          result = await exportFullBackup(exportId, options, genFile);
          break;
        default:
          throw new Error(`Unknown export type: ${options.type}`);
      }

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

  private async generateFile(
    exportId: string,
    options: ExportOptions,
    data: unknown,
    baseName: string,
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
        content = generateCSV(data);
        recordCount = Array.isArray(data) ? data.length : 1;
        break;
      case 'xlsx':
        logger.warn('XLSX export not yet implemented, falling back to CSV');
        content = generateCSV(data);
        recordCount = Array.isArray(data) ? data.length : 1;
        break;
      case 'pdf':
        logger.warn('PDF export not yet implemented, generating text');
        content = generateTextReport(data, options.type);
        recordCount = Array.isArray(data) ? data.length : 1;
        break;
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }

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

  private async ensureExportDir(userId: string): Promise<void> {
    if (!this.validateUserId(userId)) throw new Error('Invalid user ID format');
    const userDir = path.join(this.exportDir, userId);
    if (!this.isPathWithinExportDir(userDir + path.sep))
      throw new Error('Invalid export directory path');
    await fs.mkdir(userDir, { recursive: true });
  }

  async getExport(
    exportId: string,
    requestingUserId: string,
  ): Promise<typeof exportHistory.$inferSelect | null> {
    const result = await db
      .select()
      .from(exportHistory)
      .where(and(eq(exportHistory.id, exportId), eq(exportHistory.userId, requestingUserId)))
      .limit(1);
    return result[0] || null;
  }

  async getExportFilePath(exportId: string, requestingUserId: string): Promise<string | null> {
    const exp = await this.getExport(exportId, requestingUserId);
    if (!exp?.filePath) return null;
    if (!this.isPathWithinExportDir(exp.filePath)) {
      logger.error(`[ExportService] Suspicious file path detected: ${exp.filePath}`);
      return null;
    }
    return exp.filePath;
  }

  async getUserExports(
    userId: string,
    limit: number = 20,
  ): Promise<(typeof exportHistory.$inferSelect)[]> {
    return db
      .select()
      .from(exportHistory)
      .where(eq(exportHistory.userId, userId))
      .orderBy(desc(exportHistory.createdAt))
      .limit(limit);
  }

  async incrementDownloadCount(exportId: string, requestingUserId: string): Promise<boolean> {
    await db
      .update(exportHistory)
      .set({ downloadCount: sql`download_count + 1` })
      .where(and(eq(exportHistory.id, exportId), eq(exportHistory.userId, requestingUserId)));
    return true;
  }

  async cleanupExpiredExports(): Promise<number> {
    const now = new Date().toISOString();
    const expired = await db.select().from(exportHistory).where(lte(exportHistory.expiresAt, now));
    let cleaned = 0;
    for (const exp of expired) {
      if (exp.filePath) {
        try {
          await fs.unlink(exp.filePath);
        } catch {
          /* already deleted */
        }
      }
      await db.delete(exportHistory).where(eq(exportHistory.id, exp.id));
      cleaned++;
    }
    return cleaned;
  }
}

// Singleton instance
export const exportService = new ExportService();

// Schedule cleanup job (run daily)
if (config.isProduction) {
  setInterval(
    () => {
      exportService
        .cleanupExpiredExports()
        .then((count) => {
          if (count > 0) logger.info(`Cleaned up ${count} expired exports`);
        })
        .catch((err) => logger.error({ err }, 'Export cleanup failed'));
    },
    24 * 60 * 60 * 1000,
  );
}
