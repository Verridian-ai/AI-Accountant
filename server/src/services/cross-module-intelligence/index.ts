// ============================================================================
// Cross-Module Intelligence — Public API barrel
// ============================================================================

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

export { CrossModuleIntelligenceService } from './service.js';

export { calculatePearsonCorrelation, tDistPValue, lnGamma } from './math-utils.js';

export { buildInsight, deduplicateInsights, rowToInsight, parseJson } from './insight-helpers.js';
