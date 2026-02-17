/**
 * Compliance Monitor — Schedule Generation Helpers
 *
 * Private helpers for generating compliance obligation schedules.
 * Used by ComplianceMonitorService.
 */

import type { ObligationType, ScheduleFrequency } from './types.js';
import { AU_QUARTER_CONFIG, STANDARD_DUE } from './types.js';

/**
 * Create default compliance schedules for a new user.
 */
export async function createDefaultSchedules(
  userId: string,
  createScheduleFn: (
    userId: string,
    data: {
      obligationType: ObligationType;
      frequency: ScheduleFrequency;
      baseDueDay?: number;
    },
  ) => Promise<string>,
): Promise<void> {
  const defaults: Array<{ type: ObligationType; freq: ScheduleFrequency; day: number }> = [
    { type: 'bas', freq: 'quarterly', day: 28 },
    { type: 'payg', freq: 'quarterly', day: 28 },
    { type: 'super', freq: 'quarterly', day: 28 },
    { type: 'income_tax', freq: 'annually', day: 31 },
  ];

  for (const d of defaults) {
    await createScheduleFn(userId, {
      obligationType: d.type,
      frequency: d.freq,
      baseDueDay: d.day,
    });
  }
}

/**
 * Get periods for a given frequency, obligation type, and financial year start.
 */
export function getPeriodsForFrequency(
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

      const dueMonth = config.startMonth + dueConfig.monthOffset;
      const dueYear = qYear + Math.floor(dueMonth / 12);
      const dueDay = dueConfig.day;
      const dueDateStr = formatDate(dueYear, dueMonth % 12, dueDay);

      periods.push({ label: `${fy}-Q${q}`, dueDate: dueDateStr });
    }
  } else if (frequency === 'monthly') {
    for (let m = 0; m < 12; m++) {
      const month = (6 + m) % 12;
      const year = month >= 6 ? startYear : startYear + 1;
      const monthName = new Date(year, month, 1).toLocaleString('en-AU', { month: 'short' });

      const dueMonth = month + 1;
      const dueYear = year + Math.floor(dueMonth / 12);
      const dueDateStr = formatDate(dueYear, dueMonth % 12, 21);

      periods.push({ label: `${fy}-${monthName}`, dueDate: dueDateStr });
    }
  } else if (frequency === 'annually') {
    if (obligationType === 'income_tax') {
      periods.push({ label: fy, dueDate: `${startYear + 1}-10-31` });
    } else if (obligationType === 'fbt') {
      periods.push({ label: fy, dueDate: `${startYear + 1}-05-21` });
    } else {
      periods.push({ label: fy, dueDate: `${startYear + 1}-10-31` });
    }
  }

  return periods;
}

/**
 * Format a date given year, zero-based month, and day.
 * Clamps day to the last day of the month.
 */
export function formatDate(year: number, month: number, day: number): string {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(day, lastDay);
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(clampedDay).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}
