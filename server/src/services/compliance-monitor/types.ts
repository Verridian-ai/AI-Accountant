/**
 * Compliance Monitor Module — Type Definitions
 */

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
export const AU_QUARTER_CONFIG: Record<
  number,
  { startMonth: number; endMonth: number; startYear: 'start' | 'end' }
> = {
  1: { startMonth: 6, endMonth: 8, startYear: 'start' },
  2: { startMonth: 9, endMonth: 11, startYear: 'start' },
  3: { startMonth: 0, endMonth: 2, startYear: 'end' },
  4: { startMonth: 3, endMonth: 5, startYear: 'end' },
};

/** Standard due dates: month offset from quarter start, day of month */
export const STANDARD_DUE: Record<string, { monthOffset: number; day: number }> = {
  bas: { monthOffset: 3, day: 28 },
  payg: { monthOffset: 3, day: 28 },
  super: { monthOffset: 3, day: 28 },
  fbt: { monthOffset: 1, day: 21 },
  income_tax: { monthOffset: 0, day: 31 },
  tpar: { monthOffset: 0, day: 28 },
};
