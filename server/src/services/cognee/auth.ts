/**
 * Cognee Client — Authentication State & Headers
 *
 * Manages authentication state for Cognee API calls:
 * - AuthState: baseUrl + token cache
 * - buildAuthHeaders: constructs auth headers for requests
 * - Token caching with LRU eviction (Wave 3)
 */

import { logger } from '../../lib/logger.js';
import type { TokenCacheEntry } from './types.js';

// ============================================================================
// AUTH STATE
// ============================================================================

export interface AuthState {
  baseUrl: string;
  tokenCache: Map<string, TokenCacheEntry>;
}

/**
 * Build authentication headers for Cognee API requests.
 * Handles per-user auth (Wave 3) with token caching.
 *
 * @param state - AuthState with baseUrl and token cache
 * @param userId - Optional user ID for per-user auth
 * @returns Headers object with Authorization if token exists
 */
export async function buildAuthHeaders(
  state: AuthState,
  userId?: string,
): Promise<Record<string, string>> {
  if (!userId) {
    // No auth when userId is not provided
    return {};
  }

  // Check token cache
  const cached = state.tokenCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return { Authorization: `Bearer ${cached.token}` };
  }

  // Token expired or missing — refresh needed
  // For now, return empty headers (refreshCogneeToken called separately)
  logger.warn(`[CogneeAuth] Token missing or expired for user ${userId}`);
  return {};
}
