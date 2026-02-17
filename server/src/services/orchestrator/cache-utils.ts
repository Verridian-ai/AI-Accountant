/**
 * Cache Key Generation Utilities
 *
 * Deterministic cache key generation and context hashing
 * for agent response caching.
 */

import crypto from 'crypto';
import { AgentType } from './types.js';

/**
 * Generate a deterministic cache key from request parameters
 */
export function generateCacheKey(
  agentType: AgentType,
  query: string,
  contextHash?: string,
): string {
  const data = JSON.stringify({
    agentType,
    query: query.trim().toLowerCase(),
    contextHash,
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a hash for context data
 */
export function hashContext(context: Record<string, unknown>): string {
  const sortedContext = JSON.stringify(context, Object.keys(context).sort());
  return crypto.createHash('md5').update(sortedContext).digest('hex');
}
