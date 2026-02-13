/**
 * Citation Manager
 *
 * Tracks source references for AI-generated answers in the RAG system.
 * Links to original transactions in the database and provides verifiable
 * sources for financial insights.
 */

import {
  db,
  ragCitations,
  ragChunks,
  ragDocuments,
  transactions,
  accounts,
} from '../../../schema.js';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Represents a source chunk used for RAG retrieval
 */
export interface SourceChunk {
  chunkId: string;
  documentId: string;
  content: string;
  relevanceScore: number;
  rerankScore?: number;
  metadata?: ChunkMetadata;
}

/**
 * Metadata associated with a chunk
 */
export interface ChunkMetadata {
  transactionId?: string;
  accountId?: string;
  dateStart?: string;
  dateEnd?: string;
  category?: string;
  merchantNormalized?: string;
  totalAmount?: number;
  transactionCount?: number;
}

/**
 * A citation record linking an answer to its sources
 */
export interface Citation {
  id: string;
  answerId: string;
  chunkId: string;
  documentId: string;
  transactionId: string | null;
  accountId: string | null;
  relevanceScore: number | null;
  rerankScore: number | null;
  position: number;
  snippet: string;
  wasHelpful: boolean | null;
  createdAt: string;
}

/**
 * Detailed citation with source information for display
 */
export interface CitationWithSource extends Citation {
  sourceType: string;
  sourceTitle: string | null;
  chunkContent: string;
  transactionDetails?: TransactionDetails | null;
  accountDetails?: AccountDetails | null;
}

/**
 * Transaction details for citation display
 */
export interface TransactionDetails {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  balance: number | null;
}

/**
 * Account details for citation display
 */
export interface AccountDetails {
  id: string;
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  accountType: string;
}

/**
 * Formatted citation for UI display
 */
export interface FormattedCitation {
  id: string;
  position: number;
  snippet: string;
  source: {
    type: 'transaction' | 'account' | 'statement' | 'manual';
    title: string;
    date?: string;
    amount?: string;
    category?: string;
    account?: string;
  };
  relevance: {
    score: number;
    label: 'high' | 'medium' | 'low';
  };
  verifiable: boolean;
  deepLink?: string;
}

/**
 * Options for creating citations
 */
export interface CreateCitationOptions {
  maxCitations?: number;
  minRelevanceScore?: number;
  includeTransactionLinks?: boolean;
}

/**
 * Result of citation creation
 */
export interface CreateCitationResult {
  answerId: string;
  citations: Citation[];
  totalSourceChunks: number;
  citationsCreated: number;
}

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class CitationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'CitationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class SourceNotFoundError extends CitationError {
  constructor(chunkId: string) {
    super(`Source chunk not found: ${chunkId}`, 'SOURCE_NOT_FOUND', { chunkId });
    this.name = 'SourceNotFoundError';
  }
}

export class AnswerNotFoundError extends CitationError {
  constructor(answerId: string) {
    super(`Answer not found: ${answerId}`, 'ANSWER_NOT_FOUND', { answerId });
    this.name = 'AnswerNotFoundError';
  }
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_OPTIONS: Required<CreateCitationOptions> = {
  maxCitations: 10,
  minRelevanceScore: 0.3,
  includeTransactionLinks: true,
};

// ============================================================================
// CITATION MANAGER CLASS
// ============================================================================

export class CitationManager {
  // ========================================================================
  // CITATION CREATION
  // ========================================================================

  /**
   * Create citation records for an AI-generated answer
   *
   * @param answerText - The AI-generated answer text (used to extract snippets)
   * @param sourceChunks - The source chunks used to generate the answer
   * @param userId - The user ID for authorization
   * @param options - Optional configuration
   * @returns The created citations and metadata
   */
  async createCitation(
    answerText: string,
    sourceChunks: SourceChunk[],
    userId: string,
    options?: CreateCitationOptions,
  ): Promise<CreateCitationResult> {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const now = new Date().toISOString();
    const answerId = crypto.randomUUID();

    // Filter chunks by relevance threshold
    const relevantChunks = sourceChunks
      .filter((chunk) => (chunk.relevanceScore ?? 0) >= config.minRelevanceScore)
      .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
      .slice(0, config.maxCitations);

    const citations: Citation[] = [];

    for (let position = 0; position < relevantChunks.length; position++) {
      const chunk = relevantChunks[position];

      // Extract relevant metadata for transaction/account linking
      let transactionId: string | null = null;
      let accountId: string | null = null;

      if (config.includeTransactionLinks && chunk.metadata) {
        transactionId = chunk.metadata.transactionId || null;
        accountId = chunk.metadata.accountId || null;
      }

      // Generate snippet from chunk content
      const snippet = this.extractSnippet(chunk.content, answerText);

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
        // Continue with other citations
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
  // CITATION RETRIEVAL
  // ========================================================================

  /**
   * Safely parse JSON metadata with error handling
   */
  private safeParseMetadata(metadataStr: string | null): ChunkMetadata {
    if (!metadataStr) return {};
    try {
      return JSON.parse(metadataStr) as ChunkMetadata;
    } catch (error) {
      console.warn('[CitationManager] Failed to parse chunk metadata:', error);
      return {};
    }
  }

  /**
   * Retrieve all citations for a given answer
   *
   * @param answerId - The answer/query ID
   * @returns Array of citations with source details
   */
  async getCitationsForAnswer(answerId: string): Promise<CitationWithSource[]> {
    const citationRecords = await db
      .select({
        id: ragCitations.id,
        queryId: ragCitations.queryId,
        chunkId: ragCitations.chunkId,
        documentId: ragCitations.documentId,
        relevanceScore: ragCitations.relevanceScore,
        rerankScore: ragCitations.rerankScore,
        position: ragCitations.position,
        excerptUsed: ragCitations.excerptUsed,
        wasHelpful: ragCitations.wasHelpful,
        createdAt: ragCitations.createdAt,
      })
      .from(ragCitations)
      .where(eq(ragCitations.queryId, answerId))
      .orderBy(ragCitations.position);

    if (citationRecords.length === 0) {
      return [];
    }

    // Fetch chunk and document details
    const chunkIds = citationRecords.map((c: any) => c.chunkId);
    const documentIds = [...new Set(citationRecords.map((c: any) => c.documentId))] as string[];

    const [chunks, documents] = await Promise.all([
      db.select().from(ragChunks).where(inArray(ragChunks.id, chunkIds)),
      db.select().from(ragDocuments).where(inArray(ragDocuments.id, documentIds)),
    ]);

    const chunkMap = new Map(chunks.map((c: any) => [c.id, c]));
    const documentMap = new Map(documents.map((d: any) => [d.id, d]));

    // Collect all transaction and account IDs to batch fetch (fixes N+1 query problem)
    const transactionIds = new Set<string>();
    const accountIds = new Set<string>();

    const metadataMap = new Map<string, ChunkMetadata>();
    for (const chunk of chunks) {
      const metadata = this.safeParseMetadata(chunk.metadata);
      metadataMap.set(chunk.id, metadata);

      if (metadata.transactionId) transactionIds.add(metadata.transactionId);
      if (metadata.accountId) accountIds.add(metadata.accountId);
    }

    // Batch fetch transactions and accounts
    const [transactionResults, accountResults] = await Promise.all([
      transactionIds.size > 0
        ? db
            .select({
              id: transactions.id,
              date: transactions.date,
              description: transactions.description,
              amount: transactions.amount,
              category: transactions.category,
              balance: transactions.balance,
            })
            .from(transactions)
            .where(inArray(transactions.id, Array.from(transactionIds)))
        : Promise.resolve([]),
      accountIds.size > 0
        ? db
            .select({
              id: accounts.id,
              accountName: accounts.accountName,
              accountNumber: accounts.accountNumber,
              bankName: accounts.bankName,
              accountType: accounts.accountType,
            })
            .from(accounts)
            .where(inArray(accounts.id, Array.from(accountIds)))
        : Promise.resolve([]),
    ]);

    const transactionMap = new Map(transactionResults.map((t: any) => [t.id, t]));
    const accountMap = new Map(accountResults.map((a: any) => [a.id, a]));

    // Build enriched citations
    const enrichedCitations: CitationWithSource[] = [];

    for (const citation of citationRecords) {
      const chunk = chunkMap.get(citation.chunkId);
      const document = documentMap.get(citation.documentId);

      if (!chunk || !document) continue;

      const chunkAny = chunk as any;
      const documentAny = document as any;
      const metadata = metadataMap.get(chunkAny.id) || {};

      // Get transaction and account details from pre-fetched maps
      const transactionDetails: TransactionDetails | null = metadata.transactionId
        ? (transactionMap.get(metadata.transactionId) as TransactionDetails) || null
        : null;
      const accountDetails: AccountDetails | null = metadata.accountId
        ? (accountMap.get(metadata.accountId) as AccountDetails) || null
        : null;

      enrichedCitations.push({
        id: citation.id,
        answerId: citation.queryId,
        chunkId: citation.chunkId,
        documentId: citation.documentId,
        transactionId: metadata.transactionId || null,
        accountId: metadata.accountId || null,
        relevanceScore: citation.relevanceScore,
        rerankScore: citation.rerankScore,
        position: citation.position,
        snippet: citation.excerptUsed || '',
        wasHelpful: citation.wasHelpful,
        createdAt: citation.createdAt,
        sourceType: documentAny.sourceType,
        sourceTitle: documentAny.title,
        chunkContent: chunkAny.content,
        transactionDetails,
        accountDetails,
      });
    }

    return enrichedCitations;
  }

  // ========================================================================
  // SOURCE VERIFICATION
  // ========================================================================

  /**
   * Verify that a source chunk still exists and is valid
   *
   * @param chunkId - The chunk ID to verify
   * @returns True if the source exists and is valid
   */
  async verifySourceExists(chunkId: string): Promise<boolean> {
    const result = await db
      .select({ id: ragChunks.id })
      .from(ragChunks)
      .where(eq(ragChunks.id, chunkId))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Verify multiple source chunks exist
   *
   * @param chunkIds - Array of chunk IDs to verify
   * @returns Map of chunk ID to existence status
   */
  async verifySourcesExist(chunkIds: string[]): Promise<Map<string, boolean>> {
    if (chunkIds.length === 0) {
      return new Map();
    }

    const results = await db
      .select({ id: ragChunks.id })
      .from(ragChunks)
      .where(inArray(ragChunks.id, chunkIds));

    const existingIds = new Set(results.map((r: any) => r.id));
    const statusMap = new Map<string, boolean>();

    for (const id of chunkIds) {
      statusMap.set(id, existingIds.has(id));
    }

    return statusMap;
  }

  /**
   * Get detailed verification info for a chunk
   *
   * @param chunkId - The chunk ID to verify
   * @returns Verification details or null if not found
   */
  async getVerificationDetails(chunkId: string): Promise<{
    exists: boolean;
    chunk?: typeof ragChunks.$inferSelect;
    document?: typeof ragDocuments.$inferSelect;
    linkedTransaction?: TransactionDetails | null;
  } | null> {
    const chunkResult = await db.select().from(ragChunks).where(eq(ragChunks.id, chunkId)).limit(1);

    if (chunkResult.length === 0) {
      return { exists: false };
    }

    const chunk = chunkResult[0];

    // Parse metadata safely
    const metadata = this.safeParseMetadata(chunk.metadata);

    // Batch fetch document and transaction in parallel
    const [documentResult, transactionResult] = await Promise.all([
      db.select().from(ragDocuments).where(eq(ragDocuments.id, chunk.documentId)).limit(1),
      metadata.transactionId
        ? db
            .select({
              id: transactions.id,
              date: transactions.date,
              description: transactions.description,
              amount: transactions.amount,
              category: transactions.category,
              balance: transactions.balance,
            })
            .from(transactions)
            .where(eq(transactions.id, metadata.transactionId))
            .limit(1)
        : Promise.resolve([]),
    ]);

    const linkedTransaction = transactionResult.length > 0 ? transactionResult[0] : null;

    return {
      exists: true,
      chunk,
      document: documentResult[0],
      linkedTransaction,
    };
  }

  // ========================================================================
  // CITATION FORMATTING
  // ========================================================================

  /**
   * Format citations for UI display
   *
   * @param citations - Array of citations with source details
   * @returns Formatted citations ready for UI rendering
   */
  formatCitationsForDisplay(citations: CitationWithSource[]): FormattedCitation[] {
    return citations.map((citation) => {
      const sourceType = this.mapSourceType(citation.sourceType);
      const relevanceLabel = this.getRelevanceLabel(citation.relevanceScore || 0);

      // Build source display info
      const sourceInfo: FormattedCitation['source'] = {
        type: sourceType,
        title: this.buildSourceTitle(citation),
      };

      // Add optional fields based on available data
      if (citation.transactionDetails) {
        sourceInfo.date = citation.transactionDetails.date;
        sourceInfo.amount = this.formatCurrency(citation.transactionDetails.amount);
        sourceInfo.category = citation.transactionDetails.category || undefined;
      }

      if (citation.accountDetails) {
        sourceInfo.account = `${citation.accountDetails.accountName} (${citation.accountDetails.accountNumber})`;
      }

      // Check if source is verifiable
      const verifiable = !!(citation.transactionId || citation.accountId);

      // Build deep link for navigation
      const deepLink = this.buildDeepLink(citation);

      return {
        id: citation.id,
        position: citation.position + 1, // 1-indexed for display
        snippet: citation.snippet,
        source: sourceInfo,
        relevance: {
          score: citation.relevanceScore || 0,
          label: relevanceLabel,
        },
        verifiable,
        deepLink,
      };
    });
  }

  // ========================================================================
  // FEEDBACK & METRICS
  // ========================================================================

  /**
   * Record user feedback on citation helpfulness
   *
   * @param citationId - The citation ID
   * @param wasHelpful - Whether the citation was helpful
   */
  async recordFeedback(citationId: string, wasHelpful: boolean): Promise<void> {
    await db.update(ragCitations).set({ wasHelpful }).where(eq(ragCitations.id, citationId));
  }

  /**
   * Get citation statistics for a user
   *
   * @param userId - The user ID
   * @returns Citation statistics
   */
  async getCitationStats(userId: string): Promise<{
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

  // ========================================================================
  // CLEANUP OPERATIONS
  // ========================================================================

  /**
   * Delete all citations for an answer
   *
   * @param answerId - The answer/query ID
   */
  async deleteCitationsForAnswer(answerId: string): Promise<void> {
    await db.delete(ragCitations).where(eq(ragCitations.queryId, answerId));
  }

  /**
   * Delete orphaned citations (citations with missing chunks)
   *
   * @returns Number of orphaned citations deleted
   */
  async cleanupOrphanedCitations(): Promise<number> {
    // Find citations with missing chunks
    const orphanedCitations = await db
      .select({ id: ragCitations.id })
      .from(ragCitations)
      .leftJoin(ragChunks, eq(ragCitations.chunkId, ragChunks.id))
      .where(sql`${ragChunks.id} IS NULL`);

    if (orphanedCitations.length === 0) {
      return 0;
    }

    const orphanedIds = orphanedCitations.map((c: any) => c.id);

    await db.delete(ragCitations).where(inArray(ragCitations.id, orphanedIds));

    return orphanedIds.length;
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Extract a relevant snippet from chunk content
   */
  private extractSnippet(chunkContent: string, answerText: string): string {
    // Try to find overlapping content between chunk and answer
    const maxSnippetLength = 200;

    // Simple approach: return first part of chunk content
    // Could be enhanced with semantic similarity to find most relevant portion
    if (chunkContent.length <= maxSnippetLength) {
      return chunkContent;
    }

    // Find sentence boundaries for cleaner snippets
    const sentences = chunkContent.split(/[.!?]+/);
    let snippet = '';

    for (const sentence of sentences) {
      if ((snippet + sentence).length > maxSnippetLength) {
        break;
      }
      snippet += sentence + '. ';
    }

    return snippet.trim() || chunkContent.slice(0, maxSnippetLength) + '...';
  }

  /**
   * Map source type string to typed value
   */
  private mapSourceType(sourceType: string): 'transaction' | 'account' | 'statement' | 'manual' {
    const validTypes = ['transaction', 'account', 'statement', 'manual'];
    return validTypes.includes(sourceType)
      ? (sourceType as 'transaction' | 'account' | 'statement' | 'manual')
      : 'manual';
  }

  /**
   * Get relevance label based on score
   */
  private getRelevanceLabel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Build a display title for the source
   */
  private buildSourceTitle(citation: CitationWithSource): string {
    if (citation.transactionDetails) {
      return `Transaction: ${citation.transactionDetails.description}`;
    }

    if (citation.accountDetails) {
      return `Account: ${citation.accountDetails.accountName}`;
    }

    if (citation.sourceTitle) {
      return citation.sourceTitle;
    }

    return `${this.capitalizeFirst(citation.sourceType)} Source`;
  }

  /**
   * Format currency amount (cents to dollars)
   */
  private formatCurrency(amountInCents: number): string {
    const dollars = Math.abs(amountInCents) / 100;
    const sign = amountInCents < 0 ? '-' : '';
    return `${sign}$${dollars.toFixed(2)}`;
  }

  /**
   * Build a deep link URL for navigation
   */
  private buildDeepLink(citation: CitationWithSource): string | undefined {
    if (citation.transactionId) {
      return `/transactions/${citation.transactionId}`;
    }

    if (citation.accountId) {
      return `/accounts/${citation.accountId}`;
    }

    return undefined;
  }

  /**
   * Capitalize first letter of string
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const citationManager = new CitationManager();
