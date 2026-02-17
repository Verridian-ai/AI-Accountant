/**
 * Consolidation Module -- Barrel Export
 *
 * Re-exports all public types, classes, and the singleton instance
 * from the consolidation sub-modules.
 */

export type {
  ConsolidationRule,
  ConsolidationSnapshot,
  ConsolidationSnapshotLine,
  RuleCriteria,
  RuleAction,
} from './types.js';

export { CATEGORY_LINE_TYPE_MAP, getLineTypeForCategory } from './types.js';

export { applyEliminations } from './elimination-rules.js';
export type { EliminationResult } from './elimination-rules.js';

export { generateConsolidation, getDescendantEntities } from './consolidation-steps.js';

export {
  createConsolidationRule,
  updateConsolidationRule,
  deleteConsolidationRule,
  finalizeSnapshot,
} from './rule-management.js';

export { getConsolidationHistory, getSnapshotDetail } from './report-generator.js';

export { ConsolidationService, consolidationService } from './consolidation.js';
