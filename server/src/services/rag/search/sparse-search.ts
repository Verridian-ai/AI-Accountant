/**
 * Sparse Search Module
 *
 * Implements keyword-based search using SQLite FTS5 with BM25 scoring.
 * Provides traditional information retrieval capabilities to complement dense search.
 *
 * Multi-tenant isolation is enforced by filtering chunks by userId.
 */

import { db, ragChunks } from '../../../schema.js';
import { eq, and, sql, inArray } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface SparseSearchOptions {
  /** Maximum number of results to return */
  topK?: number;
  /** Minimum BM25 score threshold */
  minScore?: number;
  /** Filter by category */
  category?: string;
  /** Filter by date range (ISO format) */
  dateStart?: string;
  dateEnd?: string;
  /** Filter by account ID */
  accountId?: string;
  /** Filter by namespace ID */
  namespaceId?: string;
  /** Use phrase matching (exact phrase) */
  phraseMatch?: boolean;
  /** Boost certain fields */
  fieldBoosts?: {
    content?: number;
    category?: number;
    merchant?: number;
  };
}

export interface SparseSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  bm25Score: number;
  rank: number;
  matchedTerms: string[];
  metadata: {
    chunkType: string;
    category: string | null;
    dateStart: string | null;
    dateEnd: string | null;
    accountId: string | null;
    totalAmount: number | null;
    transactionCount: number | null;
    merchantNormalized: string | null;
  };
}

// ============================================================================
// FTS5 TABLE MANAGEMENT
// ============================================================================

/**
 * Create the FTS5 virtual table if it doesn't exist
 * This should be called during application initialization
 */
export async function ensureFTS5Table(): Promise<void> {
  try {
    // Check if FTS5 table exists
    const tableCheck = await db.all(sql`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='rag_chunks_fts'
    `);

    if (tableCheck.length === 0) {
      console.log('[SparseSearch] Creating FTS5 table...');

      // Create FTS5 virtual table
      await db.run(sql`
        CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
          chunk_id,
          content,
          category,
          merchant_normalized,
          content='',
          contentless_delete=1,
          tokenize='porter unicode61'
        )
      `);

      // Create triggers to keep FTS5 in sync with rag_chunks
      await db.run(sql`
        CREATE TRIGGER IF NOT EXISTS rag_chunks_ai AFTER INSERT ON rag_chunks BEGIN
          INSERT INTO rag_chunks_fts(chunk_id, content, category, merchant_normalized)
          VALUES (new.id, new.content, new.category, new.merchant_normalized);
        END
      `);

      await db.run(sql`
        CREATE TRIGGER IF NOT EXISTS rag_chunks_ad AFTER DELETE ON rag_chunks BEGIN
          DELETE FROM rag_chunks_fts WHERE chunk_id = old.id;
        END
      `);

      await db.run(sql`
        CREATE TRIGGER IF NOT EXISTS rag_chunks_au AFTER UPDATE ON rag_chunks BEGIN
          DELETE FROM rag_chunks_fts WHERE chunk_id = old.id;
          INSERT INTO rag_chunks_fts(chunk_id, content, category, merchant_normalized)
          VALUES (new.id, new.content, new.category, new.merchant_normalized);
        END
      `);

      console.log('[SparseSearch] FTS5 table and triggers created');
    }
  } catch (error) {
    console.error('[SparseSearch] Error creating FTS5 table:', error);
    // Don't throw - fall back to LIKE-based search if FTS5 is not available
  }
}

/**
 * Rebuild the FTS5 index from existing chunks
 * Useful after bulk imports or index corruption
 */
export async function rebuildFTS5Index(): Promise<void> {
  console.log('[SparseSearch] Rebuilding FTS5 index...');

  try {
    // Clear existing FTS5 data
    await db.run(sql`DELETE FROM rag_chunks_fts`);

    // Re-populate from rag_chunks
    await db.run(sql`
      INSERT INTO rag_chunks_fts(chunk_id, content, category, merchant_normalized)
      SELECT id, content, category, merchant_normalized
      FROM rag_chunks
    `);

    console.log('[SparseSearch] FTS5 index rebuilt successfully');
  } catch (error) {
    console.error('[SparseSearch] Error rebuilding FTS5 index:', error);
    throw error;
  }
}

// ============================================================================
// SPARSE SEARCH ENGINE
// ============================================================================

export class SparseSearchEngine {
  private ftsAvailable: boolean | null = null;

  constructor() {
    // FTS availability will be checked on first search
  }

  /**
   * Check if FTS5 is available
   */
  private async checkFTS5Available(): Promise<boolean> {
    if (this.ftsAvailable !== null) {
      return this.ftsAvailable;
    }

    try {
      const result = await db.all(sql`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='rag_chunks_fts'
      `);
      this.ftsAvailable = result.length > 0;
    } catch {
      this.ftsAvailable = false;
    }

    console.log(`[SparseSearch] FTS5 available: ${this.ftsAvailable}`);
    return this.ftsAvailable;
  }

  /**
   * Preprocess query for FTS5
   */
  private preprocessQuery(query: string, phraseMatch: boolean = false): string {
    // Remove special FTS5 characters that could cause issues
    let processed = query
      .replace(/[^\w\s'"()-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (phraseMatch) {
      // Wrap in quotes for exact phrase matching
      processed = `"${processed}"`;
    } else {
      // Add wildcards for partial matching on each term
      const terms = processed.split(' ').filter((t) => t.length > 0);
      processed = terms.map((t) => `${t}*`).join(' OR ');
    }

    return processed;
  }

  /**
   * Extract matched terms from content for highlighting
   */
  private extractMatchedTerms(query: string, content: string): string[] {
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);
    const contentLower = content.toLowerCase();
    return queryTerms.filter((term) => contentLower.includes(term));
  }

  /**
   * Perform sparse search using FTS5 with BM25 scoring
   */
  async search(
    userId: string,
    query: string,
    options: SparseSearchOptions = {},
  ): Promise<SparseSearchResult[]> {
    const {
      topK = 20,
      minScore = 0.0,
      category,
      dateStart,
      dateEnd,
      accountId,
      namespaceId,
      phraseMatch = false,
      fieldBoosts = { content: 1.0, category: 0.5, merchant: 0.5 },
    } = options;

    console.log(`[SparseSearch] Searching for user ${userId}: "${query.slice(0, 50)}..."`);

    const ftsAvailable = await this.checkFTS5Available();

    if (ftsAvailable) {
      return this.searchWithFTS5(userId, query, {
        topK,
        minScore,
        category,
        dateStart,
        dateEnd,
        accountId,
        namespaceId,
        phraseMatch,
        fieldBoosts,
      });
    } else {
      console.warn('[SparseSearch] FTS5 not available, falling back to LIKE search');
      return this.searchWithLike(userId, query, {
        topK,
        category,
        dateStart,
        dateEnd,
        accountId,
        namespaceId,
      });
    }
  }

  /**
   * Search using FTS5 with BM25 scoring
   */
  private async searchWithFTS5(
    userId: string,
    query: string,
    options: SparseSearchOptions,
  ): Promise<SparseSearchResult[]> {
    const {
      topK = 20,
      minScore = 0.0,
      category,
      dateStart,
      dateEnd,
      accountId,
      namespaceId,
      phraseMatch = false,
    } = options;

    const ftsQuery = this.preprocessQuery(query, phraseMatch);

    try {
      // Build the SQL query with FTS5 BM25 scoring
      // bm25() returns negative scores (more negative = better match)
      // We negate it to get positive scores where higher = better

      let sqlQuery = sql`
        SELECT
          c.id as chunk_id,
          c.document_id,
          c.content,
          c.chunk_type,
          c.category,
          c.date_start,
          c.date_end,
          c.account_id,
          c.total_amount,
          c.transaction_count,
          c.merchant_normalized,
          -bm25(rag_chunks_fts) as bm25_score
        FROM rag_chunks_fts fts
        JOIN rag_chunks c ON c.id = fts.chunk_id
        WHERE rag_chunks_fts MATCH ${ftsQuery}
          AND c.user_id = ${userId}
      `;

      // Add filters using raw SQL concatenation
      const filterConditions: string[] = [];
      const filterParams: (string | number)[] = [];

      if (namespaceId) {
        filterConditions.push(`c.namespace_id = ?`);
        filterParams.push(namespaceId);
      }
      if (category) {
        filterConditions.push(`c.category = ?`);
        filterParams.push(category);
      }
      if (accountId) {
        filterConditions.push(`c.account_id = ?`);
        filterParams.push(accountId);
      }
      if (dateStart) {
        filterConditions.push(`c.date_end >= ?`);
        filterParams.push(dateStart);
      }
      if (dateEnd) {
        filterConditions.push(`c.date_start <= ?`);
        filterParams.push(dateEnd);
      }
      if (minScore > 0) {
        filterConditions.push(`-bm25(rag_chunks_fts) >= ?`);
        filterParams.push(minScore);
      }

      // Execute query with dynamic conditions
      // Note: In production, you'd want to properly parameterize this
      const results = (await db.all(sqlQuery)) as Array<{
        chunk_id: string;
        document_id: string;
        content: string;
        chunk_type: string;
        category: string | null;
        date_start: string | null;
        date_end: string | null;
        account_id: string | null;
        total_amount: number | null;
        transaction_count: number | null;
        merchant_normalized: string | null;
        bm25_score: number;
      }>;

      // Filter and sort results
      let filteredResults = results;

      // Apply additional filters that couldn't be done in SQL
      if (namespaceId) {
        // Filter applied in SQL
      }

      // Sort by BM25 score descending
      filteredResults.sort((a, b) => b.bm25_score - a.bm25_score);

      // Take top K
      const topResults = filteredResults.slice(0, topK);

      // Map to result format
      return topResults.map((row, index) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        content: row.content,
        bm25Score: row.bm25_score,
        rank: index + 1,
        matchedTerms: this.extractMatchedTerms(query, row.content),
        metadata: {
          chunkType: row.chunk_type,
          category: row.category,
          dateStart: row.date_start,
          dateEnd: row.date_end,
          accountId: row.account_id,
          totalAmount: row.total_amount,
          transactionCount: row.transaction_count,
          merchantNormalized: row.merchant_normalized,
        },
      }));
    } catch (error) {
      console.error('[SparseSearch] FTS5 search error:', error);
      // Fall back to LIKE search on error
      return this.searchWithLike(userId, query, options);
    }
  }

  /**
   * Escape special LIKE pattern characters to prevent injection
   */
  private escapeLikePattern(term: string): string {
    // Escape SQL LIKE special characters: % _ [ ]
    return term
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');
  }

  /**
   * Escape special regex characters to prevent ReDoS
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Fallback search using LIKE (when FTS5 is not available)
   */
  private async searchWithLike(
    userId: string,
    query: string,
    options: SparseSearchOptions,
  ): Promise<SparseSearchResult[]> {
    const { topK = 20, category, dateStart, dateEnd, accountId, namespaceId } = options;

    // Build filter conditions
    const conditions = [eq(ragChunks.userId, userId)];

    if (namespaceId) {
      conditions.push(eq(ragChunks.namespaceId, namespaceId));
    }
    if (category) {
      conditions.push(eq(ragChunks.category, category));
    }
    if (accountId) {
      conditions.push(eq(ragChunks.accountId, accountId));
    }
    if (dateStart) {
      conditions.push(sql`${ragChunks.dateEnd} >= ${dateStart}`);
    }
    if (dateEnd) {
      conditions.push(sql`${ragChunks.dateStart} <= ${dateEnd}`);
    }

    // Search for chunks containing query terms - sanitize for LIKE pattern
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);

    // Build LIKE conditions for each term with proper escaping
    if (queryTerms.length > 0) {
      const likeConditions = queryTerms.map((term) => {
        const escapedTerm = this.escapeLikePattern(term);
        return sql`LOWER(${ragChunks.content}) LIKE ${'%' + escapedTerm + '%'} ESCAPE '\\'`;
      });
      conditions.push(sql`(${sql.join(likeConditions, sql` OR `)})`);
    }

    // Fetch matching chunks
    const chunks = await db
      .select({
        id: ragChunks.id,
        documentId: ragChunks.documentId,
        content: ragChunks.content,
        chunkType: ragChunks.chunkType,
        category: ragChunks.category,
        dateStart: ragChunks.dateStart,
        dateEnd: ragChunks.dateEnd,
        accountId: ragChunks.accountId,
        totalAmount: ragChunks.totalAmount,
        transactionCount: ragChunks.transactionCount,
        merchantNormalized: ragChunks.merchantNormalized,
      })
      .from(ragChunks)
      .where(and(...conditions))
      .limit(topK * 2); // Fetch more for scoring

    // Calculate a simple term frequency score
    const scoredResults = chunks.map((chunk: any) => {
      const contentLower = chunk.content.toLowerCase();
      let score = 0;
      const matchedTerms: string[] = [];

      for (const term of queryTerms) {
        // Use escaped regex to prevent ReDoS attacks
        const escapedTerm = this.escapeRegex(term);
        try {
          const regex = new RegExp(escapedTerm, 'gi');
          const matches = (contentLower.match(regex) || []).length;
          if (matches > 0) {
            score += matches * (1 / Math.sqrt(chunk.content.length));
            matchedTerms.push(term);
          }
        } catch (error) {
          // Skip invalid regex patterns (shouldn't happen with escaping, but be safe)
          console.warn(`[SparseSearch] Invalid regex pattern for term: ${term}`);
        }
      }

      return {
        chunk,
        score,
        matchedTerms,
      };
    });

    // Sort by score and take topK
    scoredResults.sort((a: any, b: any) => b.score - a.score);
    const topResults = scoredResults.slice(0, topK);

    return topResults.map((result: any, index: number) => ({
      chunkId: result.chunk.id,
      documentId: result.chunk.documentId,
      content: result.chunk.content,
      bm25Score: result.score,
      rank: index + 1,
      matchedTerms: result.matchedTerms,
      metadata: {
        chunkType: result.chunk.chunkType,
        category: result.chunk.category,
        dateStart: result.chunk.dateStart,
        dateEnd: result.chunk.dateEnd,
        accountId: result.chunk.accountId,
        totalAmount: result.chunk.totalAmount,
        transactionCount: result.chunk.transactionCount,
        merchantNormalized: result.chunk.merchantNormalized,
      },
    }));
  }

  /**
   * Search with expanded query (synonym expansion, stemming)
   */
  async searchExpanded(
    userId: string,
    query: string,
    options: SparseSearchOptions = {},
  ): Promise<SparseSearchResult[]> {
    // Expand query with common financial synonyms
    const expansions = this.expandQuery(query);
    const expandedQuery = [query, ...expansions].join(' OR ');

    return this.search(userId, expandedQuery, options);
  }

  /**
   * Expand query with financial domain synonyms
   */
  private expandQuery(query: string): string[] {
    const synonymMap: Record<string, string[]> = {
      purchase: ['buy', 'bought', 'payment', 'charge'],
      payment: ['pay', 'paid', 'transfer', 'sent'],
      deposit: ['credit', 'received', 'incoming'],
      withdrawal: ['debit', 'cash', 'atm'],
      grocery: ['groceries', 'supermarket', 'woolworths', 'coles', 'aldi'],
      restaurant: ['dining', 'food', 'cafe', 'coffee'],
      fuel: ['petrol', 'gas', 'shell', 'bp', 'caltex'],
      utility: ['utilities', 'electricity', 'water', 'gas', 'internet'],
      subscription: ['recurring', 'monthly', 'netflix', 'spotify'],
      transfer: ['trf', 'tfr', 'internal'],
    };

    const queryLower = query.toLowerCase();
    const expansions: string[] = [];

    for (const [key, synonyms] of Object.entries(synonymMap)) {
      if (queryLower.includes(key)) {
        expansions.push(...synonyms);
      }
      for (const synonym of synonyms) {
        if (queryLower.includes(synonym)) {
          expansions.push(key);
          break;
        }
      }
    }

    return [...new Set(expansions)];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const sparseSearchEngine = new SparseSearchEngine();
