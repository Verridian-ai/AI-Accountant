/**
 * Citation Linking and Resolution
 *
 * Handles feedback recording, citation statistics, and cleanup operations.
 */

import { db, ragCitations, ragChunks, ragDocuments } from '../../../schema.js';
import { eq, inArray, sql } from 'drizzle-orm';

// ============================================================================
// FEEDBACK & METRICS
// ============================================================================

/**
 * Record user feedback on citation helpfulness
 */
export async function recordFeedback(citationId: string, wasHelpful: boolean): Promise<void> {
  await db.update(ragCitations).set({ wasHelpful }).where(eq(ragCitations.id, citationId));
}

/**
 * Get citation statistics for a user
 */
export async function getCitationStats(userId: string): Promise<{
  totalCitations: number;
  helpfulCount: number;
  notHelpfulCount: number;
  pendingFeedback: number;
  averageRelevanceScore: number;
  citationsBySourceType: Record<string, number>;
}> {
  // Get basic counts
  const countResults = await db
    .select({
      total: sql<number>`COUNT(*)`,
      helpful: sql<number>`SUM(CASE WHEN ${ragCitations.wasHelpful} = 1 THEN 1 ELSE 0 END)`,
      notHelpful: sql<number>`SUM(CASE WHEN ${ragCitations.wasHelpful} = 0 THEN 1 ELSE 0 END)`,
      pending: sql<number>`SUM(CASE WHEN ${ragCitations.wasHelpful} IS NULL THEN 1 ELSE 0 END)`,
      avgRelevance: sql<number>`AVG(${ragCitations.relevanceScore})`,
    })
    .from(ragCitations)
    .where(eq(ragCitations.userId, userId));

  const stats = countResults[0];

  // Get citations by source type
  const sourceTypeResults = await db
    .select({
      sourceType: ragDocuments.sourceType,
      count: sql<number>`COUNT(*)`,
    })
    .from(ragCitations)
    .innerJoin(ragDocuments, eq(ragCitations.documentId, ragDocuments.id))
    .where(eq(ragCitations.userId, userId))
    .groupBy(ragDocuments.sourceType);

  const citationsBySourceType: Record<string, number> = {};
  for (const row of sourceTypeResults) {
    citationsBySourceType[row.sourceType] = row.count;
  }

  return {
    totalCitations: stats.total || 0,
    helpfulCount: stats.helpful || 0,
    notHelpfulCount: stats.notHelpful || 0,
    pendingFeedback: stats.pending || 0,
    averageRelevanceScore: stats.avgRelevance || 0,
    citationsBySourceType,
  };
}

// ============================================================================
// CLEANUP OPERATIONS
// ============================================================================

/**
 * Delete all citations for an answer
 */
export async function deleteCitationsForAnswer(answerId: string): Promise<void> {
  await db.delete(ragCitations).where(eq(ragCitations.queryId, answerId));
}

/**
 * Delete orphaned citations (citations with missing chunks)
 *
 * @returns Number of orphaned citations deleted
 */
export async function cleanupOrphanedCitations(): Promise<number> {
  // Find citations with missing chunks
  const orphanedCitations = await db
    .select({ id: ragCitations.id })
    .from(ragCitations)
    .leftJoin(ragChunks, eq(ragCitations.chunkId, ragChunks.id))
    .where(sql`${ragChunks.id} IS NULL`);

  if (orphanedCitations.length === 0) {
    return 0;
  }

  const orphanedIds = (orphanedCitations as Record<string, unknown>[]).map((c) => c.id as string);

  await db.delete(ragCitations).where(inArray(ragCitations.id, orphanedIds));

  return orphanedIds.length;
}
