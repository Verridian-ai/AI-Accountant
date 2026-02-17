/**
 * Admin Authorization Middleware
 *
 * Hono middleware that verifies admin JWT from Authorization: Bearer <token>
 * and optionally checks for a specific permission.
 *
 * Defined locally (no back-import from parent monolith).
 */

import { createMiddleware } from 'hono/factory';
import { verifyToken } from './authentication.js';

/**
 * Hono middleware that verifies admin JWT from Authorization: Bearer <token>
 * and optionally checks for a specific permission.
 */
export function adminAuthMiddleware(requiredPermission?: string) {
  return createMiddleware(async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid authorization header' }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    if (payload.type !== 'access') {
      return c.json({ error: 'Invalid token type' }, 401);
    }

    // Check required permission
    if (requiredPermission) {
      const hasPermission =
        payload.role === 'super_admin' || payload.permissions.includes(requiredPermission);
      if (!hasPermission) {
        return c.json({ error: 'Insufficient permissions' }, 403);
      }
    }

    // Attach admin payload to context
    c.set('admin', payload);
    return next();
  });
}
