/**
 * Hybrid Search Engine
 *
 * Combines dense, sparse, and fused search into a single engine
 * with parallel execution and configurable weights.
 */

import { logger } from '../../../lib/logger.js';
import {
  DenseSearchEngine,
  denseSearchEngine,
  type DenseSearchOptions,
  type DenseSearchResult,
} from './dense-search.js';
import {
  SparseSearchEngine,
  sparseSearchEngine,
  ensureFTS5Table,
  rebuildFTS5Index,
  type SparseSearchOptions,
  type SparseSearchResult,
} from './sparse-search.js';
import { RRFFusionEngine, rrfFusionEngine, normalizeScores, type FusionConfig } from './fusion.js';
import type { HybridSearchOptions, HybridSearchResponse } from './hybrid-search-types.js';

// ============================================================================
// HYBRID SEARCH ENGINE CLASS
// ============================================================================

export class HybridSearchEngine {
  private denseEngine: DenseSearchEngine;
  private sparseEngine: SparseSearchEngine;
  private fusionEngine: RRFFusionEngine;
  private initialized: boolean = false;

  constructor(
    denseEngine?: DenseSearchEngine,
    sparseEngine?: SparseSearchEngine,
    fusionEngine?: RRFFusionEngine,
  ) {
    this.denseEngine = denseEngine || denseSearchEngine;
    this.sparseEngine = sparseEngine || sparseSearchEngine;
    this.fusionEngine = fusionEngine || rrfFusionEngine;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    logger.info('[HybridSearch] Initializing search system...');
    await ensureFTS5Table();
    this.initialized = true;
    logger.info('[HybridSearch] Search system initialized');
  }

  async search(
    userId: string,
    query: string,
    options: HybridSearchOptions = {},
  ): Promise<HybridSearchResponse> {
    const startTime = Date.now();
    if (!this.initialized) await this.initialize();

    const {
      topK = 20,
      minScore = 0.0,
      category,
      dateStart,
      dateEnd,
      accountId,
      namespaceId,
      denseWeight = 0.6,
      sparseWeight = 0.4,
      k = 60,
      minDenseSimilarity = 0.0,
      minSparseScore = 0.0,
      phraseMatch = false,
      expandQuery = false,
      retrieveTopK = 50,
      normalizeScores: shouldNormalize = false,
    } = options;

    logger.info(`[HybridSearch] Searching for user ${userId}: "${query.slice(0, 50)}..."`);
    const filterOptions = { category, dateStart, dateEnd, accountId, namespaceId };

    let denseSearchTimeMs = 0;
    let sparseSearchTimeMs = 0;

    const [denseResults, sparseResults] = await Promise.all([
      (async () => {
        const start = Date.now();
        const r = await this.runDenseSearch(userId, query, {
          ...filterOptions,
          topK: retrieveTopK,
          minSimilarity: minDenseSimilarity,
        });
        denseSearchTimeMs = Date.now() - start;
        return r;
      })(),
      (async () => {
        const start = Date.now();
        const r = await this.runSparseSearch(userId, query, {
          ...filterOptions,
          topK: retrieveTopK,
          minScore: minSparseScore,
          phraseMatch,
          expandQuery,
        });
        sparseSearchTimeMs = Date.now() - start;
        return r;
      })(),
    ]);

    const fusionStartTime = Date.now();
    let fusedResults = this.fusionEngine.fuse(denseResults, sparseResults, {
      k,
      denseWeight,
      sparseWeight,
      minScore,
      topK,
    });
    if (shouldNormalize)
      fusedResults = normalizeScores(fusedResults, { k, denseWeight, sparseWeight });
    const fusionTimeMs = Date.now() - fusionStartTime;
    const totalTimeMs = Date.now() - startTime;

    const fusionStats = this.fusionEngine.getFusionStats(fusedResults);
    logger.info(`[HybridSearch] Complete in ${totalTimeMs}ms: ${fusedResults.length} results`);

    return {
      results: fusedResults,
      query: { text: query, userId, options },
      stats: {
        denseResultCount: denseResults.length,
        sparseResultCount: sparseResults.length,
        fusedResultCount: fusedResults.length,
        denseSearchTimeMs,
        sparseSearchTimeMs,
        fusionTimeMs,
        totalTimeMs,
        fusionStats: {
          inBothRetrievers: fusionStats.inBothRetrievers,
          denseOnlyCount: fusionStats.denseOnlyCount,
          sparseOnlyCount: fusionStats.sparseOnlyCount,
          avgFusedScore: fusionStats.avgFusedScore,
        },
      },
    };
  }

  private async runDenseSearch(
    userId: string,
    query: string,
    options: DenseSearchOptions,
  ): Promise<DenseSearchResult[]> {
    try {
      const queryEmbedding = await this.denseEngine.generateQueryEmbedding(query);
      return await this.denseEngine.search(userId, queryEmbedding, options);
    } catch (error) {
      logger.error({ err: error }, '[HybridSearch] Dense search failed:');
      return [];
    }
  }

  private async runSparseSearch(
    userId: string,
    query: string,
    options: SparseSearchOptions & { expandQuery?: boolean },
  ): Promise<SparseSearchResult[]> {
    try {
      if (options.expandQuery)
        return await this.sparseEngine.searchExpanded(userId, query, options);
      return await this.sparseEngine.search(userId, query, options);
    } catch (error) {
      logger.error({ err: error }, '[HybridSearch] Sparse search failed:');
      return [];
    }
  }

  async semanticSearch(
    userId: string,
    query: string,
    options: DenseSearchOptions = {},
  ): Promise<DenseSearchResult[]> {
    if (!this.initialized) await this.initialize();
    const queryEmbedding = await this.denseEngine.generateQueryEmbedding(query);
    return this.denseEngine.search(userId, queryEmbedding, options);
  }

  async keywordSearch(
    userId: string,
    query: string,
    options: SparseSearchOptions = {},
  ): Promise<SparseSearchResult[]> {
    if (!this.initialized) await this.initialize();
    return this.sparseEngine.search(userId, query, options);
  }

  async searchWithWeights(
    userId: string,
    query: string,
    denseWeight: number,
    sparseWeight: number,
    options: Omit<HybridSearchOptions, 'denseWeight' | 'sparseWeight'> = {},
  ): Promise<HybridSearchResponse> {
    return this.search(userId, query, { ...options, denseWeight, sparseWeight });
  }

  async searchFinancial(
    userId: string,
    query: string,
    options: HybridSearchOptions = {},
  ): Promise<HybridSearchResponse> {
    return this.search(userId, query, {
      denseWeight: 0.5,
      sparseWeight: 0.5,
      expandQuery: true,
      ...options,
    });
  }

  updateFusionConfig(config: Partial<FusionConfig>): void {
    this.fusionEngine.updateConfig(config);
  }

  getConfig(): { fusion: FusionConfig; embeddingModel: string; embeddingDimensions: number } {
    return {
      fusion: this.fusionEngine.getConfig(),
      embeddingModel: this.denseEngine.getEmbeddingModel(),
      embeddingDimensions: this.denseEngine.getEmbeddingDimensions(),
    };
  }

  async rebuildIndex(): Promise<void> {
    await rebuildFTS5Index();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const hybridSearchEngine = new HybridSearchEngine();
