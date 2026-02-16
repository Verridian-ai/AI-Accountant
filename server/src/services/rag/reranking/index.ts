/**
 * Reranker Pipeline
 *
 * Orchestrates multi-stage reranking for hybrid search results.
 * Combines cross-encoder semantic reranking with financial domain boosting.
 */

import {
  CrossEncoderReranker,
  CrossEncoderConfig,
  RerankInput,
  RerankOutput,
  CrossEncoderResult,
} from './cross-encoder.js';
import {
  FinancialBooster,
  FinancialBoostConfig,
  FinancialContext,
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

// ============================================================================
// RERANKER PIPELINE CLASS
// ============================================================================

export class RerankerPipeline {
  private config: RerankerPipelineConfig;
  private crossEncoder: CrossEncoderReranker;
  private financialBooster: FinancialBooster;

  constructor(config?: Partial<RerankerPipelineConfig>) {
    this.config = { ...DEFAULT_RERANKER_PIPELINE_CONFIG, ...config };
    this.crossEncoder = new CrossEncoderReranker(this.config.crossEncoder);
    this.financialBooster = new FinancialBooster(this.config.financialBoost);
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Rerank hybrid search results using the full pipeline
   */
  async rerank(
    query: string,
    results: HybridSearchResult[],
    context?: FinancialContext,
  ): Promise<RerankerPipelineResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const stagesExecuted: string[] = [];

    if (results.length === 0) {
      return this.emptyResult(startTime, stagesExecuted, warnings);
    }

    // Extract financial context from query if not provided
    const financialContext = context ?? this.financialBooster.extractContextFromQuery(query);

    // Build intermediate score maps
    const crossEncoderScores = new Map<string, RerankOutput>();
    const financialBoostScores = new Map<string, BoostOutput>();

    let crossEncoderDetails: CrossEncoderResult | undefined;
    let financialBoostDetails: FinancialBoostResult | undefined;

    // Stage 1: Cross-encoder reranking
    if (this.config.useCrossEncoder) {
      stagesExecuted.push('cross-encoder');

      const crossEncoderInput: RerankInput[] = results.map((r) => ({
        id: r.id,
        content: r.content,
        originalScore: r.score,
        metadata: r.metadata,
      }));

      crossEncoderDetails = await this.crossEncoder.rerank(
        query,
        crossEncoderInput,
        this.config.topK * 2, // Get extra for filtering
      );

      warnings.push(...crossEncoderDetails.warnings);

      for (const result of crossEncoderDetails.results) {
        crossEncoderScores.set(result.id, result);
      }
    }

    // Stage 2: Financial domain boosting
    if (this.config.useFinancialBoost) {
      stagesExecuted.push('financial-boost');

      // Use cross-encoder scores if available, otherwise original scores
      const boostInput = results.map((r) => {
        const ceScore = crossEncoderScores.get(r.id);
        return {
          id: r.id,
          score: ceScore?.crossEncoderScore ?? r.score,
          financialMetadata: r.financialMetadata,
        };
      });

      financialBoostDetails = this.financialBooster.applyBoosts(boostInput, financialContext);

      for (const result of financialBoostDetails.results) {
        financialBoostScores.set(result.id, result);
      }
    }

    // Stage 3: Combine scores
    stagesExecuted.push('score-combination');
    const combinedResults = this.combineScores(results, crossEncoderScores, financialBoostScores);

    // Stage 4: Filter and sort
    stagesExecuted.push('filter-and-rank');
    const filteredResults = combinedResults
      .filter((r) => r.finalScore >= this.config.minFinalScore)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, this.config.topK);

    // Assign final ranks
    filteredResults.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return {
      results: filteredResults,
      totalTimeMs: Date.now() - startTime,
      crossEncoderDetails,
      financialBoostDetails,
      pipelineMetadata: {
        inputCount: results.length,
        outputCount: filteredResults.length,
        stagesExecuted,
        warnings,
        configUsed: {
          useCrossEncoder: this.config.useCrossEncoder,
          useFinancialBoost: this.config.useFinancialBoost,
          crossEncoderWeight: this.config.crossEncoderWeight,
          financialBoostWeight: this.config.financialBoostWeight,
          topK: this.config.topK,
        },
      },
    };
  }

  /**
   * Rerank with only cross-encoder (skip financial boost)
   */
  async rerankSemanticOnly(
    query: string,
    results: HybridSearchResult[],
    topK?: number,
  ): Promise<RerankerPipelineResult> {
    const tempConfig: Partial<RerankerPipelineConfig> = {
      ...this.config,
      useFinancialBoost: false,
    };
    if (topK) {
      tempConfig.topK = topK;
    }
    const tempPipeline = new RerankerPipeline(tempConfig);
    return tempPipeline.rerank(query, results);
  }

  /**
   * Rerank with only financial boost (skip cross-encoder)
   */
  rerankFinancialOnly(
    query: string,
    results: HybridSearchResult[],
    context?: FinancialContext,
  ): RerankerPipelineResult {
    const startTime = Date.now();
    const stagesExecuted = ['financial-boost', 'filter-and-rank'];

    const financialContext = context ?? this.financialBooster.extractContextFromQuery(query);

    const boostInput = results.map((r) => ({
      id: r.id,
      score: r.score,
      financialMetadata: r.financialMetadata,
    }));

    const boostDetails = this.financialBooster.applyBoosts(boostInput, financialContext);

    const combinedResults: RerankedResult[] = results.map((r) => {
      const boostResult = boostDetails.results.find((b) => b.id === r.id);

      return {
        id: r.id,
        content: r.content,
        finalScore: boostResult?.boostedScore ?? r.score,
        originalScore: r.score,
        financialBoostScore: boostResult?.totalBoost ?? 0,
        scoreBreakdown: {
          original: r.score,
          crossEncoder: 0,
          financialBoost: boostResult?.totalBoost ?? 0,
          merchantBoost: boostResult?.boostBreakdown.merchantBoost ?? 0,
          categoryBoost: boostResult?.boostBreakdown.categoryBoost ?? 0,
          recencyBoost: boostResult?.boostBreakdown.recencyBoost ?? 0,
        },
        rank: 0,
        metadata: r.metadata,
        financialMetadata: r.financialMetadata,
      };
    });

    const filteredResults = combinedResults
      .filter((r) => r.finalScore >= this.config.minFinalScore)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, this.config.topK);

    filteredResults.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return {
      results: filteredResults,
      totalTimeMs: Date.now() - startTime,
      financialBoostDetails: boostDetails,
      pipelineMetadata: {
        inputCount: results.length,
        outputCount: filteredResults.length,
        stagesExecuted,
        warnings: [],
        configUsed: {
          useCrossEncoder: false,
          useFinancialBoost: true,
          topK: this.config.topK,
        },
      },
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): RerankerPipelineConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<RerankerPipelineConfig>): void {
    this.config = { ...this.config, ...updates };

    if (updates.crossEncoder) {
      this.crossEncoder.updateConfig(updates.crossEncoder);
    }
    if (updates.financialBoost) {
      this.financialBooster.updateConfig(updates.financialBoost);
    }
  }

  /**
   * Check cross-encoder availability
   */
  async checkCrossEncoderAvailability(): Promise<boolean> {
    return this.crossEncoder.checkLocalAvailability();
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private combineScores(
    results: HybridSearchResult[],
    crossEncoderScores: Map<string, RerankOutput>,
    financialBoostScores: Map<string, BoostOutput>,
  ): RerankedResult[] {
    return results.map((r) => {
      const ceResult = crossEncoderScores.get(r.id);
      const fbResult = financialBoostScores.get(r.id);

      // Normalize original score to 0-1 range (assuming it's already in this range)
      const normalizedOriginal = Math.min(Math.max(r.score, 0), 1);

      // Get component scores
      const ceScore = ceResult?.crossEncoderScore ?? normalizedOriginal;
      const fbBoost = fbResult?.totalBoost ?? 0;

      // Calculate final score using weighted combination
      let finalScore: number;

      if (this.config.useCrossEncoder && this.config.useFinancialBoost) {
        // Both enabled: weighted average of cross-encoder score + financial boost
        const crossEncoderContribution = ceScore * this.config.crossEncoderWeight;
        const financialBoostContribution = fbBoost * this.config.financialBoostWeight;
        finalScore = crossEncoderContribution + financialBoostContribution;
      } else if (this.config.useCrossEncoder) {
        // Only cross-encoder
        finalScore = ceScore;
      } else if (this.config.useFinancialBoost) {
        // Only financial boost: apply boost to original score
        finalScore = normalizedOriginal + fbBoost * this.config.financialBoostWeight;
      } else {
        // Neither enabled: use original score
        finalScore = normalizedOriginal;
      }

      return {
        id: r.id,
        content: r.content,
        finalScore,
        originalScore: r.score,
        crossEncoderScore: ceScore,
        financialBoostScore: fbBoost,
        scoreBreakdown: {
          original: r.score,
          crossEncoder: ceResult?.crossEncoderScore ?? 0,
          financialBoost: fbResult?.totalBoost ?? 0,
          merchantBoost: fbResult?.boostBreakdown.merchantBoost ?? 0,
          categoryBoost: fbResult?.boostBreakdown.categoryBoost ?? 0,
          recencyBoost: fbResult?.boostBreakdown.recencyBoost ?? 0,
        },
        rank: 0, // Will be set after sorting
        metadata: r.metadata,
        financialMetadata: r.financialMetadata,
      };
    });
  }

  private emptyResult(
    startTime: number,
    stagesExecuted: string[],
    warnings: string[],
  ): RerankerPipelineResult {
    return {
      results: [],
      totalTimeMs: Date.now() - startTime,
      pipelineMetadata: {
        inputCount: 0,
        outputCount: 0,
        stagesExecuted,
        warnings,
        configUsed: {
          useCrossEncoder: this.config.useCrossEncoder,
          useFinancialBoost: this.config.useFinancialBoost,
          topK: this.config.topK,
        },
      },
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const rerankerPipeline = new RerankerPipeline();

// ============================================================================
// RE-EXPORTS
// ============================================================================

export {
  CrossEncoderReranker,
  CrossEncoderConfig,
  RerankInput,
  RerankOutput,
  CrossEncoderResult,
  crossEncoderReranker,
} from './cross-encoder.js';

export {
  FinancialBooster,
  FinancialBoostConfig,
  FinancialContext,
  DocumentFinancialMetadata,
  BoostOutput,
  FinancialBoostResult,
  financialBooster,
} from './financial-boost.js';
