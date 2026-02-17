/**
 * Financial Data Chunking Types
 *
 * Type definitions and configuration for the chunking system.
 */

import * as crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Chunk type identifiers matching the schema
 */
export type ChunkType =
  | 'single_transaction'
  | 'transaction_group'
  | 'temporal_window'
  | 'category_summary'
  | 'account_context';

/**
 * Token size limits for each chunk type
 */
export const CHUNK_TOKEN_LIMITS: Record<ChunkType, { min: number; max: number }> = {
  single_transaction: { min: 100, max: 200 },
  transaction_group: { min: 300, max: 500 },
  temporal_window: { min: 500, max: 800 },
  category_summary: { min: 200, max: 300 },
  account_context: { min: 400, max: 600 },
};

/**
 * Transaction input for chunking
 */
export interface TransactionInput {
  id: string;
  date: string; // YYYY-MM-DD format
  description: string;
  amount: number; // In cents
  balance?: number | null;
  category?: string | null;
  gstApplicable?: boolean | null;
  gstAmount?: number | null;
  aiReasoningNotes?: string | null;
  merchantNormalized?: string | null;
  accountId?: string | null;
  isTransfer?: boolean | null;
}

/**
 * Account input for context chunks
 */
export interface AccountInput {
  id: string;
  accountName: string;
  accountType: string;
  bankName?: string | null;
  currentBalance?: number | null;
  lastStatementDate?: string | null;
}

/**
 * Base chunk metadata
 */
export interface ChunkMetadata {
  userId: string;
  accountId?: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  category?: string | null;
  merchantNormalized?: string | null;
  totalAmount?: number | null;
  transactionCount?: number | null;
  transactionIds?: string[];
  chunkHash?: string;
}

/**
 * Generated chunk output
 */
export interface GeneratedChunk {
  content: string;
  chunkType: ChunkType;
  metadata: ChunkMetadata;
  tokenEstimate: number;
}

/**
 * Chunking configuration
 */
export interface ChunkingConfig {
  /** Enable overlapping chunks for context preservation */
  enableOverlap: boolean;
  /** Number of transactions to overlap between chunks */
  overlapTransactions: number;
  /** Minimum transactions before creating a group chunk */
  minGroupSize: number;
  /** Maximum transactions per group chunk */
  maxGroupSize: number;
  /** Days to include in temporal windows */
  temporalWindowDays: number;
  /** Include AI reasoning notes in chunks */
  includeReasoningNotes: boolean;
  /** Include balance information */
  includeBalance: boolean;
  /** Include GST details */
  includeGstDetails: boolean;
}

/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  enableOverlap: true,
  overlapTransactions: 2,
  minGroupSize: 3,
  maxGroupSize: 15,
  temporalWindowDays: 7,
  includeReasoningNotes: true,
  includeBalance: true,
  includeGstDetails: true,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Estimate token count for text (roughly 4 characters per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Format amount from cents to dollars with currency symbol
 */
export function formatAmount(cents: number): string {
  const dollars = cents / 100;
  const sign = dollars < 0 ? '-' : '+';
  return `${sign}$${Math.abs(dollars).toFixed(2)}`;
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Get month key from date (YYYY-MM)
 */
export function getMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7);
}

/**
 * Generate content hash for deduplication
 */
export function generateChunkHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Normalize merchant name for grouping
 */
export function normalizeMerchant(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ');
}
