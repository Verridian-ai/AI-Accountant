/**
 * Forecasting Service — Barrel Export
 */
export type { CreateScenarioParams, ScenarioComparison } from './types.js';
export { SCENARIO_DEFAULTS, calculateStdDev, calculateConfidenceInterval } from './types.js';
export { ForecastingService } from './forecasting-service.js';

import { ForecastingService } from './forecasting-service.js';
export const forecastingService = new ForecastingService();
