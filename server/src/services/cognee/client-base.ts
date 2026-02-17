/**
 * Cognee Client Base Class
 *
 * Base class for CogneeClient with core authentication state management.
 * Extended by CogneeClient in client.ts.
 */

import type { AuthState } from './auth.js';
import type { TokenCacheEntry } from './types.js';

export class CogneeClientBase {
  protected state: AuthState;

  constructor(baseUrl?: string) {
    this.state = {
      baseUrl: baseUrl || process.env.COGNEE_API_URL || 'http://localhost:8000',
      tokenCache: new Map<string, TokenCacheEntry>(),
    };
  }

  /**
   * Get the current base URL.
   */
  getBaseUrl(): string {
    return this.state.baseUrl;
  }

  /**
   * Update the base URL for Cognee API.
   */
  setBaseUrl(url: string): void {
    this.state.baseUrl = url;
  }

  /**
   * Clear the token cache.
   */
  clearTokenCache(): void {
    this.state.tokenCache.clear();
  }
}
