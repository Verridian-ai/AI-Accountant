/**
 * Anomaly Detection Module — Type Definitions
 */

export type AnomalyDetectorType =
  | 'duplicates'
  | 'amounts'
  | 'velocity'
  | 'category_drift'
  | 'merchant'
  | 'schedule';

export interface AnomalyScanOptions {
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  detectors: AnomalyDetectorType[];
  severityThreshold?: 'low' | 'medium' | 'high';
}

export interface AnomalyAlertResult {
  id: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  details: Record<string, unknown>;
  transactionId?: string;
  accountId?: string;
}

export interface AlertFilters {
  status?: string;
  severity?: string;
  alertType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AlertStats {
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface RecurringPattern {
  merchant: string;
  averageAmount: number;
  intervalDays: number;
  lastOccurrence: string;
  nextExpected: string;
}

export interface DescriptiveStats {
  mean: number;
  stdDev: number;
  median: number;
  q1: number;
  q3: number;
}

export const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};
