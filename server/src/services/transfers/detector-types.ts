/**
 * Inter-Account Transfer Detection — Types & Constants
 *
 * Shared interfaces, configuration types, and default config
 * used by the TransferDetector class and utility functions.
 */

/**
 * Transaction for transfer matching
 */
export interface TransferCandidate {
  id: number;
  accountId: number;
  date: string; // ISO format
  description: string;
  amount: number; // In cents, negative for debits
  isLinked?: boolean;
  linkedTransactionId?: number;
}

/**
 * Account information for context
 */
export interface AccountContext {
  id: number;
  accountNumber: string;
  bankId: string;
  accountName?: string;
  accountType?: string;
  ownershipTag?: 'personal' | 'business';
}

/**
 * Result of transfer matching
 */
export interface TransferMatch {
  sourceTransaction: TransferCandidate;
  targetTransaction: TransferCandidate;
  confidence: number;
  matchReasons: string[];
}

/**
 * Transfer detection configuration
 */
export interface TransferDetectorConfig {
  /** Maximum days between matching transactions */
  matchWindowDays: number;
  /** Amount tolerance for matching (in cents) */
  amountToleranceCents: number;
  /** Minimum confidence to consider a match */
  minConfidence: number;
  /** Keywords that indicate transfers */
  transferKeywords: string[];
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: TransferDetectorConfig = {
  matchWindowDays: 3,
  amountToleranceCents: 500, // $5 tolerance for fees
  minConfidence: 0.6,
  transferKeywords: [
    'transfer',
    'tfr',
    'trf',
    'internal',
    'osko',
    'pay anyone',
    'bpay',
    'direct credit',
    'direct debit',
    'internet transfer',
    'mobile transfer',
    'credit card',
    'cc payment',
    'card payment',
    'visa payment',
    'mastercard',
    'sweep',
    'auto save',
    'automatic transfer',
    'scheduled transfer',
  ],
};
