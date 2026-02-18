/**
 * RBAC — Hono middleware factories
 */

import type { Context, Next } from 'hono';
import type { TenantRole } from '../tenant-types.js';
import { ForbiddenError } from '../rbac-errors.js';
import { PermissionCache } from '../rbac-cache.js';
import {
  ROLE_LEVEL,
  getRoleForUser,
  requirePermission as requirePermissionFn,
} from './permission-checking.js';

export function createPermissionMiddlewareImpl(cache: PermissionCache, permission: string) {
  return async (c: Context, next: Next) => {
    const tenantId = c.req.header('X-Tenant-Id');
    const userId = c.get('userId') as string | undefined;

    if (!tenantId) {
      return c.json({ error: 'X-Tenant-Id header is required', code: 400 }, 400);
    }
    if (!userId) {
      return c.json({ error: 'Authentication required', code: 401 }, 401);
    }

    try {
      await requirePermissionFn(cache, tenantId, userId, permission);
      return next();
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json(
          {
            error: `Forbidden: missing permission '${permission}'`,
            code: 403,
            permission,
          },
          403,
        );
      }
      throw err;
    }
  };
}

export function createRoleMiddlewareImpl(cache: PermissionCache, minRole: TenantRole) {
  const requiredLevel = ROLE_LEVEL[minRole];

  return async (c: Context, next: Next) => {
    const tenantId = c.req.header('X-Tenant-Id');
    const userId = c.get('userId') as string | undefined;

    if (!tenantId) {
      return c.json({ error: 'X-Tenant-Id header is required', code: 400 }, 400);
    }
    if (!userId) {
      return c.json({ error: 'Authentication required', code: 401 }, 401);
    }

    const userRole = await getRoleForUser(tenantId, userId);
    if (!userRole) {
      return c.json({ error: 'Not a member of this tenant', code: 403 }, 403);
    }

    const userLevel = ROLE_LEVEL[userRole] ?? 0;
    if (userLevel < requiredLevel) {
      return c.json(
        {
          error: `Insufficient role: requires '${minRole}', you have '${userRole}'`,
          code: 403,
          requiredRole: minRole,
          actualRole: userRole,
        },
        403,
      );
    }

    return next();
  };
}
