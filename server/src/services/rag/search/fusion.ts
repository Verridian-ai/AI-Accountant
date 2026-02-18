/**
 * Reciprocal Rank Fusion (RRF) Module
 *
 * Combines results from dense and sparse search using RRF algorithm.
 * RRF is a simple but effective fusion method that doesn't require
 * score normalization between different retrieval methods.
 *
 * Formula: RRF(d) = SUM(weight / (k + rank))
 * where k=60 is a constant to prevent high-ranked documents from dominating.
 */

import type { DenseSearchResult } from './dense-search.js';
import type { SparseSearchResult } from './sparse-search.js';
import type { FusionConfig, FusedSearchResult } from './fusion-types.js';
import { DEFAULT_FUSION_CONFIG } from './fusion-types.js';

export type { FusionConfig, FusedSearchResult };
export { DEFAULT_FUSION_CONFIG };

// ============================================================================
// RRF FUSION ENGINE
// ============================================================================

export class RRFFusionEngine {
  private config: Required<FusionConfig>;

  constructor(config: FusionConfig = {}) {
    this.config = { ...DEFAULT_FUSION_CONFIG, ...config };
  }

  /**
   * Calculate RRF score for a single result
   */
  private calculateRRFScore(rank: number | null, weight: number): number {
    if (rank === null || rank <= 0) {
      return 0;
    }
    return weight / (this.config.k + rank);
  }

  /**
   * Fuse dense and sparse search results using RRF
   */
  fuse(
    denseResults: DenseSearchResult[],
    sparseResults: SparseSearchResult[],
    config?: FusionConfig,
  ): FusedSearchResult[] {
    const mergedConfig = { ...this.config, ...config };
    const { k, denseWeight, sparseWeight, minScore, topK } = mergedConfig;

    console.log(
      `[RRF] Fusing ${denseResults.length} dense + ${sparseResults.length} sparse results`,
    );
    console.log(`[RRF] Config: k=${k}, denseWeight=${denseWeight}, sparseWeight=${sparseWeight}`);

    // Create a map of all unique chunks
    const chunkMap = new Map<string, FusedSearchResult>();

    // Process dense results
    for (const result of denseResults) {
      const rrfScore = this.calculateRRFScore(result.rank, denseWeight);

      if (!chunkMap.has(result.chunkId)) {
        chunkMap.set(result.chunkId, {
          chunkId: result.chunkId,
          documentId: result.documentId,
          content: result.content,
          fusedScore: rrfScore,
          fusedRank: 0, // Will be set after sorting
          scores: {
            denseSimilarity: result.similarity,
            denseRank: result.rank,
            sparseBm25: null,
            sparseRank: null,
            denseRRF: rrfScore,
            sparseRRF: 0,
          },
          sources: {
            inDense: true,
            inSparse: false,
          },
          metadata: result.metadata,
          matchedTerms: [],
        });
      } else {
        // Update existing entry (shouldn't happen in normal use)
        const existing = chunkMap.get(result.chunkId)!;
        existing.scores.denseSimilarity = result.similarity;
        existing.scores.denseRank = result.rank;
        existing.scores.denseRRF = rrfScore;
        existing.fusedScore += rrfScore;
        existing.sources.inDense = true;
      }
    }

    // Process sparse results
    for (const result of sparseResults) {
      const rrfScore = this.calculateRRFScore(result.rank, sparseWeight);

      if (!chunkMap.has(result.chunkId)) {
        chunkMap.set(result.chunkId, {
          chunkId: result.chunkId,
          documentId: result.documentId,
          content: result.content,
          fusedScore: rrfScore,
          fusedRank: 0, // Will be set after sorting
          scores: {
            denseSimilarity: null,
            denseRank: null,
            sparseBm25: result.bm25Score,
            sparseRank: result.rank,
            denseRRF: 0,
            sparseRRF: rrfScore,
          },
          sources: {
            inDense: false,
            inSparse: true,
          },
          metadata: result.metadata,
          matchedTerms: result.matchedTerms,
        });
      } else {
        // Update existing entry from dense search
        const existing = chunkMap.get(result.chunkId)!;
        existing.scores.sparseBm25 = result.bm25Score;
        existing.scores.sparseRank = result.rank;
        existing.scores.sparseRRF = rrfScore;
        existing.fusedScore += rrfScore;
        existing.sources.inSparse = true;
        existing.matchedTerms = result.matchedTerms;
      }
    }

    // Convert to array and sort by fused score
    let fusedResults = Array.from(chunkMap.values());
    fusedResults.sort((a, b) => b.fusedScore - a.fusedScore);

    // Filter by minimum score
    if (minScore > 0) {
      fusedResults = fusedResults.filter((r) => r.fusedScore >= minScore);
    }

    // Take top K results
    fusedResults = fusedResults.slice(0, topK);

    // Assign fused ranks
    fusedResults.forEach((result, index) => {
      result.fusedRank = index + 1;
    });

    // Log fusion statistics
    const inBoth = fusedResults.filter((r) => r.sources.inDense && r.sources.inSparse).length;
    const denseOnly = fusedResults.filter((r) => r.sources.inDense && !r.sources.inSparse).length;
    const sparseOnly = fusedResults.filter((r) => !r.sources.inDense && r.sources.inSparse).length;

    console.log(
      `[RRF] Final: ${fusedResults.length} results (${inBoth} in both, ${denseOnly} dense-only, ${sparseOnly} sparse-only)`,
    );

    return fusedResults;
  }

  /**
   * Fuse with custom weights (useful for A/B testing or user preferences)
   */
  fuseWithWeights(
    denseResults: DenseSearchResult[],
    sparseResults: SparseSearchResult[],
    denseWeight: number,
    sparseWeight: number,
  ): FusedSearchResult[] {
    // Normalize weights to sum to 1
    const totalWeight = denseWeight + sparseWeight;
    const normalizedDense = denseWeight / totalWeight;
    const normalizedSparse = sparseWeight / totalWeight;

    return this.fuse(denseResults, sparseResults, {
      denseWeight: normalizedDense,
      sparseWeight: normalizedSparse,
    });
  }

  /**
   * Update fusion configuration
   */
  updateConfig(config: Partial<FusionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<FusionConfig> {
    return { ...this.config };
  }

  /**
   * Calculate fusion statistics for analysis
   */
  getFusionStats(fusedResults: FusedSearchResult[]): {
    total: number;
    inBothRetrievers: number;
    denseOnlyCount: number;
    sparseOnlyCount: number;
    avgFusedScore: number;
    avgDenseRRF: number;
    avgSparseRRF: number;
    topSourceDistribution: { both: number; denseOnly: number; sparseOnly: number };
  } {
    const inBoth = fusedResults.filter((r) => r.sources.inDense && r.sources.inSparse);
    const denseOnly = fusedResults.filter((r) => r.sources.inDense && !r.sources.inSparse);
    const sparseOnly = fusedResults.filter((r) => !r.sources.inDense && r.sources.inSparse);

    const avgFusedScore =
      fusedResults.reduce((sum, r) => sum + r.fusedScore, 0) / (fusedResults.length || 1);
    const avgDenseRRF =
      fusedResults.reduce((sum, r) => sum + r.scores.denseRRF, 0) / (fusedResults.length || 1);
    const avgSparseRRF =
      fusedResults.reduce((sum, r) => sum + r.scores.sparseRRF, 0) / (fusedResults.length || 1);

    // Top 5 source distribution
    const top5 = fusedResults.slice(0, 5);
    const topSourceDistribution = {
      both: top5.filter((r) => r.sources.inDense && r.sources.inSparse).length,
      denseOnly: top5.filter((r) => r.sources.inDense && !r.sources.inSparse).length,
      sparseOnly: top5.filter((r) => !r.sources.inDense && r.sources.inSparse).length,
    };

    return {
      total: fusedResults.length,
      inBothRetrievers: inBoth.length,
      denseOnlyCount: denseOnly.length,
      sparseOnlyCount: sparseOnly.length,
      avgFusedScore,
      avgDenseRRF,
      avgSparseRRF,
      topSourceDistribution,
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Simple RRF fusion without class instantiation
 */
export function rrfFuse(
  denseResults: DenseSearchResult[],
  sparseResults: SparseSearchResult[],
  config: FusionConfig = {},
): FusedSearchResult[] {
  const engine = new RRFFusionEngine(config);
  return engine.fuse(denseResults, sparseResults);
}

/**
 * Calculate the theoretical maximum RRF score
 * Useful for normalizing scores to 0-1 range
 */
export function calculateMaxRRFScore(
  k: number = 60,
  denseWeight: number = 0.6,
  sparseWeight: number = 0.4,
): number {
  // Maximum score when a document is ranked #1 in both retrievers
  return denseWeight / (k + 1) + sparseWeight / (k + 1);
}

/**
 * Normalize fused scores to 0-1 range
 */
export function normalizeScores(
  results: FusedSearchResult[],
  config: FusionConfig = {},
): FusedSearchResult[] {
  const { k = 60, denseWeight = 0.6, sparseWeight = 0.4 } = config;
  const maxScore = calculateMaxRRFScore(k, denseWeight, sparseWeight);

  return results.map((result) => ({
    ...result,
    fusedScore: result.fusedScore / maxScore,
    scores: {
      ...result.scores,
      denseRRF: result.scores.denseRRF / maxScore,
      sparseRRF: result.scores.sparseRRF / maxScore,
    },
  }));
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const rrfFusionEngine = new RRFFusionEngine();
