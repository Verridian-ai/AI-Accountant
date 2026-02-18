/**
 * RBAC Permission Cache
 * LRU cache with TTL for fast permission lookups.
 * Avoids repeated DB queries for the same user+tenant combination.
 */

interface CacheEntry {
  permissions: string[];
  createdAt: number;
}

/**
 * In-memory LRU cache for user permissions per tenant.
 * - Key: `${tenantId}:${userId}`
 * - Value: Array of permission names
 * - TTL: 60 seconds (configurable)
 * - Max entries: 1000 (configurable)
 *
 * Cache is invalidated when: role changes, permissions updated, member removed.
 */
export class PermissionCache {
  private cache: Map<string, CacheEntry>;
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(maxEntries = 1000, ttlSeconds = 60) {
    this.cache = new Map();
    this.maxEntries = maxEntries;
    this.ttlMs = ttlSeconds * 1000;
  }

  /** Build the cache key from tenantId and userId */
  private key(tenantId: string, userId: string): string {
    return `${tenantId}:${userId}`;
  }

  /**
   * Get cached permissions for a user in a tenant.
   * Returns null if not cached or expired.
   */
  get(tenantId: string, userId: string): string[] | null {
    const k = this.key(tenantId, userId);
    const entry = this.cache.get(k);

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(k);
      return null;
    }

    // Move to end for LRU (delete + re-insert)
    this.cache.delete(k);
    this.cache.set(k, entry);

    return entry.permissions;
  }

  /**
   * Cache permissions for a user in a tenant.
   */
  set(tenantId: string, userId: string, permissions: string[]): void {
    const k = this.key(tenantId, userId);

    // If already exists, delete first (for LRU ordering)
    if (this.cache.has(k)) {
      this.cache.delete(k);
    }

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      } else {
        break;
      }
    }

    this.cache.set(k, {
      permissions,
      createdAt: Date.now(),
    });
  }

  /**
   * Invalidate cache for a specific user in a tenant.
   * Called when a user's role changes or they're removed.
   */
  invalidate(tenantId: string, userId: string): void {
    this.cache.delete(this.key(tenantId, userId));
  }

  /**
   * Invalidate all cached entries for a tenant.
   * Called when role-permission mappings change for the tenant.
   */
  invalidateTenant(tenantId: string): void {
    const prefix = `${tenantId}:`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /** Current number of entries in the cache */
  get size(): number {
    return this.cache.size;
  }
}
