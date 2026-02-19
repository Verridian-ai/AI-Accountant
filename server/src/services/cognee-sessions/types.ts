/**
 * Cognee Sessions — Type Definitions
 */

export interface CogneeSession {
  id: string;
  userId: string;
  sessionType: string;
  state: 'active' | 'paused' | 'expired';
  data: Record<string, unknown>;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: string;
  retryAfter?: number;
}

export interface RedisHealthStatus {
  connected: boolean;
  memoryUsedMb: number;
  totalKeys: number;
  uptimeSeconds: number;
  activeSessions: number;
  cachedQueries: number;
}

export interface CacheStats {
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  activeSessions: number;
  rateLimitDenials: number;
  totalCachedBytes: number;
}

// Wave 3: Cognee user-scoped session types
export interface CogneeSessionContext {
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
  activeFilters: Record<string, unknown>;
  lastQuery: string;
  lastDatasets: string[];
  datasetPrefix: string;
  cogneeSessionId?: string;
}

export interface CogneeUserSessionOptions {
  sessionType: 'chat' | 'analysis' | 'batch';
  ttlMinutes?: number;
  datasetPrefix: string;
}
