/**
 * SBR Export History — Database Operations
 *
 * Handles saving and retrieving export records, and loading BAS data
 * from the database for export.
 */

import { db, basPeriods, basCalculations, exportHistory } from '../../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';
import type { BASData, ExportHistoryEntry } from './types.js';

/**
 * Get export history for a user
 */
export async function getExportHistory(
  userId: string,
  limit: number = 20,
): Promise<ExportHistoryEntry[]> {
  const history = await db
    .select()
    .from(exportHistory)
    .where(and(eq(exportHistory.userId, userId), eq(exportHistory.exportType, 'sbr_bas')))
    .orderBy(desc(exportHistory.createdAt))
    .limit(limit);

  return (history as Record<string, unknown>[]).map((h) => {
    let financialYear = '';
    let quarter = 0;

    // Safely parse dateRange JSON
    if (h.dateRange) {
      try {
        const parsed = JSON.parse(h.dateRange as string);
        financialYear = parsed.financialYear || '';
        quarter = parsed.quarter || 0;
      } catch {
        // dateRange is malformed; use defaults
        logger.warn(`Malformed dateRange in export history ${h.id as string}`);
      }
    }

    return {
      id: h.id as string,
      userId: h.userId as string,
      financialYear,
      quarter,
      format: h.format as string,
      status: h.status as string,
      filePath: (h.filePath as string | null) || undefined,
      createdAt: h.createdAt as string,
      expiresAt: (h.expiresAt as string | null) || undefined,
    };
  });
}

/**
 * Save a new export record (pending state)
 */
export async function saveExportRecord(
  exportId: string,
  userId: string,
  basData: BASData,
  format: string,
  expiresAt: Date,
  now: Date,
): Promise<void> {
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
}

/**
 * Mark export as completed
 */
export async function markExportCompleted(
  exportId: string,
  filePath: string,
  fileSizeBytes: number,
): Promise<void> {
  await db
    .update(exportHistory)
    .set({
      status: 'completed',
      filePath,
      fileSizeBytes,
      completedAt: new Date().toISOString(),
    })
    .where(eq(exportHistory.id, exportId));
}

/**
 * Mark export as failed
 */
export async function markExportFailed(exportId: string, error: unknown): Promise<void> {
  await db
    .update(exportHistory)
    .set({
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    })
    .where(eq(exportHistory.id, exportId));
}

/**
 * Load BAS data from database
 */
export async function loadBASFromDatabase(
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
