/**
 * JWT Authentication Middleware
 *
 * Provides a standalone auth middleware for routes that want userId extraction.
 * - If JWT_SECRET is set: validates Bearer token, extracts userId
 * - If JWT_SECRET is NOT set: development mode — allows all requests with a warning
 *
 * Note: The main /api/* routes already use Hono's built-in jwt() middleware
 * which sets `jwtPayload`. This middleware is provided for new endpoints or
 * explicit per-route auth control.
 */

import type { Context, Next } from 'hono';
import { verify } from 'hono/jwt';

const JWT_SECRET = process.env.JWT_SECRET;

// Log once at startup
if (!JWT_SECRET) {
  console.warn('[Auth] WARNING: JWT_SECRET not set — running in development mode (no auth)');
}

/**
 * Auth middleware for /api/* routes.
 * Skips auth for health/status endpoints.
 * Sets `userId` on context from JWT payload.
 */
export function authMiddleware() {
  return async (c: Context, next: Next) => {
    // Skip auth for health/status endpoints
    const path = c.req.path;
    if (path === '/api/health' || path === '/api/agents/status') {
      return next();
    }

    // Development mode — no auth required
    if (!JWT_SECRET) {
      c.set('userId', 'dev-user');
      return next();
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Authentication required', code: 401 }, 401);
    }

    try {
      const token = authHeader.slice(7);
      const payload = await verify(token, JWT_SECRET);
      const userId = (payload as Record<string, unknown>).userId;
      c.set('userId', typeof userId === 'string' ? userId : 'unknown');
      return next();
    } catch {
      return c.json({ error: 'Invalid or expired token', code: 401 }, 401);
    }
  };
}
