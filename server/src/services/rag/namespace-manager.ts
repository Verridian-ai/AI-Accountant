/**
 * RAG Namespace Manager
 *
 * Manages per-user knowledge namespaces for multi-tenant isolation.
 * Each user has their own namespace with isolated documents and chunks.
 */

import { db, ragNamespaces, ragChunks, ragCitations, ragDocuments } from '../../schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import path from 'path';

import type {
  NamespaceConfig,
  ChunkingStrategy,
  Namespace,
  DocumentMetadata,
} from './namespace-types.js';
import { DEFAULT_NAMESPACE_CONFIG } from './namespace-types.js';
import {
  addDocument as addDocumentFn,
  getDocument as getDocumentFn,
  getNamespaceDocuments as getNamespaceDocumentsFn,
  deleteDocument as deleteDocumentFn,
  addChunks as addChunksFn,
  getChunks as getChunksFn,
  updateChunkEmbedding as updateChunkEmbeddingFn,
} from './namespace-documents.js';
import {
  getNamespaceDataPath as getNamespaceDataPathFn,
  ensureNamespaceDirectory as ensureNamespaceDirectoryFn,
  cleanupNamespaceDirectory as cleanupNamespaceDirectoryFn,
  mapToNamespace,
  getNamespaceStats as getNamespaceStatsFn,
} from './namespace-utils.js';

export type { NamespaceConfig, ChunkingStrategy, Namespace, DocumentMetadata };
export { DEFAULT_NAMESPACE_CONFIG };

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

  async getOrCreateDefaultNamespace(userId: string): Promise<Namespace> {
    const existing = await db
      .select()
      .from(ragNamespaces)
      .where(and(eq(ragNamespaces.userId, userId), eq(ragNamespaces.name, 'default')))
      .limit(1);

    if (existing.length > 0) {
      return mapToNamespace(existing[0]);
    }

    return this.createNamespace(userId, 'default', 'Default knowledge namespace');
  }

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

    await ensureNamespaceDirectoryFn(this.baseDataPath, userId, id);

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

  async getNamespace(namespaceId: string): Promise<Namespace | null> {
    const result = await db
      .select()
      .from(ragNamespaces)
      .where(eq(ragNamespaces.id, namespaceId))
      .limit(1);

    return result.length > 0 ? mapToNamespace(result[0]) : null;
  }

  async getNamespaceForUser(namespaceId: string, userId: string): Promise<Namespace | null> {
    const result = await db
      .select()
      .from(ragNamespaces)
      .where(and(eq(ragNamespaces.id, namespaceId), eq(ragNamespaces.userId, userId)))
      .limit(1);

    return result.length > 0 ? mapToNamespace(result[0]) : null;
  }

  async getUserNamespaces(userId: string): Promise<Namespace[]> {
    const result = await db
      .select()
      .from(ragNamespaces)
      .where(eq(ragNamespaces.userId, userId))
      .orderBy(desc(ragNamespaces.createdAt));

    return result.map(mapToNamespace);
  }

  async updateNamespace(
    namespaceId: string,
    updates: Partial<{
      name: string;
      description: string;
      settings: Partial<NamespaceConfig>;
    }>,
  ): Promise<void> {
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updatedAt: now };

    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.settings) {
      const existing = await this.getNamespace(namespaceId);
      if (existing) {
        updateData.settings = JSON.stringify({ ...existing.settings, ...updates.settings });
      }
    }

    await db.update(ragNamespaces).set(updateData).where(eq(ragNamespaces.id, namespaceId));
  }

  async deleteNamespace(namespaceId: string): Promise<void> {
    const namespace = await this.getNamespace(namespaceId);
    if (!namespace) return;

    const namespaceChunks = await db
      .select({ id: ragChunks.id })
      .from(ragChunks)
      .where(eq(ragChunks.namespaceId, namespaceId));

    const chunkIds = namespaceChunks.map((c: Record<string, unknown>) => c.id as string);

    if (chunkIds.length > 0) {
      await db.delete(ragCitations).where(inArray(ragCitations.chunkId, chunkIds));
    }

    await db.delete(ragChunks).where(eq(ragChunks.namespaceId, namespaceId));
    await db.delete(ragDocuments).where(eq(ragDocuments.namespaceId, namespaceId));
    await db.delete(ragNamespaces).where(eq(ragNamespaces.id, namespaceId));

    await cleanupNamespaceDirectoryFn(this.baseDataPath, namespace.userId, namespaceId);
  }

  // ========================================================================
  // DOCUMENT OPERATIONS — delegated to namespace-documents.ts
  // ========================================================================

  async addDocument(
    namespaceId: string,
    userId: string,
    content: string,
    metadata: DocumentMetadata,
  ): Promise<string> {
    return addDocumentFn(namespaceId, userId, content, metadata);
  }

  async getDocument(documentId: string): Promise<typeof ragDocuments.$inferSelect | null> {
    return getDocumentFn(documentId);
  }

  async getNamespaceDocuments(
    namespaceId: string,
    options?: { sourceType?: string; status?: string; limit?: number; offset?: number },
  ): Promise<(typeof ragDocuments.$inferSelect)[]> {
    return getNamespaceDocumentsFn(namespaceId, options);
  }

  async deleteDocument(documentId: string): Promise<void> {
    return deleteDocumentFn(documentId);
  }

  // ========================================================================
  // CHUNK OPERATIONS — delegated to namespace-documents.ts
  // ========================================================================

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
    return addChunksFn(documentId, namespaceId, userId, chunks);
  }

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
    return getChunksFn(namespaceId, filters);
  }

  async updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
    return updateChunkEmbeddingFn(chunkId, embedding);
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  getNamespaceDataPath(userId: string, namespaceId: string): string {
    return getNamespaceDataPathFn(this.baseDataPath, userId, namespaceId);
  }

  async getNamespaceStats(namespaceId: string): Promise<{
    documentCount: number;
    chunkCount: number;
    totalTokens: number;
    lastIndexedAt: string | null;
    chunksByType: Record<string, number>;
  }> {
    const namespace = await this.getNamespace(namespaceId);
    if (!namespace) throw new Error('Namespace not found');
    return getNamespaceStatsFn(namespace, namespaceId);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const namespaceManager = new NamespaceManager();
