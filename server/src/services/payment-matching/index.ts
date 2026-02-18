/**
 * Payment Matching Module - Barrel Export
 * Re-exports all payment matching types, functions, and the PaymentMatchingService class
 */

export type {
  OcrDocument,
  Transaction,
  PaymentMatchRule,
  MatchCandidate,
  MatchScore,
  AutoMatchResult,
  MatchStats,
  CreateRuleParams,
  MatchOptions,
  AutoMatchOptions,
} from './types.js';

export { PaymentMatchingService, paymentMatchingService } from './payment-matching.js';
export {
  insertMatchRecord,
  insertAutoMatchRecord,
  insertSuggestionRecord,
  incrementRuleMatchCount,
} from './payment-matching-db.js';
export {
  createMatchRule,
  listMatchRules,
  updateMatchRule,
  deleteMatchRule,
} from './payment-matching-rules.js';
export { getMatchStats } from './payment-matching-stats.js';
