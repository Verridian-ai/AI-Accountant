/**
 * Payment Matching Types and Constants
 * All type definitions, interfaces, and constants for payment matching
 */

import type { ocrDocuments, transactions, paymentMatchRules } from '../../schema.js';

// ============================================================================
// Inferred DB Types
// ============================================================================

export type OcrDocument = typeof ocrDocuments.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type PaymentMatchRule = typeof paymentMatchRules.$inferSelect;

// ============================================================================
// Type Definitions
// ============================================================================

export interface MatchCandidate {
  transactionId: string;
  transactionDate: string;
  transactionDescription: string;
  transactionAmount: number;
  score: MatchScore;
  ruleId?: string;
}

export interface MatchScore {
  overallScore: number;
  factors: {
    amount: number;
    date: number;
    vendor: number;
    rule: number;
  };
  amountDifference: number;
  dateDifference: number;
}

export interface AutoMatchResult {
  matched: number;
  suggested: number;
  unmatched: number;
  details: Array<{
    documentId: string;
    status: 'matched' | 'suggested' | 'unmatched';
    matchId?: string;
    topScore?: number;
  }>;
}

export interface MatchStats {
  totalDocuments: number;
  matched: number;
  pending: number;
  failed: number;
  matchRate: number;
  averageConfidence: number;
  topVendors: Array<{ name: string; count: number }>;
  ruleEffectiveness: Array<{
    ruleId: string;
    name: string;
    matchCount: number;
    lastMatched?: string;
  }>;
}

export interface CreateRuleParams {
  name: string;
  ruleType: 'exact_amount' | 'amount_range' | 'vendor_match' | 'recurring' | 'composite';
  vendorPattern?: string;
  amountExact?: number;
  amountMin?: number;
  amountMax?: number;
  amountTolerance?: number;
  dateToleranceDays?: number;
  categoryFilter?: string;
  priority?: number;
}

export interface MatchOptions {
  amountTolerance?: number;
  dateTolerance?: number;
  minScore?: number;
  limit?: number;
}

export interface AutoMatchOptions {
  autoMatchThreshold?: number;
  suggestThreshold?: number;
  applyRules?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

export const WEIGHT_AMOUNT = 0.4;
export const WEIGHT_DATE = 0.25;
export const WEIGHT_VENDOR = 0.2;
export const WEIGHT_RULE = 0.15;

export const DEFAULT_AMOUNT_TOLERANCE = 0.01;
export const DEFAULT_DATE_TOLERANCE = 7;
export const DEFAULT_AUTO_MATCH_THRESHOLD = 0.85;
export const DEFAULT_SUGGEST_THRESHOLD = 0.6;
export const DEFAULT_LIMIT = 10;

export const COMMON_PREFIXES = [
  'payment to',
  'direct debit',
  'transfer to',
  'transfer from',
  'deposit from',
  'eftpos',
  'visa purchase',
  'bpay',
  'osko payment',
  'pay anyone',
  'payroll',
];
