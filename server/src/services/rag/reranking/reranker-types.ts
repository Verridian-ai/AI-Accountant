/**
 * Reranker Pipeline Types
 *
 * Type definitions for the multi-stage reranking pipeline
 * that combines cross-encoder semantic reranking with financial domain boosting.
 */

import type { CrossEncoderConfig, CrossEncoderResult } from './cross-encoder.js';
import type {
  FinancialBoostConfig,
  DocumentFinancialMetadata,
  FinancialBoostResult,
} from './financial-boost.js';

// ============================================================================
// TYPES
// ============================================================================

export interface RerankerPipelineConfig {
  /** Cross-encoder configuration */
  crossEncoder: Partial<CrossEncoderConfig>;
  /** Financial boost configuration */
  financialBoost: Partial<FinancialBoostConfig>;
  /** Whether to use cross-encoder reranking */
  useCrossEncoder: boolean;
  /** Whether to apply financial domain boosts */
  useFinancialBoost: boolean;
  /** Weight for cross-encoder score in final combination (0-1) */
  crossEncoderWeight: number;
  /** Weight for financial boost in final combination (0-1) */
  financialBoostWeight: number;
  /** Number of top results to return after reranking */
  topK: number;
  /** Minimum final score threshold */
  minFinalScore: number;
}

export interface HybridSearchResult {
  /** Document/chunk identifier */
  id: string;
  /** Text content */
  content: string;
  /** Original retrieval score (dense + sparse combined) */
  score: number;
  /** Dense retrieval score component */
  denseScore?: number;
  /** Sparse retrieval score component */
  sparseScore?: number;
  /** Financial metadata from the chunk */
  financialMetadata?: DocumentFinancialMetadata;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface RerankedResult {
  /** Document/chunk identifier */
  id: string;
  /** Original text content */
  content: string;
  /** Final combined score after reranking */
  finalScore: number;
  /** Original retrieval score */
  originalScore: number;
  /** Cross-encoder score (if used) */
  crossEncoderScore?: number;
  /** Financial boost score (if used) */
  financialBoostScore?: number;
  /** Score breakdown for transparency */
  scoreBreakdown: ScoreBreakdown;
  /** Final rank position (1-indexed) */
  rank: number;
  /** Preserved metadata */
  metadata?: Record<string, unknown>;
  /** Financial metadata */
  financialMetadata?: DocumentFinancialMetadata;
}

export interface ScoreBreakdown {
  /** Original retrieval score */
  original: number;
  /** Cross-encoder contribution */
  crossEncoder: number;
  /** Financial boost contribution */
  financialBoost: number;
  /** Merchant match boost */
  merchantBoost: number;
  /** Category match boost */
  categoryBoost: number;
  /** Recency boost */
  recencyBoost: number;
}

export interface RerankerPipelineResult {
  /** Reranked results */
  results: RerankedResult[];
  /** Total processing time */
  totalTimeMs: number;
  /** Cross-encoder processing details */
  crossEncoderDetails?: CrossEncoderResult;
  /** Financial boost processing details */
  financialBoostDetails?: FinancialBoostResult;
  /** Pipeline execution metadata */
  pipelineMetadata: PipelineMetadata;
}

export interface PipelineMetadata {
  /** Number of input documents */
  inputCount: number;
  /** Number of output documents after filtering */
  outputCount: number;
  /** Stages executed */
  stagesExecuted: string[];
  /** Warnings from all stages */
  warnings: string[];
  /** Configuration used */
  configUsed: Partial<RerankerPipelineConfig>;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_RERANKER_PIPELINE_CONFIG: RerankerPipelineConfig = {
  crossEncoder: {},
  financialBoost: {},
  useCrossEncoder: true,
  useFinancialBoost: true,
  crossEncoderWeight: 0.6, // Cross-encoder has higher weight
  financialBoostWeight: 0.4, // Financial boost supplements
  topK: 20,
  minFinalScore: 0.1,
};
