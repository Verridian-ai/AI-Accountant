/**
 * Citation Helper Functions
 *
 * Shared utility functions used by citation extractor and verification modules.
 */

import { logger } from '../../../lib/logger.js';
import type { ChunkMetadata } from './types.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Safely parse JSON metadata with error handling
 */
export function safeParseMetadata(metadataStr: string | null): ChunkMetadata {
  if (!metadataStr) return {};
  try {
    return JSON.parse(metadataStr) as ChunkMetadata;
  } catch (error) {
    logger.warn({ err: error }, '[CitationManager] Failed to parse chunk metadata:');
    return {};
  }
}

/**
 * Extract a relevant snippet from chunk content
 */
export function extractSnippet(chunkContent: string, _answerText: string): string {
  const maxSnippetLength = 200;

  if (chunkContent.length <= maxSnippetLength) {
    return chunkContent;
  }

  // Find sentence boundaries for cleaner snippets
  const sentences = chunkContent.split(/[.!?]+/);
  let snippet = '';

  for (const sentence of sentences) {
    if ((snippet + sentence).length > maxSnippetLength) {
      break;
    }
    snippet += sentence + '. ';
  }

  return snippet.trim() || chunkContent.slice(0, maxSnippetLength) + '...';
}
