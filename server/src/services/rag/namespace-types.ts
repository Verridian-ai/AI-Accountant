/**
 * Namespace Manager Types and Constants
 *
 * Type definitions and default configuration for the RAG namespace management system.
 */

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
