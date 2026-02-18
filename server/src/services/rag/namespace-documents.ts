/**
 * Namespace Document Operations
 *
 * Handles document CRUD operations within RAG namespaces.
 */

import { db, ragChunks, ragCitations, ragDocuments, ragNamespaces } from '../../schema.js';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import crypto from 'crypto';

import type { ChunkingStrategy, DocumentMetadata } from './namespace-types.js';

// ============================================================================
// DOCUMENT OPERATIONS
// ============================================================================

/**
 * Add a document to a namespace
 */
export async function addDocument(
  namespaceId: string,
  userId: string,
  content: string,
  metadata: DocumentMetadata,
): Promise<string> {
  const now = new Date().toISOString();
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');

  // Check for duplicate
  const existing = await db
    .select()
    .from(ragDocuments)
    .where(
      and(eq(ragDocuments.namespaceId, namespaceId), eq(ragDocuments.contentHash, contentHash)),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(ragDocuments)
      .set({
        content,
        metadata: JSON.stringify(metadata),
        version: sql`version + 1`,
        status: 'pending',
        updatedAt: now,
      })
      .where(eq(ragDocuments.id, existing[0].id));

    return existing[0].id;
  }

  const id = crypto.randomUUID();

  await db.insert(ragDocuments).values({
    id,
    namespaceId,
    userId,
    sourceType: metadata.sourceType,
    sourceId: metadata.sourceId || null,
    title: metadata.title || null,
    content,
    contentHash,
    metadata: JSON.stringify(metadata),
    version: 1,
    chunkCount: 0,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  // Update document count
  await db
    .update(ragNamespaces)
    .set({
      documentCount: sql`document_count + 1`,
      updatedAt: now,
    })
    .where(eq(ragNamespaces.id, namespaceId));

  return id;
}

/**
 * Get document by ID
 */
export async function getDocument(
  documentId: string,
): Promise<typeof ragDocuments.$inferSelect | null> {
  const result = await db
    .select()
    .from(ragDocuments)
    .where(eq(ragDocuments.id, documentId))
    .limit(1);

  return result[0] || null;
}

/**
 * Get documents for a namespace
 */
export async function getNamespaceDocuments(
  namespaceId: string,
  options?: {
    sourceType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  },
): Promise<(typeof ragDocuments.$inferSelect)[]> {
  let query = db
    .select()
    .from(ragDocuments)
    .where(eq(ragDocuments.namespaceId, namespaceId))
    .orderBy(desc(ragDocuments.createdAt));

  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.offset(options.offset);
  }

  return query;
}

/**
 * Delete a document
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const doc = await getDocument(documentId);
  if (!doc) return;

  // First get all chunk IDs for this document to properly delete citations
  const docChunks = await db
    .select({ id: ragChunks.id })
    .from(ragChunks)
    .where(eq(ragChunks.documentId, documentId));

  const chunkIds = (docChunks as Record<string, unknown>[]).map((c) => c.id as string);

  // Delete citations referencing this document's chunks
  if (chunkIds.length > 0) {
    await db.delete(ragCitations).where(inArray(ragCitations.chunkId, chunkIds));
  }

  // Delete chunks
  await db.delete(ragChunks).where(eq(ragChunks.documentId, documentId));

  // Delete document
  await db.delete(ragDocuments).where(eq(ragDocuments.id, documentId));

  // Update counts
  await db
    .update(ragNamespaces)
    .set({
      documentCount: sql`document_count - 1`,
      chunkCount: sql`chunk_count - ${doc.chunkCount}`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(ragNamespaces.id, doc.namespaceId));
}

// ============================================================================
// CHUNK OPERATIONS
// ============================================================================

/**
 * Add chunks to a document
 */
export async function addChunks(
  documentId: string,
  namespaceId: string,
  userId: string,
  chunks: Array<{
    content: string;
    chunkType: ChunkingStrategy;
    metadata: Record<string, unknown>;
    embedding?: number[];
  }>,
): Promise<string[]> {
  const now = new Date().toISOString();
  const chunkIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const id = crypto.randomUUID();

    await db.insert(ragChunks).values({
      id,
      documentId,
      namespaceId,
      userId,
      chunkIndex: i,
      chunkType: chunk.chunkType,
      content: chunk.content,
      contentTokens: estimateTokenCount(chunk.content),
      embedding: chunk.embedding ? JSON.stringify(chunk.embedding) : null,
      metadata: JSON.stringify(chunk.metadata),
      dateStart: (chunk.metadata.dateStart as string) || null,
      dateEnd: (chunk.metadata.dateEnd as string) || null,
      category: (chunk.metadata.category as string) || null,
      merchantNormalized: (chunk.metadata.merchantNormalized as string) || null,
      accountId: (chunk.metadata.accountId as string) || null,
      totalAmount: (chunk.metadata.totalAmount as number) || null,
      transactionCount: (chunk.metadata.transactionCount as number) || null,
      createdAt: now,
    });

    chunkIds.push(id);
  }

  // Update document chunk count
  await db
    .update(ragDocuments)
    .set({
      chunkCount: chunks.length,
      status: 'indexed',
      indexedAt: now,
      updatedAt: now,
    })
    .where(eq(ragDocuments.id, documentId));

  // Update namespace chunk count and index time
  await db
    .update(ragNamespaces)
    .set({
      chunkCount: sql`chunk_count + ${chunks.length}`,
      lastIndexedAt: now,
      updatedAt: now,
    })
    .where(eq(ragNamespaces.id, namespaceId));

  return chunkIds;
}

/**
 * Get chunks for a namespace with optional filtering
 */
export async function getChunks(
  namespaceId: string,
  filters?: {
    userId?: string;
    category?: string;
    dateStart?: string;
    dateEnd?: string;
    accountId?: string;
    limit?: number;
  },
): Promise<(typeof ragChunks.$inferSelect)[]> {
  const conditions = [eq(ragChunks.namespaceId, namespaceId)];

  if (filters?.userId) {
    conditions.push(eq(ragChunks.userId, filters.userId));
  }
  if (filters?.category) {
    conditions.push(eq(ragChunks.category, filters.category));
  }
  if (filters?.accountId) {
    conditions.push(eq(ragChunks.accountId, filters.accountId));
  }

  let query = db
    .select()
    .from(ragChunks)
    .where(and(...conditions))
    .orderBy(desc(ragChunks.createdAt));

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  return query;
}

/**
 * Update chunk embeddings
 */
export async function updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
  await db
    .update(ragChunks)
    .set({
      embedding: JSON.stringify(embedding),
    })
    .where(eq(ragChunks.id, chunkId));
}

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Estimate token count for text
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
