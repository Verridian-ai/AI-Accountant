/**
 * Compliance Monitor Service (Wave 15) -- Service Class
 *
 * Tracks ATO compliance obligations, generates recurring schedules,
 * monitors deadlines, and assesses overall risk.
 */

import { db, complianceChecks, complianceSchedules } from '../../schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import crypto from 'crypto';
import type {
  ObligationType,
  ObligationStatus,
  ScheduleFrequency,
  RiskLevel,
  ComplianceObligation,
  ComplianceScheduleItem,
  RiskAssessment,
} from './types.js';
import { STANDARD_DUE } from './types.js';
import { createDefaultSchedules, getPeriodsForFrequency } from './schedule-helpers.js';
import { assessOverallRisk } from './risk-assessment.js';
import {
  queryObligations,
  createObligationRecord,
  markObligationLodged,
  markObligationPaid,
} from './obligation-helpers.js';

export class ComplianceMonitorService {
  async checkObligations(
    userId: string,
    options?: {
      obligationType?: ObligationType;
      status?: ObligationStatus;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<ComplianceObligation[]> {
    return queryObligations(userId, options);
  }

  async createObligation(
    userId: string,
    data: {
      obligationType: ObligationType;
      period: string;
      dueDate: string;
      amountDue?: number;
      notes?: string;
    },
  ): Promise<string> {
    return createObligationRecord(userId, data);
  }

  async generateSchedule(userId: string, financialYear: string): Promise<ComplianceObligation[]> {
    const match = financialYear.match(/^(\d{4})-(\d{2})$/);
    if (!match)
      throw new Error(`Invalid financial year format: ${financialYear}. Expected YYYY-YY.`);
    const startYear = parseInt(match[1], 10);

    const scheduleRows = await db
      .select()
      .from(complianceSchedules)
      .where(and(eq(complianceSchedules.userId, userId), eq(complianceSchedules.enabled, 1)))
      .all();

    const schedules = scheduleRows as Record<string, unknown>[];

    if (schedules.length === 0) {
      await createDefaultSchedules(userId, this.createSchedule.bind(this));
      return this.generateSchedule(userId, financialYear);
    }

    const created: ComplianceObligation[] = [];

    for (const schedule of schedules) {
      const periods = getPeriodsForFrequency(
        schedule.frequency as ScheduleFrequency,
        schedule.obligationType as ObligationType,
        startYear,
      );

      for (const period of periods) {
        const existingRow = await db
          .select()
          .from(complianceChecks)
          .where(
            and(
              eq(complianceChecks.userId, userId),
              eq(complianceChecks.obligationType, schedule.obligationType as string),
              eq(complianceChecks.period, period.label),
            ),
          )
          .get();

        if (existingRow) continue;

        const id = await this.createObligation(userId, {
          obligationType: schedule.obligationType as ObligationType,
          period: period.label,
          dueDate: period.dueDate,
        });

        created.push({
          id,
          userId,
          obligationType: schedule.obligationType as ObligationType,
          period: period.label,
          dueDate: period.dueDate,
          status: 'pending',
          riskLevel: 'low',
          daysUntilDue: Math.ceil((new Date(period.dueDate).getTime() - Date.now()) / 86400000),
        });
      }
    }

    for (const schedule of schedules) {
      await db
        .update(complianceSchedules)
        .set({ lastGenerated: new Date().toISOString() })
        .where(eq(complianceSchedules.id, schedule.id as string))
        .run();
    }

    return created;
  }

  async getUpcomingDeadlines(userId: string, withinDays = 30): Promise<ComplianceObligation[]> {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + withinDays);

    const pastCutoff = new Date(now);
    pastCutoff.setDate(pastCutoff.getDate() - 90);

    const rawRows = await db
      .select()
      .from(complianceChecks)
      .where(
        and(
          eq(complianceChecks.userId, userId),
          gte(complianceChecks.dueDate, pastCutoff.toISOString().slice(0, 10)),
          lte(complianceChecks.dueDate, cutoff.toISOString().slice(0, 10)),
        ),
      )
      .orderBy(complianceChecks.dueDate)
      .all();

    const rows = rawRows as Record<string, unknown>[];

    const active = rows.filter(
      (r) => r.status !== 'lodged' && r.status !== 'paid' && r.status !== 'exempt',
    );

    return active.map((row) => {
      const dueDate = new Date(row.dueDate as string);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);

      let status: ObligationStatus = row.status as ObligationStatus;
      if (daysUntilDue < 0 && status !== 'lodged' && status !== 'paid') status = 'overdue';
      else if (daysUntilDue <= 14 && status === 'pending') status = 'upcoming';

      let riskLevel: RiskLevel = 'low';
      if (daysUntilDue < -28) riskLevel = 'critical';
      else if (daysUntilDue < 0) riskLevel = 'high';
      else if (daysUntilDue <= 7) riskLevel = 'medium';

      return {
        id: row.id as string,
        userId: row.userId as string,
        obligationType: row.obligationType as ObligationType,
        period: row.period as string,
        dueDate: row.dueDate as string,
        status,
        lodgedDate: (row.lodgedDate as string) ?? undefined,
        amountDue: (row.amountDue as number) ?? undefined,
        amountPaid: (row.amountPaid as number) ?? undefined,
        referenceNumber: (row.referenceNumber as string) ?? undefined,
        notes: (row.notes as string) ?? undefined,
        riskLevel,
        daysUntilDue,
      };
    });
  }

  async markLodged(
    obligationId: string,
    data: { lodgedDate?: string; amountPaid?: number; referenceNumber?: string; notes?: string },
  ): Promise<void> {
    return markObligationLodged(obligationId, data);
  }

  async markPaid(
    obligationId: string,
    amountPaid: number,
    referenceNumber?: string,
  ): Promise<void> {
    return markObligationPaid(obligationId, amountPaid, referenceNumber);
  }

  async assessOverallRisk(userId: string): Promise<RiskAssessment> {
    return assessOverallRisk(userId, this.checkObligations.bind(this));
  }

  async getSchedules(userId: string): Promise<ComplianceScheduleItem[]> {
    const rawRows = await db
      .select()
      .from(complianceSchedules)
      .where(eq(complianceSchedules.userId, userId))
      .all();

    const rows = rawRows as Record<string, unknown>[];

    return rows.map((row) => ({
      id: row.id as string,
      userId: row.userId as string,
      obligationType: row.obligationType as ObligationType,
      frequency: row.frequency as ScheduleFrequency,
      baseDueDay: row.baseDueDay as number,
      reminderDaysBefore: row.reminderDaysBefore as number,
      autoGenerate: Boolean(row.autoGenerate),
      enabled: Boolean(row.enabled),
    }));
  }

  async createSchedule(
    userId: string,
    data: {
      obligationType: ObligationType;
      frequency: ScheduleFrequency;
      baseDueDay?: number;
      reminderDaysBefore?: number;
      autoGenerate?: boolean;
    },
  ): Promise<string> {
    const id = crypto.randomUUID();
    const dueDay = data.baseDueDay ?? STANDARD_DUE[data.obligationType]?.day ?? 28;

    await db
      .insert(complianceSchedules)
      .values({
        id,
        userId,
        obligationType: data.obligationType,
        frequency: data.frequency,
        baseDueDay: dueDay,
        reminderDaysBefore: data.reminderDaysBefore ?? 14,
        autoGenerate: data.autoGenerate ?? true,
        enabled: true,
        createdAt: new Date().toISOString(),
      })
      .run();

    return id;
  }

  async toggleSchedule(scheduleId: string, enabled: boolean): Promise<void> {
    await db
      .update(complianceSchedules)
      .set({ enabled })
      .where(eq(complianceSchedules.id, scheduleId))
      .run();
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    await db.delete(complianceSchedules).where(eq(complianceSchedules.id, scheduleId)).run();
  }
}
