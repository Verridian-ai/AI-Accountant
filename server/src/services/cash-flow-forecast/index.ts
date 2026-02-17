/**
 * Cash Flow Forecast Module — Barrel Export
 */

export * from './types.js';
export {
  linearRegression,
  seasonalDecompose,
  calculateConfidenceBands,
  recentTrendPredict,
  getPeriodLength,
  generatePeriodBoundaries,
} from './projections.js';
export { projectPeriods } from './forecast-models.js';
export { CashFlowForecastService } from './forecast-service.js';

import { CashFlowForecastService } from './forecast-service.js';

// Export singleton instance (not in original monolith but consistent with pattern)
export const cashFlowForecastService = new CashFlowForecastService();
