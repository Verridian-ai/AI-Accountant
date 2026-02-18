// ============================================================================
// TYPES — Cognee Client
// ============================================================================

/**
 * Cognee search types available in v0.5.2.
 * Use the appropriate type for each use case to balance speed vs intelligence.
 */
export type CogneeSearchType =
  | 'SUMMARIES'
  | 'CHUNKS'
  | 'RAG_COMPLETION'
  | 'TRIPLET_COMPLETION'
  | 'GRAPH_COMPLETION'
  | 'GRAPH_SUMMARY_COMPLETION'
  | 'CYPHER'
  | 'NATURAL_LANGUAGE'
  | 'GRAPH_COMPLETION_COT'
  | 'GRAPH_COMPLETION_CONTEXT_EXTENSION'
  | 'FEELING_LUCKY'
  | 'TEMPORAL'
  | 'CODING_RULES'
  | 'CHUNKS_LEXICAL';

/** Search result with extracted text and optional metadata */
export interface CogneeSearchResult {
  text: string;
  score?: number;
  metadata?: Record<string, unknown>;
}
