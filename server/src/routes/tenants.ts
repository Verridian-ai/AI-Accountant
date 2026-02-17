import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { tenantService } from '../services/tenant.js';
import { rbacService } from '../services/rbac.js';
import { adminAuthService } from '../services/admin-auth.js';
import { ForbiddenError } from '../services/rbac-errors.js';
import { getErrorMessage } from '../utils/error.js';
import { getUserId } from '../utils/auth-helpers.js';
import type { TenantRole } from '../services/tenant-types.js';

const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
}).passthrough();

const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  settings: z.record(z.unknown()).optional(),
}).passthrough();

const updatePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

const tenantRoutes = new Hono();

// --- TENANT ROUTES ---

tenantRoutes.post('/', zValidator('json', createTenantSchema), async (c) => {
  try {
    const userId = getUserId(c);
    const body = c.req.valid('json');
    const tenant = await tenantService.createTenant(body.name, body.slug, userId, body);
    return c.json(tenant, 201);
  } catch (err) { return c.json({ error: getErrorMessage(err) || 'Failed' }, 400); }
});

tenantRoutes.get('/', async (c) => {
  const userId = getUserId(c);
  const list = await tenantService.getMemberTenants(userId);
  return c.json({ tenants: list, count: list.length });
});

tenantRoutes.get('/:id', async (c) => {
  const tenant = await tenantService.getTenant(c.req.param('id'));
  return tenant ? c.json(tenant) : c.json({ error: 'Not found' }, 404);
});

tenantRoutes.put('/:id', zValidator('json', updateTenantSchema), async (c) => {
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

tenantRoutes.post('/:id/switch', async (c) => {
  try {
    const tenantId = c.req.param('id');
    const userId = getUserId(c);
    const context = await tenantService.switchTenant(userId, tenantId);
    const token = await adminAuthService.generateTenantToken(userId, tenantId);
    return c.json({ ...context, token });
  } catch { return c.json({ error: 'Failed' }, 400); }
});

tenantRoutes.delete('/:id', async (c) => {
  const tenantId = c.req.param('id');
  const userId = getUserId(c);
  const role = await rbacService.getRoleForUser(tenantId, userId);
  if (role !== 'owner') return c.json({ error: 'Only the owner can deactivate' }, 403);
  await tenantService.deactivateTenant(tenantId);
  return c.json({ message: 'Deactivated' });
});

// --- PERMISSIONS ---

tenantRoutes.get('/:tenantId/permissions', async (c) => {
  const tenantId = c.req.param('tenantId');
  const userId = getUserId(c);
  return c.json({ permissions: await rbacService.getUserPermissions(tenantId, userId) });
});

tenantRoutes.get('/:tenantId/permissions/matrix', async (c) => {
  return c.json({ matrix: await rbacService.getPermissionMatrix(c.req.param('tenantId')) });
});

tenantRoutes.put('/:tenantId/permissions/:role', zValidator('json', updatePermissionsSchema), async (c) => {
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
});

export default tenantRoutes;
