/**
 * Compliance Monitor Service — Wave 15
 * Tracks ATO compliance obligations (BAS, PAYG, super, FBT, income tax),
 * generates recurring schedules, monitors deadlines, and assesses overall risk.
 */

import { db, complianceChecks, complianceSchedules, anomalyAlerts } from '../schema.js';
import { eq, and, gte, lte, desc, sql, type SQL } from 'drizzle-orm';

type ComplianceCheckRow = typeof complianceChecks.$inferSelect;
type ComplianceScheduleRow = typeof complianceSchedules.$inferSelect;
type AnomalyAlertRow = typeof anomalyAlerts.$inferSelect;
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ObligationType = 'bas' | 'payg' | 'super' | 'fbt' | 'income_tax' | 'tpar' | 'other';
export type ObligationStatus = 'pending' | 'upcoming' | 'overdue' | 'lodged' | 'paid' | 'exempt';
export type ScheduleFrequency = 'monthly' | 'quarterly' | 'annually';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ComplianceObligation {
  id: string;
  userId: string;
  obligationType: ObligationType;
  period: string;
  dueDate: string;
  status: ObligationStatus;
  lodgedDate?: string;
  amountDue?: number;
  amountPaid?: number;
  referenceNumber?: string;
  notes?: string;
  riskLevel: RiskLevel;
  daysUntilDue: number;
}

export interface ComplianceScheduleItem {
  id: string;
  userId: string;
  obligationType: ObligationType;
  frequency: ScheduleFrequency;
  baseDueDay: number;
  reminderDaysBefore: number;
  autoGenerate: boolean;
  enabled: boolean;
}

export interface RiskAssessment {
  overallRisk: RiskLevel;
  score: number;
  overdueCount: number;
  upcomingCount: number;
  factors: RiskFactor[];
  recommendations: string[];
}

export interface RiskFactor {
  area: string;
  severity: RiskLevel;
  description: string;
  obligation?: string;
}

/** Australian financial year quarter offsets */
const AU_QUARTER_CONFIG: Record<
  number,
  { startMonth: number; endMonth: number; startYear: 'start' | 'end' }
> = {
  1: { startMonth: 6, endMonth: 8, startYear: 'start' }, // Jul-Sep
  2: { startMonth: 9, endMonth: 11, startYear: 'start' }, // Oct-Dec
  3: { startMonth: 0, endMonth: 2, startYear: 'end' }, // Jan-Mar
  4: { startMonth: 3, endMonth: 5, startYear: 'end' }, // Apr-Jun
};

/** Standard due dates: month offset from quarter start, day of month */
const STANDARD_DUE: Record<string, { monthOffset: number; day: number }> = {
  bas: { monthOffset: 3, day: 28 },
  payg: { monthOffset: 3, day: 28 },
  super: { monthOffset: 3, day: 28 },
  fbt: { monthOffset: 1, day: 21 }, // Only Q4
  income_tax: { monthOffset: 0, day: 31 }, // Oct 31 (annual)
  tpar: { monthOffset: 0, day: 28 }, // Aug 28 (annual)
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ComplianceMonitorService {
  // -----------------------------------------------------------------------
  // Obligations
  // -----------------------------------------------------------------------

  /** Check all compliance obligations for a user, computing status + days until due. */
  async checkObligations(
    userId: string,
    options?: {
      obligationType?: ObligationType;
      status?: ObligationStatus;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<ComplianceObligation[]> {
    const conditions: (SQL | undefined)[] = [eq(complianceChecks.userId, userId)];

    if (options?.obligationType)
      conditions.push(eq(complianceChecks.obligationType, options.obligationType));
    if (options?.status) conditions.push(eq(complianceChecks.status, options.status));
    if (options?.dateFrom) conditions.push(gte(complianceChecks.dueDate, options.dateFrom));
    if (options?.dateTo) conditions.push(lte(complianceChecks.dueDate, options.dateTo));

    const rows: ComplianceCheckRow[] = await db
      .select()
      .from(complianceChecks)
      .where(and(...conditions))
      .orderBy(complianceChecks.dueDate)
      .all();

    const now = new Date();

    return rows.map((row) => {
      const dueDate = new Date(row.dueDate);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);

      // Auto-update status based on current date
      let status = row.status as ObligationStatus;
      if (status === 'pending' || status === 'upcoming') {
        if (daysUntilDue < 0) status = 'overdue';
        else if (daysUntilDue <= 14) status = 'upcoming';
      }

      // Auto-assign risk level
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
    });
  }

  /** Create a new compliance obligation record. */
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

  // -----------------------------------------------------------------------
  // Schedule Generation
  // -----------------------------------------------------------------------

  /** Generate compliance schedule for a financial year based on user's schedules. */
  async generateSchedule(userId: string, financialYear: string): Promise<ComplianceObligation[]> {
    const match = financialYear.match(/^(\d{4})-(\d{2})$/);
    if (!match)
      throw new Error(`Invalid financial year format: ${financialYear}. Expected YYYY-YY.`);
    const startYear = parseInt(match[1], 10);

    // Get user's enabled schedules
    const schedules: ComplianceScheduleRow[] = await db
      .select()
      .from(complianceSchedules)
      .where(and(eq(complianceSchedules.userId, userId), eq(complianceSchedules.enabled, 1)))
      .all();

    // If no schedules, create defaults for quarterly BAS + super
    if (schedules.length === 0) {
      await this._createDefaultSchedules(userId);
      return this.generateSchedule(userId, financialYear);
    }

    const created: ComplianceObligation[] = [];

    for (const schedule of schedules) {
      const periods = this._getPeriodsForFrequency(
        schedule.frequency as ScheduleFrequency,
        schedule.obligationType as ObligationType,
        startYear,
      );

      for (const period of periods) {
        // Check if obligation already exists
        const existing = await db
          .select()
          .from(complianceChecks)
          .where(
            and(
              eq(complianceChecks.userId, userId),
              eq(complianceChecks.obligationType, schedule.obligationType),
              eq(complianceChecks.period, period.label),
            ),
          )
          .get();

        if (existing) continue;

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

    // Mark schedule as generated
    for (const schedule of schedules) {
      await db
        .update(complianceSchedules)
        .set({ lastGenerated: new Date().toISOString() })
        .where(eq(complianceSchedules.id, schedule.id))
        .run();
    }

    return created;
  }

  // -----------------------------------------------------------------------
  // Deadlines
  // -----------------------------------------------------------------------

  /** Get upcoming deadlines within N days, sorted by urgency. */
  async getUpcomingDeadlines(userId: string, withinDays = 30): Promise<ComplianceObligation[]> {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + withinDays);

    // Include overdue (past due) plus upcoming within range
    const pastCutoff = new Date(now);
    pastCutoff.setDate(pastCutoff.getDate() - 90); // Show up to 90 days overdue

    const rows: ComplianceCheckRow[] = await db
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

    // Filter out already-lodged/paid
    const active = rows.filter(
      (r) => r.status !== 'lodged' && r.status !== 'paid' && r.status !== 'exempt',
    );

    return active.map((row) => {
      const dueDate = new Date(row.dueDate);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);

      let status: ObligationStatus = row.status as ObligationStatus;
      if (daysUntilDue < 0 && status !== 'lodged' && status !== 'paid') status = 'overdue';
      else if (daysUntilDue <= 14 && status === 'pending') status = 'upcoming';

      let riskLevel: RiskLevel = 'low';
      if (daysUntilDue < -28) riskLevel = 'critical';
      else if (daysUntilDue < 0) riskLevel = 'high';
      else if (daysUntilDue <= 7) riskLevel = 'medium';

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
    });
  }

  // -----------------------------------------------------------------------
  // Lodgement
  // -----------------------------------------------------------------------

  /** Mark an obligation as lodged. */
  async markLodged(
    obligationId: string,
    data: {
      lodgedDate?: string;
      amountPaid?: number;
      referenceNumber?: string;
      notes?: string;
    },
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

  /** Mark an obligation as paid. */
  async markPaid(
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

  // -----------------------------------------------------------------------
  // Risk Assessment
  // -----------------------------------------------------------------------

  /** Assess overall compliance risk for a user. */
  async assessOverallRisk(userId: string): Promise<RiskAssessment> {
    const obligations = await this.checkObligations(userId);
    const factors: RiskFactor[] = [];
    const recommendations: string[] = [];

    const overdue = obligations.filter((o) => o.status === 'overdue');
    const upcoming = obligations.filter((o) => o.status === 'upcoming');
    const overdueCount = overdue.length;
    const upcomingCount = upcoming.length;

    // Score: 0-100, higher = more risk
    let score = 0;

    // Overdue obligations — highest weight
    for (const o of overdue) {
      const daysOverdue = Math.abs(o.daysUntilDue);
      const severity: RiskLevel =
        daysOverdue > 56 ? 'critical' : daysOverdue > 28 ? 'high' : 'medium';
      const weight = severity === 'critical' ? 25 : severity === 'high' ? 15 : 8;
      score += weight;

      factors.push({
        area: o.obligationType.toUpperCase(),
        severity,
        description: `${o.obligationType.toUpperCase()} for ${o.period} is ${daysOverdue} days overdue (due ${o.dueDate}).`,
        obligation: o.id,
      });

      if (daysOverdue > 28) {
        recommendations.push(
          `Lodge ${o.obligationType.toUpperCase()} for ${o.period} immediately — FTL penalties accrue every 28 days ($330 per period, up to 5 periods).`,
        );
      } else {
        recommendations.push(
          `Lodge ${o.obligationType.toUpperCase()} for ${o.period} as soon as possible to minimise penalties.`,
        );
      }
    }

    // Upcoming obligations close to due
    for (const o of upcoming) {
      if (o.daysUntilDue <= 7) {
        score += 5;
        factors.push({
          area: o.obligationType.toUpperCase(),
          severity: 'medium',
          description: `${o.obligationType.toUpperCase()} for ${o.period} is due in ${o.daysUntilDue} day(s) (${o.dueDate}).`,
          obligation: o.id,
        });
      }
    }

    // Active anomaly alerts factor — cross-module risk integration
    const openAlerts: AnomalyAlertRow[] = await db
      .select()
      .from(anomalyAlerts)
      .where(and(eq(anomalyAlerts.userId, userId), eq(anomalyAlerts.status, 'open')))
      .all();

    if (openAlerts.length > 0) {
      const alertScore = Math.min(openAlerts.length * 3, 20);
      score += alertScore;

      const highSeverity = openAlerts.filter(
        (a) => a.severity === 'high' || a.severity === 'critical',
      ).length;
      const severity: RiskLevel = highSeverity > 0 ? 'high' : 'medium';

      factors.push({
        area: 'Anomaly Alerts',
        severity,
        description: `${openAlerts.length} open anomaly alert(s) (${highSeverity} high/critical severity).`,
      });

      if (highSeverity > 0) {
        recommendations.push(
          `Review and resolve ${highSeverity} high-severity anomaly alert(s) — these may indicate compliance-relevant irregularities.`,
        );
      }
    }

    // Check for missing schedules
    const schedules: ComplianceScheduleRow[] = await db
      .select()
      .from(complianceSchedules)
      .where(eq(complianceSchedules.userId, userId))
      .all();

    if (schedules.length === 0) {
      score += 10;
      factors.push({
        area: 'Record Keeping',
        severity: 'medium',
        description: 'No compliance schedules configured — obligations may not be tracked.',
      });
      recommendations.push(
        'Set up compliance schedules to automatically track BAS, PAYG, and super deadlines.',
      );
    }

    // Cap score at 100
    score = Math.min(score, 100);

    let overallRisk: RiskLevel = 'low';
    if (score >= 70) overallRisk = 'critical';
    else if (score >= 40) overallRisk = 'high';
    else if (score >= 15) overallRisk = 'medium';

    // Add general recommendations
    if (overallRisk === 'low' && recommendations.length === 0) {
      recommendations.push(
        'All compliance obligations appear current. Continue monitoring upcoming deadlines.',
      );
    }

    return {
      overallRisk,
      score,
      overdueCount,
      upcomingCount,
      factors,
      recommendations,
    };
  }

  // -----------------------------------------------------------------------
  // Schedule CRUD
  // -----------------------------------------------------------------------

  /** Get all compliance schedules for a user. */
  async getSchedules(userId: string): Promise<ComplianceScheduleItem[]> {
    const rows: ComplianceScheduleRow[] = await db
      .select()
      .from(complianceSchedules)
      .where(eq(complianceSchedules.userId, userId))
      .all();

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      obligationType: row.obligationType as ObligationType,
      frequency: row.frequency as ScheduleFrequency,
      baseDueDay: row.baseDueDay,
      reminderDaysBefore: row.reminderDaysBefore,
      autoGenerate: Boolean(row.autoGenerate),
      enabled: Boolean(row.enabled),
    }));
  }

  /** Create a new compliance schedule. */
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

  /** Toggle a schedule's enabled state. */
  async toggleSchedule(scheduleId: string, enabled: boolean): Promise<void> {
    await db
      .update(complianceSchedules)
      .set({ enabled })
      .where(eq(complianceSchedules.id, scheduleId))
      .run();
  }

  /** Delete a compliance schedule. */
  async deleteSchedule(scheduleId: string): Promise<void> {
    await db.delete(complianceSchedules).where(eq(complianceSchedules.id, scheduleId)).run();
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  /** Create default Australian compliance schedules for a new user. */
  private async _createDefaultSchedules(userId: string): Promise<void> {
    const defaults: Array<{ type: ObligationType; freq: ScheduleFrequency; day: number }> = [
      { type: 'bas', freq: 'quarterly', day: 28 },
      { type: 'payg', freq: 'quarterly', day: 28 },
      { type: 'super', freq: 'quarterly', day: 28 },
      { type: 'income_tax', freq: 'annually', day: 31 },
    ];

    for (const d of defaults) {
      await this.createSchedule(userId, {
        obligationType: d.type,
        frequency: d.freq,
        baseDueDay: d.day,
      });
    }
  }

  /**
   * Generate period labels + due dates for a financial year based on frequency.
   * Financial year starts July 1 of `startYear`.
   */
  private _getPeriodsForFrequency(
    frequency: ScheduleFrequency,
    obligationType: ObligationType,
    startYear: number,
  ): Array<{ label: string; dueDate: string }> {
    const periods: Array<{ label: string; dueDate: string }> = [];
    const fy = `${startYear}-${String(startYear + 1).slice(2)}`;

    if (frequency === 'quarterly') {
      for (let q = 1; q <= 4; q++) {
        const config = AU_QUARTER_CONFIG[q];
        const qYear = config.startYear === 'start' ? startYear : startYear + 1;
        const dueConfig = STANDARD_DUE[obligationType] ?? STANDARD_DUE.bas;

        // Due date: month after quarter start + offset
        const dueMonth = config.startMonth + dueConfig.monthOffset;
        const dueYear = qYear + Math.floor(dueMonth / 12);
        const dueDay = dueConfig.day;
        const dueDateStr = this._formatDate(dueYear, dueMonth % 12, dueDay);

        periods.push({
          label: `${fy}-Q${q}`,
          dueDate: dueDateStr,
        });
      }
    } else if (frequency === 'monthly') {
      // 12 months: Jul through Jun
      for (let m = 0; m < 12; m++) {
        const month = (6 + m) % 12; // Start from July (6)
        const year = month >= 6 ? startYear : startYear + 1;
        const monthName = new Date(year, month, 1).toLocaleString('en-AU', { month: 'short' });

        // Due 21st of the following month
        const dueMonth = month + 1;
        const dueYear = year + Math.floor(dueMonth / 12);
        const dueDateStr = this._formatDate(dueYear, dueMonth % 12, 21);

        periods.push({
          label: `${fy}-${monthName}`,
          dueDate: dueDateStr,
        });
      }
    } else if (frequency === 'annually') {
      // Annual obligations: income tax due Oct 31, TPAR due Aug 28
      if (obligationType === 'income_tax') {
        periods.push({
          label: fy,
          dueDate: `${startYear + 1}-10-31`,
        });
      } else if (obligationType === 'fbt') {
        periods.push({
          label: fy,
          dueDate: `${startYear + 1}-05-21`,
        });
      } else {
        // Generic annual: due Oct 31 of following year
        periods.push({
          label: fy,
          dueDate: `${startYear + 1}-10-31`,
        });
      }
    }

    return periods;
  }

  /** Format a date as YYYY-MM-DD, clamping day to valid range. */
  private _formatDate(year: number, month: number, day: number): string {
    // Clamp day to last day of month
    const lastDay = new Date(year, month + 1, 0).getDate();
    const clampedDay = Math.min(day, lastDay);
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(clampedDay).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }
}
