/**
 * Namespace Utility Functions
 *
 * Provides filesystem operations and statistics queries for namespaces.
 */

import path from 'path';
import fs from 'fs/promises';
import { db, ragChunks, ragNamespaces } from '../../schema.js';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';

import type { NamespaceConfig, Namespace } from './namespace-types.js';

// ============================================================================
// FILESYSTEM OPERATIONS
// ============================================================================

/**
 * Get the data directory path for a namespace
 */
export function getNamespaceDataPath(
  baseDataPath: string,
  userId: string,
  namespaceId: string,
): string {
  return path.join(baseDataPath, `user_${userId}`, namespaceId);
}

/**
 * Ensure the namespace directory exists
 */
export async function ensureNamespaceDirectory(
  baseDataPath: string,
  userId: string,
  namespaceId: string,
): Promise<void> {
  const dirPath = getNamespaceDataPath(baseDataPath, userId, namespaceId);
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Clean up the namespace directory
 */
export async function cleanupNamespaceDirectory(
  baseDataPath: string,
  userId: string,
  namespaceId: string,
): Promise<void> {
  const dirPath = getNamespaceDataPath(baseDataPath, userId, namespaceId);
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    logger.warn({ err: error }, `Failed to clean up namespace directory: ${dirPath}`);
  }
}

// ============================================================================
// RECORD MAPPING
// ============================================================================

/**
 * Map a database record to a Namespace object
 */
export function mapToNamespace(record: typeof ragNamespaces.$inferSelect): Namespace {
  let parsedSettings: NamespaceConfig | null = null;
  if (record.settings) {
    try {
      parsedSettings = JSON.parse(record.settings) as NamespaceConfig;
    } catch (error) {
      logger.warn({ err: error }, `Failed to parse namespace settings for ${record.id}:`);
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

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get statistics for a namespace
 */
export async function getNamespaceStats(
  namespace: Namespace,
  namespaceId: string,
): Promise<{
  documentCount: number;
  chunkCount: number;
  totalTokens: number;
  lastIndexedAt: string | null;
  chunksByType: Record<string, number>;
}> {
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
