/**
 * Compliance Monitor — Obligation Helpers
 *
 * Row-mapping utilities and obligation query/update operations
 * extracted from ComplianceMonitorService.
 */

import { db, complianceChecks } from '../../schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import crypto from 'crypto';
import type { ObligationType, ObligationStatus, RiskLevel, ComplianceObligation } from './types.js';

/**
 * Map a raw DB row to a ComplianceObligation, computing status and risk.
 */
interface ComplianceCheckRow {
  id: string;
  userId: string;
  obligationType: string;
  period: string;
  dueDate: string;
  status: string;
  riskLevel: string;
  lodgedDate?: string | null;
  amountDue?: number | null;
  amountPaid?: number | null;
  referenceNumber?: string | null;
  notes?: string | null;
}

export function mapObligationRow(row: ComplianceCheckRow, now: Date): ComplianceObligation {
  const dueDate = new Date(row.dueDate);
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);

  let status = row.status as ObligationStatus;
  if (status === 'pending' || status === 'upcoming') {
    if (daysUntilDue < 0) status = 'overdue';
    else if (daysUntilDue <= 14) status = 'upcoming';
  }

  let riskLevel = row.riskLevel as RiskLevel;
  if (status === 'overdue') {
    riskLevel = daysUntilDue < -28 ? 'critical' : 'high';
  } else if (status === 'upcoming' && daysUntilDue <= 7) {
    riskLevel = 'medium';
  }

  return {
    id: row.id,
    userId: row.userId,
    obligationType: row.obligationType as ObligationType,
    period: row.period,
    dueDate: row.dueDate,
    status,
    lodgedDate: row.lodgedDate ?? undefined,
    amountDue: row.amountDue ?? undefined,
    amountPaid: row.amountPaid ?? undefined,
    referenceNumber: row.referenceNumber ?? undefined,
    notes: row.notes ?? undefined,
    riskLevel,
    daysUntilDue,
  };
}

/**
 * Query obligations with optional filters.
 */
export async function queryObligations(
  userId: string,
  options?: {
    obligationType?: ObligationType;
    status?: ObligationStatus;
    dateFrom?: string;
    dateTo?: string;
  },
): Promise<ComplianceObligation[]> {
  const conditions: SQL[] = [eq(complianceChecks.userId, userId)];

  if (options?.obligationType)
    conditions.push(eq(complianceChecks.obligationType, options.obligationType));
  if (options?.status) conditions.push(eq(complianceChecks.status, options.status));
  if (options?.dateFrom) conditions.push(gte(complianceChecks.dueDate, options.dateFrom));
  if (options?.dateTo) conditions.push(lte(complianceChecks.dueDate, options.dateTo));

  const rows = await db
    .select()
    .from(complianceChecks)
    .where(and(...conditions))
    .orderBy(complianceChecks.dueDate)
    .all();

  const now = new Date();
  return (rows as ComplianceCheckRow[]).map((row) => mapObligationRow(row, now));
}

/**
 * Create a new obligation record in the database.
 */
export async function createObligationRecord(
  userId: string,
  data: {
    obligationType: ObligationType;
    period: string;
    dueDate: string;
    amountDue?: number;
    notes?: string;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .insert(complianceChecks)
    .values({
      id,
      userId,
      obligationType: data.obligationType,
      period: data.period,
      dueDate: data.dueDate,
      status: 'pending',
      amountDue: data.amountDue ?? null,
      notes: data.notes ?? null,
      riskLevel: 'low',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .run();

  return id;
}

/**
 * Mark an obligation as lodged.
 */
export async function markObligationLodged(
  obligationId: string,
  data: { lodgedDate?: string; amountPaid?: number; referenceNumber?: string; notes?: string },
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(complianceChecks)
    .set({
      status: 'lodged',
      lodgedDate: data.lodgedDate ?? now.slice(0, 10),
      amountPaid: data.amountPaid ?? null,
      referenceNumber: data.referenceNumber ?? null,
      notes: data.notes ?? null,
      updatedAt: now,
    })
    .where(eq(complianceChecks.id, obligationId))
    .run();
}

/**
 * Mark an obligation as paid.
 */
export async function markObligationPaid(
  obligationId: string,
  amountPaid: number,
  referenceNumber?: string,
): Promise<void> {
  await db
    .update(complianceChecks)
    .set({
      status: 'paid',
      amountPaid,
      referenceNumber: referenceNumber ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(complianceChecks.id, obligationId))
    .run();
}
