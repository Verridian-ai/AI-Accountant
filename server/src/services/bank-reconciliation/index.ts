/**
 * Bank Reconciliation — Barrel Export
 *
 * Re-exports all public types, functions, and the service singleton
 * so consumers can import from 'bank-reconciliation/index.js'.
 */

// Types & constants
export type {
  LedgerEntryCandidate,
  BankReconSession,
  BankReconMatch,
  BankReconRule,
  MatchType,
} from './types.js';
export { VALID_MATCH_TYPES, MAX_REGEX_LENGTH, NESTED_QUANTIFIER_PATTERN } from './types.js';

// Data access layer
export { rawQuery } from './data-access.js';

// Scoring & matching
export {
  scoreAmountMatch,
  scoreDateMatch,
  scoreDescriptionMatch,
  scoreCombined,
  evaluateRule,
  parseConfig,
  levenshteinDistance,
  normalizeDescription,
} from './matching.js';

// Suggestions
export { suggestMatches } from './suggestions.js';

// Auto-match engine
export { runAutoMatch, findBestMatch } from './auto-match.js';

// Session lifecycle / balance checks
export {
  startSession,
  getSession,
  listSessions,
  completeSession,
  abandonSession,
} from './balance-check.js';

// Rule management
export {
  getMatchRules,
  createMatchRule,
  updateMatchRule,
  deleteMatchRule,
  seedDefaultRules,
} from './rules.js';

// Orchestrator class & singleton
export { BankReconciliationService, bankReconciliationService } from './reconciliation.js';
