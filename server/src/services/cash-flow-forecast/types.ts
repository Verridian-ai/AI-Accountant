/**
 * Cash flow forecast types — defined locally (no back-import from parent monolith).
 */

export interface ForecastOptions {
  type: 'linear' | 'seasonal' | 'ml_weighted';
  startDate: string;
  endDate: string;
  granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  confidenceLevel?: number;
  categoryBreakdown?: boolean;
}

export interface ForecastPeriodResult {
  periodStart: string;
  periodEnd: string;
  predictedInflow: number;
  predictedOutflow: number;
  predictedNet: number;
  confidenceLower: number;
  confidenceUpper: number;
  breakdown?: Record<string, number>;
}

export interface AccuracyMetrics {
  mae: number;
  rmse: number;
  mape: number;
  directionAccuracy: number;
  periodsEvaluated: number;
}

export interface ForecastComparison {
  forecasts: Array<{ id: string; type: string; accuracy: AccuracyMetrics }>;
  recommendation: string;
  periodDeltas: Array<{ period: string; values: Record<string, number> }>;
}
