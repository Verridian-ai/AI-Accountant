/**
 * LIKE-based Fallback Search
 *
 * Provides keyword search using SQL LIKE patterns when FTS5 is not available.
 */

import { db, ragChunks } from '../../../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../../../lib/logger.js';
import type { SparseSearchOptions, SparseSearchResult } from './sparse-search-types.js';

// ============================================================================
// LIKE SEARCH
// ============================================================================

/**
 * Escape special LIKE pattern characters to prevent injection
 */
export function escapeLikePattern(term: string): string {
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
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Fallback search using LIKE (when FTS5 is not available)
 */
export async function searchWithLike(
  userId: string,
  query: string,
  options: SparseSearchOptions,
): Promise<SparseSearchResult[]> {
  const { topK = 20, category, dateStart, dateEnd, accountId, namespaceId } = options;

  const conditions = [eq(ragChunks.userId, userId)];

  if (namespaceId) conditions.push(eq(ragChunks.namespaceId, namespaceId));
  if (category) conditions.push(eq(ragChunks.category, category));
  if (accountId) conditions.push(eq(ragChunks.accountId, accountId));
  if (dateStart) conditions.push(sql`${ragChunks.dateEnd} >= ${dateStart}`);
  if (dateEnd) conditions.push(sql`${ragChunks.dateStart} <= ${dateEnd}`);

  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (queryTerms.length > 0) {
    const likeConditions = queryTerms.map((term) => {
      const escapedTerm = escapeLikePattern(term);
      return sql`LOWER(${ragChunks.content}) LIKE ${'%' + escapedTerm + '%'} ESCAPE '\\'`;
    });
    conditions.push(sql`(${sql.join(likeConditions, sql` OR `)})`);
  }

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
    .limit(topK * 2);

  const scoredResults = chunks.map((chunk: any) => {
    const contentLower = chunk.content.toLowerCase();
    let score = 0;
    const matchedTerms: string[] = [];

    for (const term of queryTerms) {
      const escapedTerm = escapeRegex(term);
      try {
        const regex = new RegExp(escapedTerm, 'gi');
        const matches = (contentLower.match(regex) || []).length;
        if (matches > 0) {
          score += matches * (1 / Math.sqrt(chunk.content.length));
          matchedTerms.push(term);
        }
      } catch {
        logger.warn(`[SparseSearch] Invalid regex pattern for term: ${term}`);
      }
    }

    return { chunk, score, matchedTerms };
  });

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
