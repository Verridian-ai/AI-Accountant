/**
 * Cognee Client — Shared Types & Constants
 *
 * All types, interfaces, and constants shared across the cognee sub-modules.
 */

// ============================================================================
// Constants
// ============================================================================

export const REQUEST_TIMEOUT_MS = 30000;
export const COGNIFY_TIMEOUT_MS = 300000; // 5 minutes for cognify operations
export const MAX_TOKEN_CACHE_SIZE = 1000;

/** Custom prompt for financial domain entity extraction during cognify */
export const FINANCIAL_COGNIFY_PROMPT =
  'Extract financial entities: merchant names, transaction categories, ' +
  'ABN numbers, GST registration status, payment methods, account references, ' +
  'recurring transaction patterns, and financial relationships between entities. ' +
  'Identify temporal patterns like weekly/monthly/quarterly transactions.';

// ============================================================================
// Types
// ============================================================================

/**
 * All 14 Cognee search types (F6).
 * Each optimized for different query types and use cases.
 */
export type CogneeSearchType =
  | 'GRAPH_COMPLETION' // Multi-hop reasoning (default)
  | 'GRAPH_COMPLETION_COT' // Chain-of-thought for complex tax queries
  | 'GRAPH_COMPLETION_CONTEXT_EXTENSION' // Multi-hop exploration
  | 'RAG_COMPLETION' // Document-grounded answers
  | 'CHUNKS' // Fast vector similarity
  | 'CHUNKS_LEXICAL' // Exact keyword matching
  | 'SUMMARIES' // Period-level overviews
  | 'GRAPH_SUMMARY_COMPLETION' // Condensed graph answers
  | 'NATURAL_LANGUAGE' // Ad-hoc graph queries
  | 'CYPHER' // Direct Cypher queries
  | 'CODE' // Codebase knowledge
  | 'FEELING_LUCKY' // Auto-select best mode
  | 'FEEDBACK' // User feedback storage
  | 'CODING_RULES'; // Memify-derived rules

/** Search result with extracted text and optional metadata */
export interface CogneeSearchResult {
  text: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

/** Cached token entry for per-user token management */
export interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}
