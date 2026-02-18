/**
 * Reranker Pipeline Types
 *
 * Type definitions and default configuration for the reranker pipeline.
 */

import type { CrossEncoderConfig } from './cross-encoder.js';
import type {
  FinancialBoostConfig,
  DocumentFinancialMetadata,
  FinancialBoostResult,
} from './financial-boost.js';
import type { CrossEncoderResult } from './cross-encoder.js';

// ============================================================================
// PIPELINE CONFIGURATION
// ============================================================================

export interface RerankerPipelineConfig {
  crossEncoder: Partial<CrossEncoderConfig>;
  financialBoost: Partial<FinancialBoostConfig>;
  useCrossEncoder: boolean;
  useFinancialBoost: boolean;
  crossEncoderWeight: number;
  financialBoostWeight: number;
  topK: number;
  minFinalScore: number;
}

export const DEFAULT_RERANKER_PIPELINE_CONFIG: RerankerPipelineConfig = {
  crossEncoder: {},
  financialBoost: {},
  useCrossEncoder: true,
  useFinancialBoost: true,
  crossEncoderWeight: 0.6,
  financialBoostWeight: 0.4,
  topK: 20,
  minFinalScore: 0.1,
};

// ============================================================================
// INPUT / OUTPUT TYPES
// ============================================================================

export interface HybridSearchResult {
  id: string;
  content: string;
  score: number;
  denseScore?: number;
  sparseScore?: number;
  financialMetadata?: DocumentFinancialMetadata;
  metadata?: Record<string, unknown>;
}

export interface RerankedResult {
  id: string;
  content: string;
  finalScore: number;
  originalScore: number;
  crossEncoderScore?: number;
  financialBoostScore?: number;
  scoreBreakdown: ScoreBreakdown;
  rank: number;
  metadata?: Record<string, unknown>;
  financialMetadata?: DocumentFinancialMetadata;
}

export interface ScoreBreakdown {
  original: number;
  crossEncoder: number;
  financialBoost: number;
  merchantBoost: number;
  categoryBoost: number;
  recencyBoost: number;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface RerankerPipelineResult {
  results: RerankedResult[];
  totalTimeMs: number;
  crossEncoderDetails?: CrossEncoderResult;
  financialBoostDetails?: FinancialBoostResult;
  pipelineMetadata: PipelineMetadata;
}

export interface PipelineMetadata {
  inputCount: number;
  outputCount: number;
  stagesExecuted: string[];
  warnings: string[];
  configUsed: Partial<RerankerPipelineConfig>;
}
