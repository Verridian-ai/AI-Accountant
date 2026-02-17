/**
 * Parser Metrics — Barrel Export
 */

export type {
  DateRange,
  ParseAttemptRecord,
  ParserAccuracyResult,
  AggregatedMetrics,
  TopError,
  TrendDataPoint,
  ConfidenceBucket,
} from './types.js';

export {
  recordParseAttempt,
  getParserAccuracy,
  getTopErrors,
  getConfidenceDistribution,
  getFeedbackSummary,
  percentile,
} from './collectors.js';

export { getAggregatedMetrics, computeAndSaveRollup } from './aggregators.js';

export { computeRollups, getTrendData, getParserStatsByBank } from './rollups.js';

export { ParserMetrics, parserMetricsService } from './metrics-service.js';
