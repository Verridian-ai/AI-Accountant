/**
 * Cross-Module Intelligence — Barrel Export
 *
 * Re-exports all public types, the orchestrator service class,
 * correlation helpers, timeline, insight CRUD, and scanners.
 */

export type {
  CrossModuleInsight,
  Correlation,
  ModuleConnection,
  TimelineEntry,
  InsightScanOptions,
  InsightFilters,
  ConnectionFilters,
  TimeRange,
} from './types.js';

export { CrossModuleIntelligenceService } from './cross-module-intelligence.js';

export { calculatePearsonCorrelation, getModuleMetrics } from './correlation.js';

export { buildInsight, deduplicateInsights, rowToInsight, parseJson } from './helpers.js';

export { generateTimeline } from './timeline.js';

export {
  getInsights,
  getInsightById,
  markInsightViewed,
  actOnInsight,
  dismissInsight,
} from './insight-crud.js';

export { scanAnomalyCascades } from './scanners/anomaly-cascade.js';
export { scanTrendAlignments } from './scanners/trend-alignment.js';
export { scanComplianceRisks } from './scanners/compliance-risk.js';
export { scanForecastDeviations } from './scanners/forecast-deviation.js';
export { scanTaxOpportunities } from './scanners/tax-opportunity.js';
export { scanSpendingPatterns } from './scanners/spending-pattern.js';
