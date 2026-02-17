/**
 * FTS5 Table Management
 *
 * Creates and manages the SQLite FTS5 virtual table for keyword search.
 * Provides initialization, rebuild, and synonym expansion functions.
 */

import { db } from '../../../schema.js';
import { sql } from 'drizzle-orm';
import { logger } from '../../../lib/logger.js';

// ============================================================================
// FTS5 TABLE MANAGEMENT
// ============================================================================

/**
 * Create the FTS5 virtual table if it doesn't exist
 * This should be called during application initialization
 */
export async function ensureFTS5Table(): Promise<void> {
  try {
    // Check if FTS5 table exists
    const tableCheck = await db.all(sql`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='rag_chunks_fts'
    `);

    if (tableCheck.length === 0) {
      logger.info('[SparseSearch] Creating FTS5 table...');

      // Create FTS5 virtual table
      await db.run(sql`
        CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
          chunk_id,
          content,
          category,
          merchant_normalized,
          content='',
          contentless_delete=1,
          tokenize='porter unicode61'
        )
      `);

      // Create triggers to keep FTS5 in sync with rag_chunks
      await db.run(sql`
        CREATE TRIGGER IF NOT EXISTS rag_chunks_ai AFTER INSERT ON rag_chunks BEGIN
          INSERT INTO rag_chunks_fts(chunk_id, content, category, merchant_normalized)
          VALUES (new.id, new.content, new.category, new.merchant_normalized);
        END
      `);

      await db.run(sql`
        CREATE TRIGGER IF NOT EXISTS rag_chunks_ad AFTER DELETE ON rag_chunks BEGIN
          DELETE FROM rag_chunks_fts WHERE chunk_id = old.id;
        END
      `);

      await db.run(sql`
        CREATE TRIGGER IF NOT EXISTS rag_chunks_au AFTER UPDATE ON rag_chunks BEGIN
          DELETE FROM rag_chunks_fts WHERE chunk_id = old.id;
          INSERT INTO rag_chunks_fts(chunk_id, content, category, merchant_normalized)
          VALUES (new.id, new.content, new.category, new.merchant_normalized);
        END
      `);

      logger.info('[SparseSearch] FTS5 table and triggers created');
    }
  } catch (error) {
    logger.error({ err: error }, '[SparseSearch] Error creating FTS5 table:');
    // Don't throw - fall back to LIKE-based search if FTS5 is not available
  }
}

/**
 * Rebuild the FTS5 index from existing chunks
 * Useful after bulk imports or index corruption
 */
export async function rebuildFTS5Index(): Promise<void> {
  logger.info('[SparseSearch] Rebuilding FTS5 index...');

  try {
    // Clear existing FTS5 data
    await db.run(sql`DELETE FROM rag_chunks_fts`);

    // Re-populate from rag_chunks
    await db.run(sql`
      INSERT INTO rag_chunks_fts(chunk_id, content, category, merchant_normalized)
      SELECT id, content, category, merchant_normalized
      FROM rag_chunks
    `);

    logger.info('[SparseSearch] FTS5 index rebuilt successfully');
  } catch (error) {
    logger.error({ err: error }, '[SparseSearch] Error rebuilding FTS5 index:');
    throw error;
  }
}

// ============================================================================
// SYNONYM EXPANSION
// ============================================================================

/**
 * Expand query with financial domain synonyms
 */
export function expandQuery(query: string): string[] {
  const synonymMap: Record<string, string[]> = {
    purchase: ['buy', 'bought', 'payment', 'charge'],
    payment: ['pay', 'paid', 'transfer', 'sent'],
    deposit: ['credit', 'received', 'incoming'],
    withdrawal: ['debit', 'cash', 'atm'],
    grocery: ['groceries', 'supermarket', 'woolworths', 'coles', 'aldi'],
    restaurant: ['dining', 'food', 'cafe', 'coffee'],
    fuel: ['petrol', 'gas', 'shell', 'bp', 'caltex'],
    utility: ['utilities', 'electricity', 'water', 'gas', 'internet'],
    subscription: ['recurring', 'monthly', 'netflix', 'spotify'],
    transfer: ['trf', 'tfr', 'internal'],
  };

  const queryLower = query.toLowerCase();
  const expansions: string[] = [];

  for (const [key, synonyms] of Object.entries(synonymMap)) {
    if (queryLower.includes(key)) {
      expansions.push(...synonyms);
    }
    for (const synonym of synonyms) {
      if (queryLower.includes(synonym)) {
        expansions.push(key);
        break;
      }
    }
  }

  return [...new Set(expansions)];
}
