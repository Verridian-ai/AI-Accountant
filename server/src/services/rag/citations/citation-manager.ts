/**
 * Citation Manager Class
 *
 * OOP wrapper around the citation system for backward compatibility.
 * Delegates to: citation-retrieval.ts, citation-feedback.ts,
 * verification.ts, formatter.ts, helpers.ts.
 */

import { db, ragCitations, ragChunks } from '../../../schema.js';
import { eq, inArray, sql } from 'drizzle-orm';
import crypto from 'crypto';

import type {
  SourceChunk,
  Citation,
  CitationWithSource,
  CreateCitationOptions,
  CreateCitationResult,
  FormattedCitation,
} from './types.js';
import { DEFAULT_CITATION_OPTIONS } from './types.js';
import { extractSnippet } from './helpers.js';
import { getCitationsForAnswer } from './citation-retrieval.js';
import { recordFeedback, getCitationStats } from './citation-feedback.js';
import { verifySourceExists, verifySourcesExist, getVerificationDetails } from './verification.js';
import { formatCitationsForDisplay } from './formatter.js';

export class CitationManager {
  // ========================================================================
  // CITATION CREATION (inline — handles db insert + in-memory state)
  // ========================================================================

  async createCitation(
    answerText: string,
    sourceChunks: SourceChunk[],
    userId: string,
    options?: CreateCitationOptions,
  ): Promise<CreateCitationResult> {
    const config = { ...DEFAULT_CITATION_OPTIONS, ...options };
    const now = new Date().toISOString();
    const answerId = crypto.randomUUID();

    const relevantChunks = sourceChunks
      .filter((chunk) => (chunk.relevanceScore ?? 0) >= config.minRelevanceScore)
      .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
      .slice(0, config.maxCitations);

    const citations: Citation[] = [];

    for (let position = 0; position < relevantChunks.length; position++) {
      const chunk = relevantChunks[position];
      let transactionId: string | null = null;
      let accountId: string | null = null;

      if (config.includeTransactionLinks && chunk.metadata) {
        transactionId = chunk.metadata.transactionId || null;
        accountId = chunk.metadata.accountId || null;
      }

      const snippet = extractSnippet(chunk.content, answerText);
      const citationId = crypto.randomUUID();

      try {
        await db.insert(ragCitations).values({
          id: citationId,
          queryId: answerId,
          userId,
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          relevanceScore: chunk.relevanceScore,
          rerankScore: chunk.rerankScore || null,
          position,
          excerptUsed: snippet,
          wasHelpful: null,
          createdAt: now,
        });

        citations.push({
          id: citationId,
          answerId,
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          transactionId,
          accountId,
          relevanceScore: chunk.relevanceScore,
          rerankScore: chunk.rerankScore || null,
          position,
          snippet,
          wasHelpful: null,
          createdAt: now,
        });
      } catch (error) {
        console.error(`Failed to create citation for chunk ${chunk.chunkId}:`, error);
      }
    }

    return {
      answerId,
      citations,
      totalSourceChunks: sourceChunks.length,
      citationsCreated: citations.length,
    };
  }

  // ========================================================================
  // DELEGATED METHODS
  // ========================================================================

  async getCitationsForAnswer(answerId: string): Promise<CitationWithSource[]> {
    return getCitationsForAnswer(answerId);
  }

  async verifySourceExists(chunkId: string): Promise<boolean> {
    return verifySourceExists(chunkId);
  }

  async verifySourcesExist(chunkIds: string[]): Promise<Map<string, boolean>> {
    return verifySourcesExist(chunkIds);
  }

  async getVerificationDetails(chunkId: string) {
    return getVerificationDetails(chunkId);
  }

  formatCitationsForDisplay(citations: CitationWithSource[]): FormattedCitation[] {
    return formatCitationsForDisplay(citations);
  }

  async recordFeedback(citationId: string, wasHelpful: boolean): Promise<void> {
    return recordFeedback(citationId, wasHelpful);
  }

  async getCitationStats(userId: string) {
    return getCitationStats(userId);
  }

  // ========================================================================
  // CLEANUP (inline — specific to the CitationManager's DB ownership)
  // ========================================================================

  async deleteCitationsForAnswer(answerId: string): Promise<void> {
    await db.delete(ragCitations).where(eq(ragCitations.queryId, answerId));
  }

  async cleanupOrphanedCitations(): Promise<number> {
    const orphanedCitations = await db
      .select({ id: ragCitations.id })
      .from(ragCitations)
      .leftJoin(ragChunks, eq(ragCitations.chunkId, ragChunks.id))
      .where(sql`${ragChunks.id} IS NULL`);

    if (orphanedCitations.length === 0) return 0;

    const orphanedIds = (orphanedCitations as Array<{ id: string }>).map((c) => c.id);
    await db.delete(ragCitations).where(inArray(ragCitations.id, orphanedIds));
    return orphanedIds.length;
  }
}

export const citationManager = new CitationManager();
