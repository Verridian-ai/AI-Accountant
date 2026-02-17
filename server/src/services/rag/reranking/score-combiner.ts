/**
 * Score Combiner
 *
 * Combines cross-encoder scores with financial boost scores
 * into final reranked results.
 */

import type { RerankOutput } from './cross-encoder.js';
import type { BoostOutput } from './financial-boost.js';
import type {
  RerankerPipelineConfig,
  HybridSearchResult,
  RerankedResult,
  RerankerPipelineResult,
} from './reranker-types.js';

// ============================================================================
// SCORE COMBINATION
// ============================================================================

/**
 * Combine cross-encoder and financial boost scores into final results
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
 * Create an empty pipeline result
 */
export function emptyPipelineResult(
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
