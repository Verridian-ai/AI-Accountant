/**
 * Hybrid Search Engine
 *
 * Main entry point for the hybrid search system combining:
 * - Dense Search: FastEmbed (BAAI/bge-small-en-v1.5, 384 dims) for semantic similarity
 * - Sparse Search: SQLite FTS5 with BM25 scoring for keyword matching
 * - Fusion: Reciprocal Rank Fusion (RRF) to combine results
 *
 * Default configuration:
 * - RRF k constant: 60
 * - Dense weight: 0.6
 * - Sparse weight: 0.4
 *
 * Multi-tenant isolation is enforced by filtering all queries by userId.
 */

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

import {
  RRFFusionEngine,
  rrfFusionEngine,
  rrfFuse,
  normalizeScores,
  type FusionConfig,
  type FusedSearchResult,
  DEFAULT_FUSION_CONFIG,
} from './fusion.js';

// ============================================================================
// RE-EXPORTS
// ============================================================================

export {
  // Dense search
  DenseSearchEngine,
  denseSearchEngine,
  type DenseSearchOptions,
  type DenseSearchResult,
  // Sparse search
  SparseSearchEngine,
  sparseSearchEngine,
  ensureFTS5Table,
  rebuildFTS5Index,
  type SparseSearchOptions,
  type SparseSearchResult,
  // Fusion
  RRFFusionEngine,
  rrfFusionEngine,
  rrfFuse,
  normalizeScores,
  type FusionConfig,
  type FusedSearchResult,
  DEFAULT_FUSION_CONFIG,
};

// ============================================================================
// TYPES
// ============================================================================

export interface HybridSearchOptions {
  /** Maximum results to return */
  topK?: number;
  /** Minimum fused score threshold */
  minScore?: number;
  /** Filter by category */
  category?: string;
  /** Filter by date range start (ISO format) */
  dateStart?: string;
  /** Filter by date range end (ISO format) */
  dateEnd?: string;
  /** Filter by account ID */
  accountId?: string;
  /** Filter by namespace ID */
  namespaceId?: string;
  /** Dense search weight (0-1) */
  denseWeight?: number;
  /** Sparse search weight (0-1) */
  sparseWeight?: number;
  /** RRF k constant */
  k?: number;
  /** Minimum dense similarity threshold */
  minDenseSimilarity?: number;
  /** Minimum sparse BM25 score threshold */
  minSparseScore?: number;
  /** Use phrase matching for sparse search */
  phraseMatch?: boolean;
  /** Expand query with synonyms for sparse search */
  expandQuery?: boolean;
  /** Number of results to retrieve from each retriever before fusion */
  retrieveTopK?: number;
  /** Normalize final scores to 0-1 range */
  normalizeScores?: boolean;
}

export interface HybridSearchResponse {
  /** Search results after fusion */
  results: FusedSearchResult[];
  /** Query metadata */
  query: {
    text: string;
    userId: string;
    options: HybridSearchOptions;
  };
  /** Performance and diagnostic info */
  stats: {
    denseResultCount: number;
    sparseResultCount: number;
    fusedResultCount: number;
    denseSearchTimeMs: number;
    sparseSearchTimeMs: number;
    fusionTimeMs: number;
    totalTimeMs: number;
    fusionStats: {
      inBothRetrievers: number;
      denseOnlyCount: number;
      sparseOnlyCount: number;
      avgFusedScore: number;
    };
  };
}

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

  /**
   * Initialize the search system (create FTS5 table if needed)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[HybridSearch] Initializing search system...');

    // Ensure FTS5 table exists
    await ensureFTS5Table();

    this.initialized = true;
    console.log('[HybridSearch] Search system initialized');
  }

  /**
   * Perform hybrid search combining dense and sparse retrieval
   */
  async search(
    userId: string,
    query: string,
    options: HybridSearchOptions = {},
  ): Promise<HybridSearchResponse> {
    const startTime = Date.now();

    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

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

    console.log(`[HybridSearch] Searching for user ${userId}: "${query.slice(0, 50)}..."`);

    // Prepare filter options
    const filterOptions = {
      category,
      dateStart,
      dateEnd,
      accountId,
      namespaceId,
    };

    // Run dense and sparse searches in parallel with accurate timing

    // Wrap searches to capture individual timings
    let denseSearchTimeMs = 0;
    let sparseSearchTimeMs = 0;

    const denseSearchPromise = (async () => {
      const start = Date.now();
      const result = await this.runDenseSearch(userId, query, {
        ...filterOptions,
        topK: retrieveTopK,
        minSimilarity: minDenseSimilarity,
      });
      denseSearchTimeMs = Date.now() - start;
      return result;
    })();

    const sparseSearchPromise = (async () => {
      const start = Date.now();
      const result = await this.runSparseSearch(userId, query, {
        ...filterOptions,
        topK: retrieveTopK,
        minScore: minSparseScore,
        phraseMatch,
        expandQuery,
      });
      sparseSearchTimeMs = Date.now() - start;
      return result;
    })();

    const [denseResults, sparseResults] = await Promise.all([
      denseSearchPromise,
      sparseSearchPromise,
    ]);

    // Fuse results
    const fusionStartTime = Date.now();
    let fusedResults = this.fusionEngine.fuse(denseResults, sparseResults, {
      k,
      denseWeight,
      sparseWeight,
      minScore,
      topK,
    });

    // Optionally normalize scores
    if (shouldNormalize) {
      fusedResults = normalizeScores(fusedResults, { k, denseWeight, sparseWeight });
    }

    const fusionTimeMs = Date.now() - fusionStartTime;
    const totalTimeMs = Date.now() - startTime;

    // Get fusion statistics
    const fusionStats = this.fusionEngine.getFusionStats(fusedResults);

    console.log(`[HybridSearch] Complete in ${totalTimeMs}ms: ${fusedResults.length} results`);

    return {
      results: fusedResults,
      query: {
        text: query,
        userId,
        options,
      },
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

  /**
   * Run dense search with query embedding generation
   */
  private async runDenseSearch(
    userId: string,
    query: string,
    options: DenseSearchOptions,
  ): Promise<DenseSearchResult[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.denseEngine.generateQueryEmbedding(query);

      // Perform dense search
      return await this.denseEngine.search(userId, queryEmbedding, options);
    } catch (error) {
      console.error('[HybridSearch] Dense search failed:', error);
      return [];
    }
  }

  /**
   * Run sparse search with optional query expansion
   */
  private async runSparseSearch(
    userId: string,
    query: string,
    options: SparseSearchOptions & { expandQuery?: boolean },
  ): Promise<SparseSearchResult[]> {
    try {
      if (options.expandQuery) {
        return await this.sparseEngine.searchExpanded(userId, query, options);
      }
      return await this.sparseEngine.search(userId, query, options);
    } catch (error) {
      console.error('[HybridSearch] Sparse search failed:', error);
      return [];
    }
  }

  /**
   * Perform semantic-only search (dense search without sparse)
   */
  async semanticSearch(
    userId: string,
    query: string,
    options: DenseSearchOptions = {},
  ): Promise<DenseSearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const queryEmbedding = await this.denseEngine.generateQueryEmbedding(query);
    return this.denseEngine.search(userId, queryEmbedding, options);
  }

  /**
   * Perform keyword-only search (sparse search without dense)
   */
  async keywordSearch(
    userId: string,
    query: string,
    options: SparseSearchOptions = {},
  ): Promise<SparseSearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.sparseEngine.search(userId, query, options);
  }

  /**
   * Search with custom retriever weights
   */
  async searchWithWeights(
    userId: string,
    query: string,
    denseWeight: number,
    sparseWeight: number,
    options: Omit<HybridSearchOptions, 'denseWeight' | 'sparseWeight'> = {},
  ): Promise<HybridSearchResponse> {
    return this.search(userId, query, {
      ...options,
      denseWeight,
      sparseWeight,
    });
  }

  /**
   * Search optimized for financial queries
   * Uses domain-specific settings
   */
  async searchFinancial(
    userId: string,
    query: string,
    options: HybridSearchOptions = {},
  ): Promise<HybridSearchResponse> {
    // Financial queries often benefit from keyword matching
    // Adjust weights accordingly
    return this.search(userId, query, {
      denseWeight: 0.5,
      sparseWeight: 0.5,
      expandQuery: true,
      ...options,
    });
  }

  /**
   * Update fusion configuration
   */
  updateFusionConfig(config: Partial<FusionConfig>): void {
    this.fusionEngine.updateConfig(config);
  }

  /**
   * Get current configuration
   */
  getConfig(): {
    fusion: FusionConfig;
    embeddingModel: string;
    embeddingDimensions: number;
  } {
    return {
      fusion: this.fusionEngine.getConfig(),
      embeddingModel: this.denseEngine.getEmbeddingModel(),
      embeddingDimensions: this.denseEngine.getEmbeddingDimensions(),
    };
  }

  /**
   * Rebuild the FTS5 index (useful after bulk imports)
   */
  async rebuildIndex(): Promise<void> {
    await rebuildFTS5Index();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const hybridSearchEngine = new HybridSearchEngine();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick hybrid search using default settings
 */
export async function hybridSearch(
  userId: string,
  query: string,
  options: HybridSearchOptions = {},
): Promise<HybridSearchResponse> {
  return hybridSearchEngine.search(userId, query, options);
}

/**
 * Quick semantic search using default settings
 */
export async function semanticSearch(
  userId: string,
  query: string,
  options: DenseSearchOptions = {},
): Promise<DenseSearchResult[]> {
  return hybridSearchEngine.semanticSearch(userId, query, options);
}

/**
 * Quick keyword search using default settings
 */
export async function keywordSearch(
  userId: string,
  query: string,
  options: SparseSearchOptions = {},
): Promise<SparseSearchResult[]> {
  return hybridSearchEngine.keywordSearch(userId, query, options);
}

/**
 * Initialize the search system
 * Should be called during application startup
 */
export async function initializeSearch(): Promise<void> {
  await hybridSearchEngine.initialize();
}
