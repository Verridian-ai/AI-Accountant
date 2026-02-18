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
import { tenantAuthMiddleware } from '../services/auth-middleware.js';
import { subscriptionService } from '../services/subscriptions.js';

const createTenantSchema = z
  .object({
    name: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/),
  })
  .passthrough();

const updateTenantSchema = z
  .object({
    name: z.string().min(1).optional(),
    settings: z.record(z.unknown()).optional(),
  })
  .passthrough();

const updatePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

const tenantRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
tenantRoutes.use('/*', tenantAuthMiddleware());

// --- TENANT ROUTES ---

tenantRoutes.post('/', zValidator('json', createTenantSchema), async (c) => {
  try {
    const userId = getUserId(c);
    const body = c.req.valid('json');
    const tenant = await tenantService.createTenant(
      body.name,
      body.slug,
      userId,
      body as unknown as import('../services/tenant-types.js').CreateTenantOptions,
    );
    return c.json(tenant, 201);
  } catch (err) {
    return c.json({ error: getErrorMessage(err) || 'Failed' }, 400);
  }
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
  } catch {
    return c.json({ error: 'Failed' }, 400);
  }
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

tenantRoutes.put(
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

// --- MEMBER ROUTES (wave 23 tenant-prefixed) ---

tenantRoutes.get('/:tenantId/members', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const userId = getUserId(c);
    await rbacService.requirePermission(tenantId, userId, 'members.read');
    const members = await tenantService.getMembers(tenantId);
    const invitations = await tenantService.getPendingInvitations(tenantId);
    return c.json({
      members,
      invitations,
      memberCount: members.length,
      pendingCount: invitations.length,
    });
  } catch (err: unknown) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: getErrorMessage(err) || 'Failed to list members' }, 500);
  }
});

tenantRoutes.post('/:tenantId/members', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const userId = getUserId(c);
    await rbacService.requirePermission(tenantId, userId, 'members.manage');
    const body = (await c.req.json()) as { userId: string; role: string };
    if (!body.userId || !body.role) return c.json({ error: 'userId and role are required' }, 400);
    const member = await tenantService.addMember(
      tenantId,
      body.userId,
      body.role as TenantRole,
      userId,
    );
    return c.json(member, 201);
  } catch (err: unknown) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: getErrorMessage(err) || 'Failed to add member' }, 400);
  }
});

tenantRoutes.put('/:tenantId/members/:userId/role', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const targetUserId = c.req.param('userId');
    const currentUserId = getUserId(c);
    await rbacService.requirePermission(tenantId, currentUserId, 'members.manage');
    const body = (await c.req.json()) as { role: string };
    if (!body.role) return c.json({ error: 'role is required' }, 400);
    return c.json(
      await tenantService.updateMemberRole(tenantId, targetUserId, body.role as TenantRole),
    );
  } catch (err: unknown) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: getErrorMessage(err) || 'Failed to update member role' }, 400);
  }
});

tenantRoutes.delete('/:tenantId/members/:userId', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const targetUserId = c.req.param('userId');
    const currentUserId = getUserId(c);
    await rbacService.requirePermission(tenantId, currentUserId, 'members.manage');
    await tenantService.removeMember(tenantId, targetUserId);
    return c.json({ message: 'Member removed successfully' });
  } catch (err: unknown) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: getErrorMessage(err) || 'Failed to remove member' }, 400);
  }
});

tenantRoutes.post('/:tenantId/invitations', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const userId = getUserId(c);
    await rbacService.requirePermission(tenantId, userId, 'members.manage');
    const body = (await c.req.json()) as { email: string; role: string };
    if (!body.email || !body.role) return c.json({ error: 'email and role are required' }, 400);
    const invitation = await tenantService.inviteMember(
      tenantId,
      body.email,
      body.role as TenantRole,
      userId,
    );
    return c.json(invitation, 201);
  } catch (err: unknown) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: getErrorMessage(err) || 'Failed to send invitation' }, 400);
  }
});

tenantRoutes.post('/:tenantId/permissions/reset', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const userId = getUserId(c);
    const role = await rbacService.getRoleForUser(tenantId, userId);
    if (role !== 'owner') return c.json({ error: 'Only tenant owners can reset permissions' }, 403);
    await rbacService.resetToDefaults(tenantId);
    return c.json({ message: 'Permissions reset to defaults' });
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) || 'Failed to reset permissions' }, 500);
  }
});

// --- SUBSCRIPTION ROUTES (tenant-prefixed) ---

tenantRoutes.get('/:tenantId/subscription', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const subscription = await subscriptionService.getCurrentSubscription(tenantId);
    const usage = await subscriptionService.getUsage(tenantId);
    return c.json({ subscription, usage });
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) || 'Failed to get subscription' }, 500);
  }
});

tenantRoutes.post('/:tenantId/subscription', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const userId = getUserId(c);
    await rbacService.requirePermission(tenantId, userId, 'settings.manage');
    const body = (await c.req.json()) as { planName: string; billingCycle?: 'monthly' | 'annual' };
    if (!body.planName) return c.json({ error: 'planName is required' }, 400);
    return c.json(
      await subscriptionService.subscribe(tenantId, body.planName, body.billingCycle),
      201,
    );
  } catch (err: unknown) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: getErrorMessage(err) || 'Failed to subscribe' }, 400);
  }
});

tenantRoutes.put('/:tenantId/subscription/upgrade', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const userId = getUserId(c);
    await rbacService.requirePermission(tenantId, userId, 'settings.manage');
    const body = (await c.req.json()) as { newPlanName: string };
    if (!body.newPlanName) return c.json({ error: 'newPlanName is required' }, 400);
    return c.json(await subscriptionService.upgrade(tenantId, body.newPlanName));
  } catch (err: unknown) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: getErrorMessage(err) || 'Failed to upgrade' }, 400);
  }
});

tenantRoutes.put('/:tenantId/subscription/downgrade', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const userId = getUserId(c);
    await rbacService.requirePermission(tenantId, userId, 'settings.manage');
    const body = (await c.req.json()) as { newPlanName: string };
    if (!body.newPlanName) return c.json({ error: 'newPlanName is required' }, 400);
    return c.json(await subscriptionService.downgrade(tenantId, body.newPlanName));
  } catch (err: unknown) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: getErrorMessage(err) || 'Failed to downgrade' }, 400);
  }
});

tenantRoutes.delete('/:tenantId/subscription', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const userId = getUserId(c);
    await rbacService.requirePermission(tenantId, userId, 'settings.manage');
    return c.json(await subscriptionService.cancel(tenantId));
  } catch (err: unknown) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: getErrorMessage(err) || 'Failed to cancel subscription' }, 400);
  }
});

export default tenantRoutes;
