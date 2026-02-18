/**
 * Citation Retrieval
 *
 * Fetches citations with enriched source data (chunks, documents,
 * transactions, accounts).
 */

import {
  db,
  ragCitations,
  ragChunks,
  ragDocuments,
  transactions,
  accounts,
} from '../../../schema.js';
import { eq, inArray } from 'drizzle-orm';

import type {
  CitationWithSource,
  ChunkMetadata,
  TransactionDetails,
  AccountDetails,
} from './types.js';
import { safeParseMetadata } from './helpers.js';

/**
 * Get enriched citations for an answer
 */
export async function getCitationsForAnswer(answerId: string): Promise<CitationWithSource[]> {
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

  if (citationRecords.length === 0) return [];

  type CitRec = { chunkId: string; documentId: string };
  const chunkIds = (citationRecords as CitRec[]).map((c) => c.chunkId);
  const documentIds = [
    ...new Set((citationRecords as CitRec[]).map((c) => c.documentId)),
  ] as string[];

  const [chunks, documents] = await Promise.all([
    db.select().from(ragChunks).where(inArray(ragChunks.id, chunkIds)),
    db.select().from(ragDocuments).where(inArray(ragDocuments.id, documentIds)),
  ]);

  type ChunkRow = typeof ragChunks.$inferSelect;
  type DocumentRow = typeof ragDocuments.$inferSelect;
  const chunkMap = new Map<string, ChunkRow>(chunks.map((c: ChunkRow) => [c.id, c]));
  const documentMap = new Map<string, DocumentRow>(documents.map((d: DocumentRow) => [d.id, d]));

  // Collect linked entity IDs from chunk metadata
  const transactionIds = new Set<string>();
  const accountIds = new Set<string>();
  const metadataMap = new Map<string, ChunkMetadata>();

  for (const chunk of chunks) {
    const metadata = safeParseMetadata(chunk.metadata);
    metadataMap.set(chunk.id, metadata);
    if (metadata.transactionId) transactionIds.add(metadata.transactionId);
    if (metadata.accountId) accountIds.add(metadata.accountId);
  }

  // Fetch linked entities in parallel
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

  const transactionMap = new Map<string, TransactionDetails>(
    (transactionResults as TransactionDetails[]).map((t: TransactionDetails) => [t.id, t]),
  );
  const accountMap = new Map<string, AccountDetails>(
    (accountResults as AccountDetails[]).map((a: AccountDetails) => [a.id, a]),
  );

  // Enrich citations with source data
  const enrichedCitations: CitationWithSource[] = [];

  for (const citation of citationRecords) {
    const chunk = chunkMap.get(citation.chunkId);
    const document = documentMap.get(citation.documentId);
    if (!chunk || !document) continue;

    const metadata: ChunkMetadata = metadataMap.get(chunk.id) || {};
    const transactionDetails = metadata.transactionId
      ? transactionMap.get(metadata.transactionId) || null
      : null;
    const accountDetails = metadata.accountId ? accountMap.get(metadata.accountId) || null : null;

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
      sourceType: (document as Record<string, unknown>).sourceType as string,
      sourceTitle: (document as Record<string, unknown>).title as string | null,
      chunkContent: (chunk as Record<string, unknown>).content as string,
      transactionDetails,
      accountDetails,
    });
  }

  return enrichedCitations;
}
