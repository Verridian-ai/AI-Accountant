/**
 * Agent Response Cache
 *
 * LRU (Least Recently Used) cache for agent responses with TTL support.
 * Reduces redundant agent executions and improves response times.
 */

import crypto from 'crypto';
import {
  AgentType,
  AgentResponse,
  CacheEntry,
  CacheConfig,
  CacheStats,
  DEFAULT_CACHE_CONFIG,
} from './types.js';

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

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

// ============================================================================
// LRU CACHE IMPLEMENTATION
// ============================================================================

interface CacheNode {
  key: string;
  entry: CacheEntry;
  prev: CacheNode | null;
  next: CacheNode | null;
}

export class AgentResponseCache {
  private cache: Map<string, CacheNode> = new Map();
  private head: CacheNode | null = null;
  private tail: CacheNode | null = null;
  private config: CacheConfig;

  // Statistics
  private totalHits: number = 0;
  private totalMisses: number = 0;
  private totalEvictions: number = 0;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  /**
   * Get a cached response
   */
  get(key: string): AgentResponse | null {
    if (!this.config.enabled) {
      this.totalMisses++;
      return null;
    }

    const node = this.cache.get(key);

    if (!node) {
      this.totalMisses++;
      return null;
    }

    // Check if expired
    if (new Date(node.entry.expiresAt) < new Date()) {
      this.delete(key);
      this.totalMisses++;
      return null;
    }

    // Update access tracking
    node.entry.hitCount++;
    node.entry.lastAccessedAt = new Date().toISOString();

    // Move to front (most recently used)
    this.moveToFront(node);

    this.totalHits++;
    return node.entry.response;
  }

  /**
   * Store a response in cache
   */
  set(key: string, response: AgentResponse, ttlMs?: number): void {
    if (!this.config.enabled) {
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (ttlMs || this.config.defaultTtlMs));

    const entry: CacheEntry = {
      key,
      response: { ...response, fromCache: true },
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      hitCount: 0,
      lastAccessedAt: now.toISOString(),
    };

    // Check if key already exists
    const existingNode = this.cache.get(key);
    if (existingNode) {
      existingNode.entry = entry;
      this.moveToFront(existingNode);
      return;
    }

    // Evict if at capacity
    while (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    // Create new node
    const newNode: CacheNode = {
      key,
      entry,
      prev: null,
      next: this.head,
    };

    if (this.head) {
      this.head.prev = newNode;
    }
    this.head = newNode;

    if (!this.tail) {
      this.tail = newNode;
    }

    this.cache.set(key, newNode);
  }

  /**
   * Delete a cache entry
   */
  delete(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) {
      return false;
    }

    this.removeNode(node);
    this.cache.delete(key);
    return true;
  }

  /**
   * Clear all entries for a specific agent type
   */
  clearByAgent(agentType: AgentType): number {
    // Collect keys first to avoid modifying map during iteration
    const keysToDelete: string[] = [];
    for (const [key, node] of this.cache.entries()) {
      if (node.entry.response.agentType === agentType) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.delete(key);
    }
    return keysToDelete.length;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = new Date();
    // Collect keys first to avoid modifying map during iteration
    const keysToDelete: string[] = [];

    for (const [key, node] of this.cache.entries()) {
      if (new Date(node.entry.expiresAt) < now) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }

    return keysToDelete.length;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entriesByAgent: Record<AgentType, number> = {
      'financial-analyst': 0,
      bas: 0,
      tax: 0,
      reconciliation: 0,
    };

    let oldestEntry: string | undefined;
    let sizeBytes = 0;

    for (const node of this.cache.values()) {
      const agentType = node.entry.response.agentType;
      entriesByAgent[agentType]++;

      // Estimate size
      sizeBytes += JSON.stringify(node.entry).length * 2; // Rough UTF-16 estimate

      // Track oldest
      if (!oldestEntry || node.entry.createdAt < oldestEntry) {
        oldestEntry = node.entry.createdAt;
      }
    }

    const totalRequests = this.totalHits + this.totalMisses;

    return {
      totalEntries: this.cache.size,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      hitRate: totalRequests > 0 ? this.totalHits / totalRequests : 0,
      sizeBytes,
      oldestEntry,
      entriesByAgent,
    };
  }

  /**
   * Check if cache is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable cache
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Update cache configuration
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };

    // If max entries reduced, evict excess
    while (this.cache.size > this.config.maxEntries) {
      this.evictLRU();
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private moveToFront(node: CacheNode): void {
    if (node === this.head) {
      return;
    }

    this.removeNode(node);

    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: CacheNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private evictLRU(): void {
    if (!this.tail) {
      return;
    }

    const key = this.tail.key;
    this.removeNode(this.tail);
    this.cache.delete(key);
    this.totalEvictions++;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const agentCache = new AgentResponseCache();

// Periodic cleanup with stored reference for proper cleanup
let cleanupInterval: NodeJS.Timeout | null = null;

export function startCacheCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(
    () => {
      agentCache.cleanup();
    },
    5 * 60 * 1000,
  ); // 5 minutes
}

export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Auto-start cleanup
startCacheCleanup();

// Cleanup on process exit
process.on('beforeExit', () => {
  stopCacheCleanup();
});
