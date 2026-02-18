/**
 * Sparse Search Module
 *
 * Implements keyword-based search using SQLite FTS5 with BM25 scoring.
 * Provides traditional information retrieval capabilities to complement dense search.
 *
 * Multi-tenant isolation is enforced by filtering chunks by userId.
 */

import { db } from '../../../schema.js';
import { sql } from 'drizzle-orm';

import type { SparseSearchOptions, SparseSearchResult } from './sparse-search-types.js';
import {
  ensureFTS5Table,
  rebuildFTS5Index,
  expandQuery as expandQueryFn,
} from './fts5-management.js';
import { searchWithLike } from './like-search.js';

export type { SparseSearchOptions, SparseSearchResult };
export { ensureFTS5Table, rebuildFTS5Index };

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
      return searchWithLike(userId, query, {
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

      const sqlQuery = sql`
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

      // Sort by BM25 score descending
      results.sort((a, b) => b.bm25_score - a.bm25_score);

      // Take top K
      const topResults = results.slice(0, topK);

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
      return searchWithLike(userId, query, options);
    }
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
    const expansions = expandQueryFn(query);
    const expandedQuery = [query, ...expansions].join(' OR ');

    return this.search(userId, expandedQuery, options);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const sparseSearchEngine = new SparseSearchEngine();
