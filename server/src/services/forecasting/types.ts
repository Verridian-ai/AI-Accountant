/**
 * Forecasting Service — Type Definitions & Statistical Utilities
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CreateScenarioParams {
  name: string;
  scenarioType: 'optimistic' | 'realistic' | 'pessimistic' | 'custom';
  basePeriodStart: string;
  basePeriodEnd: string;
  forecastMonths: number;
  assumptions?: Record<string, any>;
}

export interface ScenarioComparison {
  months: Array<{ period: string; scenarios: Record<string, number> }>;
  totals: Record<string, number>;
}

/** Default assumptions per scenario type */
export const SCENARIO_DEFAULTS: Record<string, Record<string, any>> = {
  optimistic: { growthRate: 0.1, inflationAdjust: true, seasonalWeight: 0.8 },
  realistic: { growthRate: 0.03, inflationAdjust: true, seasonalWeight: 1.0 },
  pessimistic: { growthRate: -0.05, inflationAdjust: true, seasonalWeight: 1.2 },
};

// ============================================================================
// STATISTICAL UTILITY FUNCTIONS
// ============================================================================

export function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((s, v) => s + v, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Calculate confidence interval: mean +/- (z-score x stddev / sqrt(n)) */
export function calculateConfidenceInterval(
  values: number[],
  confidenceLevel: number,
): { lower: number; upper: number } {
  if (values.length === 0) return { lower: 0, upper: 0 };
  if (values.length === 1) return { lower: values[0], upper: values[0] };

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const stddev = calculateStdDev(values);

  // z-score lookup
  let zScore: number;
  if (confidenceLevel >= 0.99) {
    zScore = 2.576;
  } else if (confidenceLevel >= 0.95) {
    zScore = 1.96;
  } else if (confidenceLevel >= 0.9) {
    zScore = 1.645;
  } else {
    zScore = 1.28; // ~80%
  }

  const marginOfError = (zScore * stddev) / Math.sqrt(values.length);

  return {
    lower: Math.round(mean - marginOfError),
    upper: Math.round(mean + marginOfError),
  };
}
