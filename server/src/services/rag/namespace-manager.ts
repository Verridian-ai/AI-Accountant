/**
 * RAG Namespace Manager
 *
 * Manages per-user knowledge namespaces for multi-tenant isolation.
 * Each user has their own namespace with isolated documents and chunks.
 */

import {
  db,
  ragNamespaces,
  ragDocuments,
  ragChunks,
  ragCitations,
  transactions,
  accounts,
} from '../../schema.js';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

// ============================================================================
// TYPES
// ============================================================================

export interface NamespaceConfig {
  embeddingModel: string;
  embeddingDimensions: number;
  chunkingStrategy: ChunkingStrategy;
  maxChunkTokens: number;
  overlapTokens: number;
}

export type ChunkingStrategy =
  | 'single_transaction'
  | 'transaction_group'
  | 'temporal_window'
  | 'category_summary'
  | 'account_context'
  | 'semantic';

export interface Namespace {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  embeddingModel: string;
  embeddingDimensions: number;
  chunkCount: number;
  documentCount: number;
  lastIndexedAt: string | null;
  status: string;
  settings: NamespaceConfig | null;
}

export interface DocumentMetadata {
  sourceType: 'transaction' | 'statement' | 'account' | 'manual';
  sourceId?: string;
  title?: string;
  dateRange?: { start: string; end: string };
  category?: string;
  accountId?: string;
  totalAmount?: number;
  transactionCount?: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_NAMESPACE_CONFIG: NamespaceConfig = {
  embeddingModel: 'BAAI/bge-small-en-v1.5',
  embeddingDimensions: 384,
  chunkingStrategy: 'transaction_group',
  maxChunkTokens: 500,
  overlapTokens: 50,
};

// ============================================================================
// NAMESPACE MANAGER CLASS
// ============================================================================

export class NamespaceManager {
  private baseDataPath: string;

  constructor(baseDataPath?: string) {
    this.baseDataPath = baseDataPath || path.join(process.cwd(), 'cognee_data');
  }

  // ========================================================================
  // NAMESPACE OPERATIONS
  // ========================================================================

  /**
   * Create or get the default namespace for a user
   */
  async getOrCreateDefaultNamespace(userId: string): Promise<Namespace> {
    // Try to find existing default namespace
    const existing = await db
      .select()
      .from(ragNamespaces)
      .where(and(eq(ragNamespaces.userId, userId), eq(ragNamespaces.name, 'default')))
      .limit(1);

    if (existing.length > 0) {
      return this.mapToNamespace(existing[0]);
    }

    // Create new default namespace
    return this.createNamespace(userId, 'default', 'Default knowledge namespace');
  }

  /**
   * Create a new namespace
   */
  async createNamespace(
    userId: string,
    name: string,
    description?: string,
    config?: Partial<NamespaceConfig>,
  ): Promise<Namespace> {
    const now = new Date().toISOString();
    const namespaceConfig = { ...DEFAULT_NAMESPACE_CONFIG, ...config };

    const id = crypto.randomUUID();

    await db.insert(ragNamespaces).values({
      id,
      userId,
      name,
      description: description || null,
      embeddingModel: namespaceConfig.embeddingModel,
      embeddingDimensions: namespaceConfig.embeddingDimensions,
      chunkCount: 0,
      documentCount: 0,
      status: 'active',
      settings: JSON.stringify(namespaceConfig),
      createdAt: now,
      updatedAt: now,
    });

    // Create data directory for this namespace
    await this.ensureNamespaceDirectory(userId, id);

    return {
      id,
      userId,
      name,
      description: description || null,
      embeddingModel: namespaceConfig.embeddingModel,
      embeddingDimensions: namespaceConfig.embeddingDimensions,
      chunkCount: 0,
      documentCount: 0,
      lastIndexedAt: null,
      status: 'active',
      settings: namespaceConfig,
    };
  }

  /**
   * Get namespace by ID
   *
   * NOTE: This method does not enforce multi-tenant isolation.
   * For user-facing operations, use getNamespaceForUser() instead.
   */
  async getNamespace(namespaceId: string): Promise<Namespace | null> {
    const result = await db
      .select()
      .from(ragNamespaces)
      .where(eq(ragNamespaces.id, namespaceId))
      .limit(1);

    return result.length > 0 ? this.mapToNamespace(result[0]) : null;
  }

  /**
   * Get namespace by ID with multi-tenant isolation
   *
   * @param namespaceId - The namespace ID
   * @param userId - The user ID to verify ownership
   * @returns Namespace if found and belongs to user, null otherwise
   */
  async getNamespaceForUser(namespaceId: string, userId: string): Promise<Namespace | null> {
    const result = await db
      .select()
      .from(ragNamespaces)
      .where(and(eq(ragNamespaces.id, namespaceId), eq(ragNamespaces.userId, userId)))
      .limit(1);

    return result.length > 0 ? this.mapToNamespace(result[0]) : null;
  }

  /**
   * Get all namespaces for a user
   */
  async getUserNamespaces(userId: string): Promise<Namespace[]> {
    const result = await db
      .select()
      .from(ragNamespaces)
      .where(eq(ragNamespaces.userId, userId))
      .orderBy(desc(ragNamespaces.createdAt));

    return result.map(this.mapToNamespace);
  }

  /**
   * Update namespace settings
   */
  async updateNamespace(
    namespaceId: string,
    updates: Partial<{
      name: string;
      description: string;
      settings: Partial<NamespaceConfig>;
    }>,
  ): Promise<void> {
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    if (updates.name) {
      updateData.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }
    if (updates.settings) {
      // Merge with existing settings
      const existing = await this.getNamespace(namespaceId);
      if (existing) {
        const mergedSettings = { ...existing.settings, ...updates.settings };
        updateData.settings = JSON.stringify(mergedSettings);
      }
    }

    await db.update(ragNamespaces).set(updateData).where(eq(ragNamespaces.id, namespaceId));
  }

  /**
   * Delete a namespace and all its data
   */
  async deleteNamespace(namespaceId: string): Promise<void> {
    // Get namespace info for directory cleanup
    const namespace = await this.getNamespace(namespaceId);
    if (!namespace) return;

    // First get all chunk IDs for this namespace to properly delete citations
    const namespaceChunks = await db
      .select({ id: ragChunks.id })
      .from(ragChunks)
      .where(eq(ragChunks.namespaceId, namespaceId));

    const chunkIds = namespaceChunks.map((c: any) => c.id);

    // Delete all citations referencing these chunks (using parameterized query)
    if (chunkIds.length > 0) {
      await db.delete(ragCitations).where(inArray(ragCitations.chunkId, chunkIds));
    }

    // Delete all chunks
    await db.delete(ragChunks).where(eq(ragChunks.namespaceId, namespaceId));

    // Delete all documents
    await db.delete(ragDocuments).where(eq(ragDocuments.namespaceId, namespaceId));

    // Delete namespace
    await db.delete(ragNamespaces).where(eq(ragNamespaces.id, namespaceId));

    // Clean up data directory
    await this.cleanupNamespaceDirectory(namespace.userId, namespaceId);
  }

  // ========================================================================
  // DOCUMENT OPERATIONS
  // ========================================================================

  /**
   * Add a document to a namespace
   */
  async addDocument(
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
      // Update version instead of creating duplicate
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
  async getDocument(documentId: string): Promise<typeof ragDocuments.$inferSelect | null> {
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
  async getNamespaceDocuments(
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
  async deleteDocument(documentId: string): Promise<void> {
    const doc = await this.getDocument(documentId);
    if (!doc) return;

    // First get all chunk IDs for this document to properly delete citations
    const docChunks = await db
      .select({ id: ragChunks.id })
      .from(ragChunks)
      .where(eq(ragChunks.documentId, documentId));

    const chunkIds = docChunks.map((c: any) => c.id);

    // Delete citations referencing this document's chunks (using parameterized query)
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

  // ========================================================================
  // CHUNK OPERATIONS
  // ========================================================================

  /**
   * Add chunks to a document
   */
  async addChunks(
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
        contentTokens: this.estimateTokenCount(chunk.content),
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
  async getChunks(
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
    // Build base query
    let conditions = [eq(ragChunks.namespaceId, namespaceId)];

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
  async updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
    await db
      .update(ragChunks)
      .set({
        embedding: JSON.stringify(embedding),
      })
      .where(eq(ragChunks.id, chunkId));
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Estimate token count for text
   */
  private estimateTokenCount(text: string): number {
    // Rough estimate: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Get namespace data directory path
   */
  getNamespaceDataPath(userId: string, namespaceId: string): string {
    return path.join(this.baseDataPath, `user_${userId}`, namespaceId);
  }

  /**
   * Ensure namespace directory exists
   */
  private async ensureNamespaceDirectory(userId: string, namespaceId: string): Promise<void> {
    const dirPath = this.getNamespaceDataPath(userId, namespaceId);
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * Clean up namespace directory
   */
  private async cleanupNamespaceDirectory(userId: string, namespaceId: string): Promise<void> {
    const dirPath = this.getNamespaceDataPath(userId, namespaceId);
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to clean up namespace directory: ${dirPath}`, error);
    }
  }

  /**
   * Map database record to Namespace type
   */
  private mapToNamespace(record: typeof ragNamespaces.$inferSelect): Namespace {
    let parsedSettings: NamespaceConfig | null = null;
    if (record.settings) {
      try {
        parsedSettings = JSON.parse(record.settings) as NamespaceConfig;
      } catch (error) {
        console.warn(`Failed to parse namespace settings for ${record.id}:`, error);
        parsedSettings = null;
      }
    }

    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      description: record.description,
      embeddingModel: record.embeddingModel ?? '',
      embeddingDimensions: record.embeddingDimensions ?? 0,
      chunkCount: record.chunkCount || 0,
      documentCount: record.documentCount || 0,
      lastIndexedAt: record.lastIndexedAt,
      status: record.status ?? '',
      settings: parsedSettings,
    };
  }

  /**
   * Get namespace statistics
   */
  async getNamespaceStats(namespaceId: string): Promise<{
    documentCount: number;
    chunkCount: number;
    totalTokens: number;
    lastIndexedAt: string | null;
    chunksByType: Record<string, number>;
  }> {
    const namespace = await this.getNamespace(namespaceId);
    if (!namespace) {
      throw new Error('Namespace not found');
    }

    // Get chunk statistics
    const chunkStats = await db
      .select({
        chunkType: ragChunks.chunkType,
        count: sql<number>`COUNT(*)`,
        totalTokens: sql<number>`COALESCE(SUM(${ragChunks.contentTokens}), 0)`,
      })
      .from(ragChunks)
      .where(eq(ragChunks.namespaceId, namespaceId))
      .groupBy(ragChunks.chunkType);

    const chunksByType: Record<string, number> = {};
    let totalTokens = 0;

    for (const stat of chunkStats) {
      chunksByType[stat.chunkType] = stat.count;
      totalTokens += stat.totalTokens;
    }

    return {
      documentCount: namespace.documentCount,
      chunkCount: namespace.chunkCount,
      totalTokens,
      lastIndexedAt: namespace.lastIndexedAt,
      chunksByType,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const namespaceManager = new NamespaceManager();
