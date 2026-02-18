/**
 * Citation Feedback & Metrics
 *
 * Handles citation feedback recording and statistics.
 */

import { db, ragCitations, ragDocuments } from '../../../schema.js';
import { eq, sql } from 'drizzle-orm';

/**
 * Record user feedback for a citation
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
