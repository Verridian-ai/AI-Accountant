/**
 * Citation Extraction Logic
 *
 * Handles creating citations and retrieving citations with source details.
 */

import {
  db,
  ragCitations,
  ragChunks,
  ragDocuments,
  transactions,
  accounts,
} from '../../../schema.js';
import { logger } from '../../../lib/logger.js';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

import type {
  SourceChunk,
  Citation,
  CitationWithSource,
  ChunkMetadata,
  TransactionDetails,
  AccountDetails,
  CreateCitationOptions,
  CreateCitationResult,
} from './types.js';
import { DEFAULT_CITATION_OPTIONS } from './types.js';
import { safeParseMetadata, extractSnippet } from './helpers.js';

// Re-export helpers for consumers
export { safeParseMetadata, extractSnippet } from './helpers.js';

// Re-export verification functions for consumers
export { verifySourceExists, verifySourcesExist, getVerificationDetails } from './verification.js';

// Typed interfaces for DB result rows
interface CitationRecord {
  id: string;
  queryId: string;
  chunkId: string;
  documentId: string;
  relevanceScore: number | null;
  rerankScore: number | null;
  position: number;
  excerptUsed: string | null;
  wasHelpful: boolean | null;
  createdAt: string;
}

interface ChunkRow {
  id: string;
  content: string;
  metadata: string | null;
}

interface DocumentRow {
  id: string;
  sourceType: string;
  title: string | null;
}

interface TransactionRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  balance: number | null;
}

interface AccountRow {
  id: string;
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  accountType: string;
}

// ============================================================================
// CITATION CREATION
// ============================================================================

/**
 * Create citation records for an AI-generated answer
 */
export async function createCitation(
  answerText: string,
  sourceChunks: SourceChunk[],
  userId: string,
  options?: CreateCitationOptions,
): Promise<CreateCitationResult> {
  const config = { ...DEFAULT_CITATION_OPTIONS, ...options };
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
      logger.error({ err: error }, `Failed to create citation for chunk ${chunk.chunkId}:`);
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

// ============================================================================
// CITATION RETRIEVAL
// ============================================================================

/**
 * Retrieve all citations for a given answer
 */
export async function getCitationsForAnswer(answerId: string): Promise<CitationWithSource[]> {
  const citationRecords: CitationRecord[] = await db
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
  const chunkIds = citationRecords.map((c: CitationRecord) => c.chunkId);
  const documentIds = [
    ...new Set(citationRecords.map((c: CitationRecord) => c.documentId)),
  ] as string[];

  const [chunks, documents] = await Promise.all([
    db.select().from(ragChunks).where(inArray(ragChunks.id, chunkIds)),
    db.select().from(ragDocuments).where(inArray(ragDocuments.id, documentIds)),
  ]);

  const chunkMap = new Map((chunks as ChunkRow[]).map((c: ChunkRow) => [c.id, c]));
  const documentMap = new Map((documents as DocumentRow[]).map((d: DocumentRow) => [d.id, d]));

  // Collect all transaction and account IDs to batch fetch
  const transactionIds = new Set<string>();
  const accountIds = new Set<string>();

  const metadataMap = new Map<string, ChunkMetadata>();
  for (const chunk of chunks as ChunkRow[]) {
    const metadata = safeParseMetadata(chunk.metadata);
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

  const transactionMap = new Map(
    (transactionResults as TransactionRow[]).map((t: TransactionRow) => [t.id, t]),
  );
  const accountMap = new Map((accountResults as AccountRow[]).map((a: AccountRow) => [a.id, a]));

  // Build enriched citations
  const enrichedCitations: CitationWithSource[] = [];

  for (const citation of citationRecords) {
    const chunk = chunkMap.get(citation.chunkId);
    const document = documentMap.get(citation.documentId);

    if (!chunk || !document) continue;

    const metadata = metadataMap.get(chunk.id) || {};

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
      sourceType: document.sourceType,
      sourceTitle: document.title,
      chunkContent: chunk.content,
      transactionDetails,
      accountDetails,
    });
  }

  return enrichedCitations;
}
