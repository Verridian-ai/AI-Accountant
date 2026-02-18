/**
 * Reranker Pipeline — Score Combination & Helpers
 *
 * Extracted score combination logic and financial-only reranking.
 */

import type { RerankOutput } from './cross-encoder.js';
import type { BoostOutput, FinancialContext, FinancialBoostResult } from './financial-boost.js';
import { FinancialBooster } from './financial-boost.js';
import type {
  RerankerPipelineConfig,
  HybridSearchResult,
  RerankedResult,
  RerankerPipelineResult,
} from './pipeline-types.js';

/**
 * Combine cross-encoder and financial boost scores into final results.
 */
export function combineScores(
  results: HybridSearchResult[],
  crossEncoderScores: Map<string, RerankOutput>,
  financialBoostScores: Map<string, BoostOutput>,
  config: RerankerPipelineConfig,
): RerankedResult[] {
  return results.map((r) => {
    const ceResult = crossEncoderScores.get(r.id);
    const fbResult = financialBoostScores.get(r.id);

    const normalizedOriginal = Math.min(Math.max(r.score, 0), 1);
    const ceScore = ceResult?.crossEncoderScore ?? normalizedOriginal;
    const fbBoost = fbResult?.totalBoost ?? 0;

    let finalScore: number;
    if (config.useCrossEncoder && config.useFinancialBoost) {
      finalScore = ceScore * config.crossEncoderWeight + fbBoost * config.financialBoostWeight;
    } else if (config.useCrossEncoder) {
      finalScore = ceScore;
    } else if (config.useFinancialBoost) {
      finalScore = normalizedOriginal + fbBoost * config.financialBoostWeight;
    } else {
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
      rank: 0,
      metadata: r.metadata,
      financialMetadata: r.financialMetadata,
    };
  });
}

/**
 * Rerank using only financial boost (no cross-encoder).
 */
export function rerankFinancialOnly(
  query: string,
  results: HybridSearchResult[],
  booster: FinancialBooster,
  config: RerankerPipelineConfig,
  context?: FinancialContext,
): RerankerPipelineResult {
  const startTime = Date.now();
  const stagesExecuted = ['financial-boost', 'filter-and-rank'];

  const financialContext = context ?? booster.extractContextFromQuery(query);
  const boostInput = results.map((r) => ({
    id: r.id,
    score: r.score,
    financialMetadata: r.financialMetadata,
  }));

  const boostDetails: FinancialBoostResult = booster.applyBoosts(boostInput, financialContext);

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
    .filter((r) => r.finalScore >= config.minFinalScore)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, config.topK);

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
      configUsed: { useCrossEncoder: false, useFinancialBoost: true, topK: config.topK },
    },
  };
}

/**
 * Build an empty pipeline result.
 */
export function buildEmptyResult(
  startTime: number,
  stagesExecuted: string[],
  warnings: string[],
  config: RerankerPipelineConfig,
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
        useCrossEncoder: config.useCrossEncoder,
        useFinancialBoost: config.useFinancialBoost,
        topK: config.topK,
      },
    },
  };
}
