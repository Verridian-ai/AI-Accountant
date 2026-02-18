/**
 * Agent Response Cache — Core Implementation
 *
 * LRU cache class with TTL support for agent responses.
 * Uses CacheNode from cache-lru.ts and utilities from cache-utils.ts.
 */

import {
  AgentType,
  AgentResponse,
  CacheEntry,
  CacheConfig,
  CacheStats,
  DEFAULT_CACHE_CONFIG,
} from './types.js';
import type { CacheNode } from './cache-lru.js';

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

    if (new Date(node.entry.expiresAt) < new Date()) {
      this.delete(key);
      this.totalMisses++;
      return null;
    }

    node.entry.hitCount++;
    node.entry.lastAccessedAt = new Date().toISOString();
    this.moveToFront(node);
    this.totalHits++;
    return node.entry.response;
  }

  set(key: string, response: AgentResponse, ttlMs?: number): void {
    if (!this.config.enabled) return;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (ttlMs ?? this.config.defaultTtlMs));

    const entry: CacheEntry = {
      key,
      response: { ...response, fromCache: true },
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      hitCount: 0,
      lastAccessedAt: now.toISOString(),
    };

    const existingNode = this.cache.get(key);
    if (existingNode) {
      existingNode.entry = entry;
      this.moveToFront(existingNode);
      return;
    }

    while (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    const newNode: CacheNode = { key, entry, prev: null, next: this.head };
    if (this.head) this.head.prev = newNode;
    this.head = newNode;
    if (!this.tail) this.tail = newNode;
    this.cache.set(key, newNode);
  }

  delete(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;
    this.removeNode(node);
    this.cache.delete(key);
    return true;
  }

  clearByAgent(agentType: AgentType): number {
    const keysToDelete: string[] = [];
    for (const [key, node] of this.cache.entries()) {
      if (node.entry.response.agentType === agentType) keysToDelete.push(key);
    }
    for (const key of keysToDelete) this.delete(key);
    return keysToDelete.length;
  }

  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }

  cleanup(): number {
    const now = new Date();
    const keysToDelete: string[] = [];
    for (const [key, node] of this.cache.entries()) {
      if (new Date(node.entry.expiresAt) < now) keysToDelete.push(key);
    }
    for (const key of keysToDelete) this.delete(key);
    return keysToDelete.length;
  }

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
      sizeBytes += JSON.stringify(node.entry).length * 2;
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

  isEnabled(): boolean {
    return this.config.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    while (this.cache.size > this.config.maxEntries) {
      this.evictLRU();
    }
  }

  // ============================================================================
  // PRIVATE LINKED-LIST HELPERS
  // ============================================================================

  private moveToFront(node: CacheNode): void {
    if (node === this.head) return;
    this.removeNode(node);
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private removeNode(node: CacheNode): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
  }

  private evictLRU(): void {
    if (!this.tail) return;
    const key = this.tail.key;
    this.removeNode(this.tail);
    this.cache.delete(key);
    this.totalEvictions++;
  }
}

// ============================================================================
// SINGLETON + LIFECYCLE
// ============================================================================

export const agentCache = new AgentResponseCache();

let cleanupInterval: NodeJS.Timeout | null = null;

export function startCacheCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(
    () => {
      agentCache.cleanup();
    },
    5 * 60 * 1000,
  );
}

export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

startCacheCleanup();
process.on('beforeExit', () => {
  stopCacheCleanup();
});
