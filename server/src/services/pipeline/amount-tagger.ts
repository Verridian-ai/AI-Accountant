/**
 * Amount Tagger (v4 Pipeline)
 *
 * Replaces real dollar amounts in query results with [[amt:uuid]] tags
 * before sending data to a cloud LLM.  Real values are stored in Redis
 * with a per-session TTL so the StreamingUnredactor can swap them back
 * inline as Claude streams its response.
 *
 * Tag format:  [[amt:<uuid>]]
 * Redis key:   amt:<sessionId>:<uuid>
 * TTL:         1 hour (3600s)
 */

import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';

const AMT_TTL_SECONDS = 3600; // 1 hour

// ---------------------------------------------------------------------------
// AmountTagger
// ---------------------------------------------------------------------------

export class AmountTagger {
  private redis: Redis;

  constructor(redisUrl?: string) {
    const url = redisUrl ?? config.redisUrl;
    if (!url) {
      logger.warn('[AmountTagger] No REDIS_URL configured — tags will not persist');
    }
    this.redis = new Redis(url || 'redis://localhost:6379', {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      enableReadyCheck: false,
    });
    this.redis.on('error', (err: Error) => {
      logger.warn(`[AmountTagger] Redis error: ${err.message}`);
    });
  }

  // -------------------------------------------------------------------------
  // Tag a single object
  // -------------------------------------------------------------------------

  async tagObject<T extends Record<string, unknown>>(
    obj: T,
    amountFields: string[],
    sessionId: string,
  ): Promise<{ tagged: T; tokenMap: Map<string, string> }> {
    const tokenMap = new Map<string, string>();
    const tagged = { ...obj } as Record<string, unknown>;

    for (const field of amountFields) {
      const value = obj[field];
      if (value === undefined || value === null) continue;

      const uuid = randomUUID();
      const tag = `[[amt:${uuid}]]`;
      const realFormatted = this.formatCurrency(Number(value));

      tokenMap.set(tag, realFormatted);
      tagged[field] = tag;

      // Store in Redis (fire-and-forget for performance; errors logged)
      this.storeTag(sessionId, uuid, realFormatted);
    }

    return { tagged: tagged as T, tokenMap };
  }

  // -------------------------------------------------------------------------
  // Tag an array of objects
  // -------------------------------------------------------------------------

  async tagObjects<T extends Record<string, unknown>>(
    objects: T[],
    amountFields: string[],
    sessionId: string,
  ): Promise<{ tagged: T[]; tokenMap: Map<string, string> }> {
    const mergedMap = new Map<string, string>();
    const taggedObjects: T[] = [];

    for (const obj of objects) {
      const { tagged, tokenMap } = await this.tagObject(obj, amountFields, sessionId);
      taggedObjects.push(tagged);
      for (const [k, v] of tokenMap) {
        mergedMap.set(k, v);
      }
    }

    return { tagged: taggedObjects, tokenMap: mergedMap };
  }

  // -------------------------------------------------------------------------
  // Resolve a single tag back to its real value
  // -------------------------------------------------------------------------

  async resolveTag(tagId: string, sessionId: string): Promise<string | null> {
    try {
      return await this.redis.get(`amt:${sessionId}:${tagId}`);
    } catch (err) {
      logger.warn(
        `[AmountTagger] Failed to resolve tag ${tagId}:`,
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Clear all tags for a session
  // -------------------------------------------------------------------------

  async clearSession(sessionId: string): Promise<void> {
    try {
      const stream = this.redis.scanStream({
        match: `amt:${sessionId}:*`,
        count: 100,
      });

      const keysToDelete: string[] = [];
      for await (const keys of stream) {
        keysToDelete.push(...(keys as string[]));
      }

      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
        logger.info(`[AmountTagger] Cleared ${keysToDelete.length} tags for session ${sessionId}`);
      }
    } catch (err) {
      logger.warn(
        `[AmountTagger] Failed to clear session ${sessionId}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // -------------------------------------------------------------------------
  // Disconnect Redis
  // -------------------------------------------------------------------------

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Format an integer amount (cents) to AUD currency string.
   * e.g. 4500000 → "$45,000.00"
   */
  private formatCurrency(cents: number): string {
    const dollars = cents / 100;
    const formatted = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(dollars);
    return formatted;
  }

  private storeTag(sessionId: string, uuid: string, realValue: string): void {
    const key = `amt:${sessionId}:${uuid}`;
    this.redis.set(key, realValue, 'EX', AMT_TTL_SECONDS).catch((err: Error) => {
      logger.warn(`[AmountTagger] Failed to store tag ${key}: ${err.message}`);
    });
  }
}
