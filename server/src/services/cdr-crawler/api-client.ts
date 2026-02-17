/**
 * CDR Open Banking Crawler — API Client
 *
 * HTTP client with per-holder rate limiting and exponential retry on 429/5xx.
 */

import type { CdrCrawlerConfig, CrawlError } from './types.js';
import { logger } from '../../lib/logger.js';

// ============================================================================
// Rate Limiter
// ============================================================================

export class PerHolderRateLimiter {
  private lastRequestTime = new Map<string, number>();
  private minGapMs: number;

  constructor(requestsPerSecond: number) {
    this.minGapMs = Math.max(500, Math.ceil(1000 / requestsPerSecond));
  }

  async wait(holderId: string): Promise<void> {
    const now = Date.now();
    const lastTime = this.lastRequestTime.get(holderId) ?? 0;
    const elapsed = now - lastTime;

    if (elapsed < this.minGapMs) {
      const delay = this.minGapMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime.set(holderId, Date.now());
  }
}

// ============================================================================
// HTTP Fetch with Retry
// ============================================================================

export async function fetchWithRetry(
  url: string,
  holderId: string,
  stage: CrawlError['stage'],
  config: CdrCrawlerConfig,
  rateLimiter: PerHolderRateLimiter,
): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < config.retryAttempts; attempt++) {
    await rateLimiter.wait(holderId);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          'x-v': '4',
          Accept: 'application/json',
          'User-Agent': config.userAgent,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') ?? '5', 10);
        const backoff = Math.max(retryAfter * 1000, config.retryDelayMs * Math.pow(2, attempt));
        logger.warn(
          `[CDR] 429 from ${holderId}, retrying in ${backoff}ms (attempt ${attempt + 1})`,
        );
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      if (response.status >= 500) {
        const backoff = config.retryDelayMs * Math.pow(2, attempt);
        logger.warn(
          `[CDR] ${response.status} from ${holderId}, retrying in ${backoff}ms (attempt ${attempt + 1})`,
        );
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
      }

      return await response.json();
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;

      if (err.name === 'AbortError') {
        logger.warn(`[CDR] Timeout for ${holderId} (attempt ${attempt + 1})`);
      }

      if (attempt < config.retryAttempts - 1) {
        const backoff = config.retryDelayMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url} after retries`);
}
