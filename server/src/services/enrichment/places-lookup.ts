/**
 * Google Places Adapter — Places API (New)
 *
 * Uses the Google Places Text Search to resolve merchant names
 * to physical business details (address, type, place ID).
 *
 * Results are cached in merchantMemory keyed by a hash of the query.
 *
 * @see https://developers.google.com/maps/documentation/places/web-service/text-search
 */

import { db, merchantMemory } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';
import crypto from 'crypto';

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchText';

export interface PlacesResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  types: string[];
}

export class PlacesLookupService {
  private apiKey: string;
  private lastRequestTime = 0;
  private readonly minInterval = 1000; // 1 request per second

  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('[Places] No GOOGLE_API_KEY set — Places lookups will be unavailable');
    }
  }

  /** Whether the service is configured and available */
  get available(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Search for a place by merchant name.
   * Appends "australia" to the query for better locality matching.
   * Returns the top result or null if not found.
   */
  async searchPlace(query: string): Promise<PlacesResult | null> {
    if (!this.available) return null;
    if (!query || query.trim().length < 2) return null;

    // Check cache first
    const cached = await this.getCachedPlace(query);
    if (cached) return cached;

    // Rate limit: wait if needed
    await this.throttle();

    try {
      const response = await fetch(PLACES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.types,places.id',
        },
        body: JSON.stringify({
          textQuery: `${query.trim()} australia`,
        }),
        signal: AbortSignal.timeout(10000),
      });

      this.lastRequestTime = Date.now();

      if (!response.ok) {
        logger.warn(`[Places] API error: HTTP ${response.status}`);
        return null;
      }

      const data = await response.json() as any;

      if (!data.places || data.places.length === 0) {
        logger.debug(`[Places] No results for "${query}"`);
        return null;
      }

      const place = data.places[0];
      const result: PlacesResult = {
        placeId: place.id || '',
        name: place.displayName?.text || query,
        formattedAddress: place.formattedAddress || '',
        types: place.types || [],
      };

      return result;
    } catch (err: any) {
      logger.warn(`[Places] Search failed for "${query}": ${err.message}`);
      return null;
    }
  }

  /**
   * Cache a places result in merchantMemory keyed by query hash.
   */
  async cacheResult(userId: string, query: string, result: PlacesResult): Promise<void> {
    try {
      const cacheKey = `places:${this.hashQuery(query)}`;

      const existing = await db
        .select()
        .from(merchantMemory)
        .where(
          and(
            eq(merchantMemory.userId, userId),
            eq(merchantMemory.merchantPattern, cacheKey)
          )
        )
        .get();

      if (existing) return; // Already cached

      await db.insert(merchantMemory).values({
        id: crypto.randomUUID(),
        userId,
        merchantPattern: cacheKey,
        merchantDisplayName: result.name,
        category: result.types.length > 0 ? result.types[0] : 'Uncategorized',
        gstApplicable: false,
        timesUsed: 1,
        lastUsed: new Date().toISOString(),
        isUserConfirmed: false,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn('[Places] Failed to cache result:', err);
    }
  }

  /**
   * Check merchantMemory for a cached places result.
   */
  private async getCachedPlace(query: string): Promise<PlacesResult | null> {
    try {
      const cacheKey = `places:${this.hashQuery(query)}`;

      const records = await db
        .select()
        .from(merchantMemory)
        .where(eq(merchantMemory.merchantPattern, cacheKey))
        .all();

      if (records.length > 0) {
        const rec: any = records[0];
        logger.debug(`[Places] Cache hit for "${query}"`);
        return {
          placeId: '',
          name: rec.merchantDisplayName || query,
          formattedAddress: '',
          types: rec.category ? [rec.category] : [],
        };
      }
    } catch (err) {
      logger.warn('[Places] Cache lookup failed:', err);
    }
    return null;
  }

  /**
   * Simple rate limiter: ensure at least 1 second between requests.
   */
  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - elapsed));
    }
  }

  /**
   * Hash a query string for cache key.
   */
  private hashQuery(query: string): string {
    return crypto.createHash('md5').update(query.trim().toLowerCase()).digest('hex').slice(0, 12);
  }
}
