/**
 * Economic Data Caching Layer
 *
 * Dual-layer cache: database (Drizzle ORM) + in-memory fallback.
 */

import { db, economicDataCache } from '../../schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import type { CacheEntry } from './types.js';

// In-memory cache (fallback until economic_data_cache table exists)
const memoryCache = new Map<string, CacheEntry>();

/**
 * Get cached data. If ignoreExpiry is true, returns data even if TTL has passed
 * (used as fallback when live fetch fails).
 */
export async function getFromCache(key: string, ignoreExpiry = false): Promise<unknown | null> {
  // Try database cache first (using Drizzle ORM table)
  try {
    const rows = await db
      .select()
      .from(economicDataCache)
      .where(eq(economicDataCache.dataKey, key))
      .all();

    if (rows.length > 0) {
      const row = rows[0];
      const now = new Date().toISOString();
      if (ignoreExpiry || (row.expiresAt && row.expiresAt > now)) {
        return row.dataValue ? JSON.parse(row.dataValue) : null;
      }
    }
  } catch {
    // Table may not exist yet -- fall through to memory cache
  }

  // Fall back to memory cache
  const entry = memoryCache.get(key);
  if (entry) {
    const now = new Date().toISOString();
    if (ignoreExpiry || entry.expiresAt > now) {
      return JSON.parse(entry.data);
    }
  }

  return null;
}

/**
 * Store data in cache with the given TTL.
 */
export async function setCache(key: string, data: unknown, ttlMs: number): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const jsonData = JSON.stringify(data);
  const entry: CacheEntry = {
    key,
    data: jsonData,
    fetchedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  // Try database cache (Drizzle ORM)
  try {
    // Delete existing entry for this key
    await db.delete(economicDataCache).where(eq(economicDataCache.dataKey, key)).run();
    // Insert new entry
    await db
      .insert(economicDataCache)
      .values({
        id: crypto.randomUUID(),
        dataSource: key.startsWith('rba') ? 'rba' : 'abs',
        dataKey: key,
        dataValue: jsonData,
        fetchedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      })
      .run();
  } catch {
    // Table may not exist yet -- memory cache only
  }

  // Always update memory cache as fallback
  memoryCache.set(key, entry);
}

/**
 * Fetch a URL with timeout and basic error handling.
 */
export async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GoldLedger/1.0 (Financial Data Aggregator)',
        Accept: 'text/html,text/csv,application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}
