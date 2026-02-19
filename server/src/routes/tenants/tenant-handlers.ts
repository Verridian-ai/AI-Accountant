import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { tenantService } from '../../services/tenant.js';
import { rbacService } from '../../services/rbac.js';
import { adminAuthService } from '../../services/admin-auth.js';
import { ForbiddenError } from '../../services/rbac-errors.js';
import { getErrorMessage } from '../../utils/error.js';
import { getUserId } from '../../utils/auth-helpers.js';
import type { TenantRole } from '../../services/tenant-types.js';
import { db, tenantMembers } from '../../schema.js';
import { and, eq } from 'drizzle-orm';
import { createTenantSchema, updateTenantSchema, updatePermissionsSchema } from './schemas.js';

export function registerTenantHandlers(app: Hono): void {
  // POST / — Create tenant
  app.post('/', zValidator('json', createTenantSchema), async (c) => {
    try {
      const userId = getUserId(c);
      const body = c.req.valid('json');
      const tenant = await tenantService.createTenant(
        body.name,
        body.slug,
        userId,
        body as unknown as import('../../services/tenant-types.js').CreateTenantOptions,
      );
      return c.json(tenant, 201);
    } catch (err) {
      return c.json({ error: getErrorMessage(err) || 'Failed' }, 400);
    }
  });

  // GET / — List tenants
  app.get('/', async (c) => {
    const userId = getUserId(c);
    const list = await tenantService.getMemberTenants(userId);
    return c.json({ tenants: list, count: list.length });
  });

  // GET /:id
  app.get('/:id', async (c) => {
    const tenant = await tenantService.getTenant(c.req.param('id'));
    return tenant ? c.json(tenant) : c.json({ error: 'Not found' }, 404);
  });

  // PUT /:id — Update tenant
  app.put('/:id', zValidator('json', updateTenantSchema), async (c) => {
    try {
      const tenantId = c.req.param('id');
      const userId = getUserId(c);
      await rbacService.requirePermission(tenantId, userId, 'settings.manage');
      const body = c.req.valid('json');
      return c.json(await tenantService.updateTenant(tenantId, body));
    } catch (err) {
      if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
      return c.json({ error: 'Failed' }, 400);
    }
  });

  // POST /:id/switch — Switch active tenant
  app.post('/:id/switch', async (c) => {
    try {
      const tenantId = c.req.param('id');
      const userId = getUserId(c);
      const membership = await db
        .select()
        .from(tenantMembers)
        .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
        .get();
      if (!membership) return c.json({ error: 'User is not a member of this tenant' }, 403);
      const context = await tenantService.switchTenant(userId, tenantId);
      const token = await adminAuthService.generateTenantToken(userId, tenantId);
      return c.json({ ...context, token });
    } catch (err: unknown) {
      if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
      return c.json({ error: 'Failed' }, 400);
    }
  });

  // DELETE /:id — Deactivate tenant
  app.delete('/:id', async (c) => {
    const tenantId = c.req.param('id');
    const userId = getUserId(c);
    const role = await rbacService.getRoleForUser(tenantId, userId);
    if (role !== 'owner') return c.json({ error: 'Only the owner can deactivate' }, 403);
    await tenantService.deactivateTenant(tenantId);
    return c.json({ message: 'Deactivated' });
  });

  // GET /:tenantId/permissions
  app.get('/:tenantId/permissions', async (c) => {
    const tenantId = c.req.param('tenantId');
    const userId = getUserId(c);
    return c.json({ permissions: await rbacService.getUserPermissions(tenantId, userId) });
  });

  // GET /:tenantId/permissions/matrix
  app.get('/:tenantId/permissions/matrix', async (c) => {
    return c.json({ matrix: await rbacService.getPermissionMatrix(c.req.param('tenantId')) });
  });

  // PUT /:tenantId/permissions/:role
  app.put(
    '/:tenantId/permissions/:role',
    zValidator('json', updatePermissionsSchema),
    async (c) => {
      try {
        const tenantId = c.req.param('tenantId');
        const role = c.req.param('role');
        const userId = getUserId(c);
        const { permissions } = c.req.valid('json');
        await rbacService.updateRolePermissions(tenantId, role as TenantRole, permissions, userId);
        return c.json({ message: 'Updated' });
      } catch (err) {
        if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
        return c.json({ error: 'Failed' }, 400);
      }
    },
  );

  // POST /:tenantId/permissions/reset
  app.post('/:tenantId/permissions/reset', async (c) => {
    try {
      const tenantId = c.req.param('tenantId');
      const userId = getUserId(c);
      const role = await rbacService.getRoleForUser(tenantId, userId);
      if (role !== 'owner')
        return c.json({ error: 'Only tenant owners can reset permissions' }, 403);
      await rbacService.resetToDefaults(tenantId);
      return c.json({ message: 'Permissions reset to defaults' });
    } catch (err: unknown) {
      return c.json({ error: getErrorMessage(err) || 'Failed to reset permissions' }, 500);
    }
  });
}
