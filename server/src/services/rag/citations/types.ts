/**
 * Citation Types
 *
 * Type definitions for the citation management system.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Represents a source chunk used for RAG retrieval
 */
export interface SourceChunk {
  chunkId: string;
  documentId: string;
  content: string;
  relevanceScore: number;
  rerankScore?: number;
  metadata?: ChunkMetadata;
}

/**
 * Metadata associated with a chunk
 */
export interface ChunkMetadata {
  transactionId?: string;
  accountId?: string;
  dateStart?: string;
  dateEnd?: string;
  category?: string;
  merchantNormalized?: string;
  totalAmount?: number;
  transactionCount?: number;
}

/**
 * A citation record linking an answer to its sources
 */
export interface Citation {
  id: string;
  answerId: string;
  chunkId: string;
  documentId: string;
  transactionId: string | null;
  accountId: string | null;
  relevanceScore: number | null;
  rerankScore: number | null;
  position: number;
  snippet: string;
  wasHelpful: boolean | null;
  createdAt: string;
}

/**
 * Detailed citation with source information for display
 */
export interface CitationWithSource extends Citation {
  sourceType: string;
  sourceTitle: string | null;
  chunkContent: string;
  transactionDetails?: TransactionDetails | null;
  accountDetails?: AccountDetails | null;
}

/**
 * Transaction details for citation display
 */
export interface TransactionDetails {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  balance: number | null;
}

/**
 * Account details for citation display
 */
export interface AccountDetails {
  id: string;
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  accountType: string;
}

/**
 * Formatted citation for UI display
 */
export interface FormattedCitation {
  id: string;
  position: number;
  snippet: string;
  source: {
    type: 'transaction' | 'account' | 'statement' | 'manual';
    title: string;
    date?: string;
    amount?: string;
    category?: string;
    account?: string;
  };
  relevance: {
    score: number;
    label: 'high' | 'medium' | 'low';
  };
  verifiable: boolean;
  deepLink?: string;
}

/**
 * Options for creating citations
 */
export interface CreateCitationOptions {
  maxCitations?: number;
  minRelevanceScore?: number;
  includeTransactionLinks?: boolean;
}

/**
 * Result of citation creation
 */
export interface CreateCitationResult {
  answerId: string;
  citations: Citation[];
  totalSourceChunks: number;
  citationsCreated: number;
}

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class CitationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'CitationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class SourceNotFoundError extends CitationError {
  constructor(chunkId: string) {
    super(`Source chunk not found: ${chunkId}`, 'SOURCE_NOT_FOUND', { chunkId });
    this.name = 'SourceNotFoundError';
  }
}

export class AnswerNotFoundError extends CitationError {
  constructor(answerId: string) {
    super(`Answer not found: ${answerId}`, 'ANSWER_NOT_FOUND', { answerId });
    this.name = 'AnswerNotFoundError';
  }
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_CITATION_OPTIONS: Required<CreateCitationOptions> = {
  maxCitations: 10,
  minRelevanceScore: 0.3,
  includeTransactionLinks: true,
};
