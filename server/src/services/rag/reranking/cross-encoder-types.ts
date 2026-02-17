/**
 * Cross-Encoder Types and Constants
 *
 * Type definitions and configuration for the cross-encoder reranking module.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CrossEncoderConfig {
  /** Local model to use for reranking */
  localModel: 'ms-marco-MiniLM-L-6-v2' | 'ms-marco-MiniLM-L-12-v2';
  /** Cohere API key for fallback */
  cohereApiKey?: string;
  /** Cohere model to use */
  cohereModel: 'rerank-english-v3.0' | 'rerank-multilingual-v3.0';
  /** Use local model as primary (vs Cohere) */
  preferLocal: boolean;
  /** Timeout for local model inference (ms) */
  localTimeoutMs: number;
  /** Maximum documents to rerank in a single batch */
  maxBatchSize: number;
  /** Minimum score threshold (0-1) to include in results */
  minScoreThreshold: number;
}

export interface RerankInput {
  /** Unique identifier for the document/chunk */
  id: string;
  /** Text content to compare against the query */
  content: string;
  /** Original retrieval score (for hybrid combining) */
  originalScore?: number;
  /** Additional metadata to preserve */
  metadata?: Record<string, unknown>;
}

export interface RerankOutput {
  /** Document identifier */
  id: string;
  /** Cross-encoder relevance score (0-1 normalized) */
  crossEncoderScore: number;
  /** Raw model score before normalization */
  rawScore: number;
  /** Original retrieval score */
  originalScore?: number;
  /** Combined score if hybrid reranking is used */
  combinedScore?: number;
  /** Preserved metadata */
  metadata?: Record<string, unknown>;
  /** Rank position (1-indexed) */
  rank: number;
}

export interface CrossEncoderResult {
  /** Reranked documents */
  results: RerankOutput[];
  /** Which model was used */
  modelUsed: 'local' | 'cohere';
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Whether fallback was triggered */
  usedFallback: boolean;
  /** Any warnings during processing */
  warnings: string[];
}

// ============================================================================
// COHERE API TYPES
// ============================================================================

export interface CohereRerankResponse {
  results: Array<{
    index: number;
    relevance_score: number;
  }>;
  meta?: {
    api_version?: {
      version: string;
    };
  };
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_CROSS_ENCODER_CONFIG: CrossEncoderConfig = {
  localModel: 'ms-marco-MiniLM-L-6-v2',
  cohereModel: 'rerank-english-v3.0',
  preferLocal: true,
  localTimeoutMs: 30000,
  maxBatchSize: 100,
  minScoreThreshold: 0.0,
};
