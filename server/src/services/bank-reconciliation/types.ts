/**
 * Bank reconciliation types.
 * BankReconSession is re-exported from parent; others are defined here
 * since the parent does not export them.
 */
export type { BankReconSession } from '../bank-reconciliation.js';

export interface BankReconMatch {
  id: string;
  sessionId: string;
  bankTransactionId: string;
  ledgerEntryId: string;
  matchType: string;
  matchRuleId: string | null;
  confidence: number;
  matchReasons: string;
  status: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

export interface BankReconRule {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  matchType: string;
  matchConfig: string;
  autoConfirm: boolean;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntryCandidate {
  id: string;
  entryId: string;
  debit: number;
  credit: number;
  description: string;
  entryDate: string;
  reference: string;
  journalDescription: string;
}

export const VALID_MATCH_TYPES = [
  'amount_exact',
  'amount_date',
  'reference_number',
  'description_pattern',
  'combined',
] as const;

export type MatchType = (typeof VALID_MATCH_TYPES)[number];

/** ReDoS prevention: max regex pattern length */
export const MAX_REGEX_LENGTH = 256;

/** Patterns with nested quantifiers that could cause catastrophic backtracking */
export const NESTED_QUANTIFIER_PATTERN = /(\+|\*|\?|\{)\s*(\+|\*|\?|\{)/;
