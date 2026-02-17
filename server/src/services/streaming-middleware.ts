/**
 * Streaming Middleware (Wave 21)
 *
 * Hono middleware for SSE streaming endpoints:
 * - `sseStreamMiddleware()` — Sets correct SSE headers including nginx buffering disable
 * - `streamingRateLimiter()` — Limits concurrent streams per user (max 5)
 */

import { createMiddleware } from 'hono/factory';

// ============================================================================
// SSE STREAM MIDDLEWARE
// ============================================================================

/**
 * Hono middleware that sets the required headers for Server-Sent Events.
 *
 * Headers set:
 * - Content-Type: text/event-stream
 * - Cache-Control: no-cache
 * - Connection: keep-alive
 * - X-Accel-Buffering: no  (tells nginx to disable response buffering)
 */
export function sseStreamMiddleware() {
  return createMiddleware(async (c, next) => {
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');
    return next();
  });
}

// ============================================================================
// STREAMING RATE LIMITER
// ============================================================================

/** Tracks active concurrent stream count per userId */
const activeStreams = new Map<string, number>();

/**
 * Maximum number of concurrent streams allowed per user.
 */
const MAX_CONCURRENT_STREAMS = 5;

/**
 * Hono middleware that limits concurrent SSE streams per user.
 *
 * Expects `userId` to be available via `c.get('userId')` or falls back
 * to `c.req.query('userId')` or the string `'anonymous'`.
 *
 * When a user exceeds the limit, responds with `429 Too Many Requests`.
 *
 * The middleware increments the counter before the handler runs and
 * decrements it after the handler completes (or errors).
 */
export function streamingRateLimiter() {
  return createMiddleware(async (c, next) => {
    const userId: string =
      (c.get('userId') as string | undefined) ?? c.req.query('userId') ?? 'anonymous';

    const current = activeStreams.get(userId) ?? 0;

    if (current >= MAX_CONCURRENT_STREAMS) {
      return c.json(
        {
          error: 'Too many concurrent streams',
          maxConcurrent: MAX_CONCURRENT_STREAMS,
          active: current,
        },
        429,
      );
    }

    // Increment
    activeStreams.set(userId, current + 1);

    try {
      return next();
    } finally {
      // Decrement (ensure it never goes below 0)
      const after = activeStreams.get(userId) ?? 1;
      if (after <= 1) {
        activeStreams.delete(userId);
      } else {
        activeStreams.set(userId, after - 1);
      }
    }
  });
}

/**
 * Get the current number of active streams for a user.
 * Useful for diagnostics / admin endpoints.
 */
export function getActiveStreamCount(userId: string): number {
  return activeStreams.get(userId) ?? 0;
}

/**
 * Get total active streams across all users.
 */
export function getTotalActiveStreams(): number {
  let total = 0;
  for (const count of activeStreams.values()) {
    total += count;
  }
  return total;
}
