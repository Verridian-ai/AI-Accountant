/**
 * Citation Source Verification
 *
 * Verifies that source chunks exist and retrieves detailed verification info.
 */

import { db, ragChunks, ragDocuments, transactions } from '../../../schema.js';
import { eq, inArray } from 'drizzle-orm';

import type { TransactionDetails } from './types.js';
import { safeParseMetadata } from './helpers.js';

// ============================================================================
// SOURCE VERIFICATION
// ============================================================================

/**
 * Verify that a source chunk still exists and is valid
 */
export async function verifySourceExists(chunkId: string): Promise<boolean> {
  const result = await db
    .select({ id: ragChunks.id })
    .from(ragChunks)
    .where(eq(ragChunks.id, chunkId))
    .limit(1);

  return result.length > 0;
}

/**
 * Verify multiple source chunks exist
 */
export async function verifySourcesExist(chunkIds: string[]): Promise<Map<string, boolean>> {
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
 */
export async function getVerificationDetails(chunkId: string): Promise<{
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
  const metadata = safeParseMetadata(chunk.metadata);

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
