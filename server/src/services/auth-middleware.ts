/**
 * Tenant-Aware Authentication Middleware (Wave 23)
 *
 * Provides Hono middleware for multi-tenant JWT authentication:
 * - tenantAuthMiddleware: Requires valid JWT + X-Tenant-Id header (strict)
 * - optionalTenantAuth: Validates JWT if present, does not require X-Tenant-Id
 * - requireRole: Checks user's role meets a minimum hierarchy level
 *
 * Attaches to Hono context: tenantId, userId, role, permissions
 */

import type { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import type { TenantRole } from './tenant-types.js';
import type { JWTPayload } from './auth-types.js';
import { adminAuthService } from './admin-auth.js';
import { tenantService } from './tenant.js';

const JWT_SECRET = process.env.JWT_SECRET || '';

// ============================================================================
// ROLE HIERARCHY
// ============================================================================

/** Numeric levels for role hierarchy comparison: higher = more privileged */
const ROLE_LEVEL: Record<TenantRole, number> = {
  viewer: 1,
  bookkeeper: 2,
  accountant: 3,
  admin: 4,
  owner: 5,
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract the raw Bearer token from the Authorization header.
 * Returns the token string or null if missing/malformed.
 */
function extractBearerToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Extract and verify the JWT from an Authorization header.
 * Returns the decoded payload or null if missing/invalid.
 */
async function extractAndVerifyToken(c: Context): Promise<JWTPayload | null> {
  const token = extractBearerToken(c);
  if (!token) return null;
  return adminAuthService.verifyTenantToken(token);
}

// ============================================================================
// tenantAuthMiddleware — Strict tenant authentication
// ============================================================================

/**
 * Requires:
 * 1. A valid JWT in the Authorization: Bearer <token> header
 * 2. An X-Tenant-Id header matching the JWT's tenantId
 * 3. The tenant must exist and be active
 * 4. The user must be a member of the tenant
 *
 * Sets on Hono context: tenantId, userId, role, permissions
 */
/** Public paths that should never be blocked by tenant auth */
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/admin/login',
  '/api/admin/refresh',
  '/api/vertex-ai/models',
  '/api/subscriptions/plans',
  '/auth/login',
  '/auth/register',
  '/health',
];

export function tenantAuthMiddleware() {
  return createMiddleware(async (c: Context, next: Next) => {
    // 0. Skip public paths (prevents sub-router middleware from blocking auth endpoints)
    const reqPath = new URL(c.req.url).pathname;
    if (PUBLIC_PATHS.some((p) => reqPath === p || reqPath === p + '/')) {
      return next();
    }

    // 1. Try tenant token first
    const payload = await extractAndVerifyToken(c);

    if (payload) {
      // Standard tenant token flow
      // 2. Extract X-Tenant-Id header
      const headerTenantId = c.req.header('X-Tenant-Id');
      if (!headerTenantId) {
        return c.json({ error: 'X-Tenant-Id header is required for all API requests' }, 403);
      }

      // 3. Verify X-Tenant-Id matches the JWT's tenantId (prevent spoofing)
      if (headerTenantId !== payload.tenantId) {
        return c.json({ error: 'X-Tenant-Id header does not match token tenant context' }, 403);
      }

      // 4. Verify tenant exists and is active
      const tenant = await tenantService.getTenant(payload.tenantId);
      if (!tenant) {
        return c.json({ error: 'Tenant not found' }, 403);
      }
      if (!tenant.isActive) {
        return c.json({ error: 'Tenant has been deactivated' }, 403);
      }

      // 5. Attach context for downstream handlers
      c.set('jwtPayload', payload);
      c.set('tenantId', payload.tenantId);
      c.set('userId', payload.userId);
      c.set('role', payload.role);
      c.set('permissions', payload.permissions);

      return next();
    }

    // 2. Tenant token failed — try admin token or legacy token as fallback
    const token = extractBearerToken(c);
    if (token) {
      // 2a. Try admin token (has adminId)
      const adminPayload = await adminAuthService.verifyToken(token);
      if (adminPayload && adminPayload.adminId) {
        // Admin super-user: bypass tenant checks, grant full access
        c.set('jwtPayload', { userId: adminPayload.adminId, ...adminPayload });
        c.set('userId', adminPayload.adminId);
        c.set('role', 'owner');
        c.set('permissions', adminPayload.permissions ?? []);
        const headerTenantId = c.req.header('X-Tenant-Id');
        if (headerTenantId) {
          c.set('tenantId', headerTenantId);
        }
        return next();
      }

      // 2b. Try legacy JWT (has userId but no tenantId — from /auth/login)
      if (JWT_SECRET) {
        try {
          const legacyPayload = (await verify(token, JWT_SECRET)) as Record<string, unknown>;
          if (legacyPayload && legacyPayload.userId) {
            c.set('jwtPayload', legacyPayload);
            c.set('userId', legacyPayload.userId as string);
            c.set('role', 'owner');
            c.set('permissions', []);
            const headerTenantId = c.req.header('X-Tenant-Id');
            if (headerTenantId) {
              c.set('tenantId', headerTenantId);
            }
            return next();
          }
        } catch {
          // Legacy token verification failed — fall through to 401
        }
      }
    }

    return c.json({ error: 'Missing or invalid authorization token' }, 401);
  });
}

// ============================================================================
// optionalTenantAuth — Lenient authentication (no X-Tenant-Id required)
// ============================================================================

/**
 * Same JWT verification as tenantAuthMiddleware, but:
 * - Does NOT require X-Tenant-Id header
 * - If JWT is present and valid, sets context variables
 * - If JWT is missing, allows the request to continue unauthenticated
 *
 * Useful for public routes, tenant creation, and invitation acceptance.
 */
export function optionalTenantAuth() {
  return createMiddleware(async (c: Context, next: Next) => {
    const payload = await extractAndVerifyToken(c);

    if (payload) {
      // If X-Tenant-Id is provided, verify it matches the token
      const headerTenantId = c.req.header('X-Tenant-Id');
      if (headerTenantId && headerTenantId !== payload.tenantId) {
        return c.json({ error: 'X-Tenant-Id header does not match token tenant context' }, 403);
      }

      // Verify tenant is still active (if tenantId is in token)
      if (payload.tenantId) {
        const tenant = await tenantService.getTenant(payload.tenantId);
        if (tenant && !tenant.isActive) {
          return c.json({ error: 'Tenant has been deactivated' }, 403);
        }
      }

      c.set('tenantId', payload.tenantId);
      c.set('userId', payload.userId);
      c.set('role', payload.role);
      c.set('permissions', payload.permissions);
    }

    return next();
  });
}

// ============================================================================
// requireRole — Role-level authorization check
// ============================================================================

/**
 * Checks that the authenticated user's role meets or exceeds the minimum role.
 * Must be used AFTER tenantAuthMiddleware or optionalTenantAuth.
 *
 * Role hierarchy (highest to lowest):
 *   owner (5) > admin (4) > accountant (3) > bookkeeper (2) > viewer (1)
 */
export function requireRole(minRole: TenantRole) {
  const requiredLevel = ROLE_LEVEL[minRole] ?? 1;

  return createMiddleware(async (c: Context, next: Next) => {
    const userRole = c.get('role') as TenantRole | undefined;

    if (!userRole) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const userLevel = ROLE_LEVEL[userRole] ?? 0;
    if (userLevel < requiredLevel) {
      return c.json(
        {
          error: `Insufficient role: requires '${minRole}' or higher, you have '${userRole}'`,
          requiredRole: minRole,
          actualRole: userRole,
        },
        403,
      );
    }

    return next();
  });
}
