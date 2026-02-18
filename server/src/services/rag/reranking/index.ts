/**
 * Reranker Pipeline
 *
 * Orchestrates multi-stage reranking for hybrid search results.
 * Combines cross-encoder semantic reranking with financial domain boosting.
 */

import {
  CrossEncoderReranker,
  type RerankInput,
  type RerankOutput,
  type CrossEncoderResult,
} from './cross-encoder.js';
import {
  FinancialBooster,
  type FinancialContext,
  type FinancialBoostResult,
  type BoostOutput,
} from './financial-boost.js';
import type {
  RerankerPipelineConfig,
  HybridSearchResult,
  RerankerPipelineResult,
} from './pipeline-types.js';
import { DEFAULT_RERANKER_PIPELINE_CONFIG } from './pipeline-types.js';
import { combineScores, rerankFinancialOnly, buildEmptyResult } from './pipeline-combine.js';

// Re-export all pipeline types for consumers
export type {
  RerankerPipelineConfig,
  HybridSearchResult,
  RerankedResult,
  RerankerPipelineResult,
  ScoreBreakdown,
  PipelineMetadata,
} from './pipeline-types.js';
export { DEFAULT_RERANKER_PIPELINE_CONFIG } from './pipeline-types.js';

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

  async rerank(
    query: string,
    results: HybridSearchResult[],
    context?: FinancialContext,
  ): Promise<RerankerPipelineResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const stagesExecuted: string[] = [];

    if (results.length === 0) {
      return buildEmptyResult(startTime, stagesExecuted, warnings, this.config);
    }

    const financialContext = context ?? this.financialBooster.extractContextFromQuery(query);

    const crossEncoderScores = new Map<string, RerankOutput>();
    const financialBoostScores = new Map<string, BoostOutput>();
    let crossEncoderDetails: CrossEncoderResult | undefined;
    let financialBoostDetails: FinancialBoostResult | undefined;

    // Stage 1: Cross-encoder reranking
    if (this.config.useCrossEncoder) {
      stagesExecuted.push('cross-encoder');
      const ceInput: RerankInput[] = results.map((r) => ({
        id: r.id,
        content: r.content,
        originalScore: r.score,
        metadata: r.metadata,
      }));
      crossEncoderDetails = await this.crossEncoder.rerank(query, ceInput, this.config.topK * 2);
      warnings.push(...crossEncoderDetails.warnings);
      for (const result of crossEncoderDetails.results) crossEncoderScores.set(result.id, result);
    }

    // Stage 2: Financial domain boosting
    if (this.config.useFinancialBoost) {
      stagesExecuted.push('financial-boost');
      const boostInput = results.map((r) => {
        const ceScore = crossEncoderScores.get(r.id);
        return {
          id: r.id,
          score: ceScore?.crossEncoderScore ?? r.score,
          financialMetadata: r.financialMetadata,
        };
      });
      financialBoostDetails = this.financialBooster.applyBoosts(boostInput, financialContext);
      for (const result of financialBoostDetails.results)
        financialBoostScores.set(result.id, result);
    }

    // Stage 3: Combine scores
    stagesExecuted.push('score-combination');
    const combined = combineScores(results, crossEncoderScores, financialBoostScores, this.config);

    // Stage 4: Filter and rank
    stagesExecuted.push('filter-and-rank');
    const filtered = combined
      .filter((r) => r.finalScore >= this.config.minFinalScore)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, this.config.topK);
    filtered.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return {
      results: filtered,
      totalTimeMs: Date.now() - startTime,
      crossEncoderDetails,
      financialBoostDetails,
      pipelineMetadata: {
        inputCount: results.length,
        outputCount: filtered.length,
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

  async rerankSemanticOnly(
    query: string,
    results: HybridSearchResult[],
    topK?: number,
  ): Promise<RerankerPipelineResult> {
    const tempConfig: Partial<RerankerPipelineConfig> = {
      ...this.config,
      useFinancialBoost: false,
    };
    if (topK) tempConfig.topK = topK;
    return new RerankerPipeline(tempConfig).rerank(query, results);
  }

  rerankFinancialOnly(
    query: string,
    results: HybridSearchResult[],
    context?: FinancialContext,
  ): RerankerPipelineResult {
    return rerankFinancialOnly(query, results, this.financialBooster, this.config, context);
  }

  getConfig(): RerankerPipelineConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<RerankerPipelineConfig>): void {
    this.config = { ...this.config, ...updates };
    if (updates.crossEncoder) this.crossEncoder.updateConfig(updates.crossEncoder);
    if (updates.financialBoost) this.financialBooster.updateConfig(updates.financialBoost);
  }

  async checkCrossEncoderAvailability(): Promise<boolean> {
    return this.crossEncoder.checkLocalAvailability();
  }
}

// ============================================================================
// SINGLETON & RE-EXPORTS
// ============================================================================

export const rerankerPipeline = new RerankerPipeline();

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
