import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { tenantService } from '../services/tenant.js';
import { rbacService } from '../services/rbac.js';
import { ForbiddenError } from '../services/rbac-errors.js';
import { getErrorMessage } from '../utils/error.js';
import { getUserId } from '../utils/auth-helpers.js';
import type { TenantRole } from '../services/tenant-types.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';
import { inviteTenantMemberSchema, acceptInvitationSchema } from '../validation/operations.js';

const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.string().min(1),
});

const updateRoleSchema = z.object({
  role: z.string().min(1),
});

const memberRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
memberRoutes.use('/*', tenantAuthMiddleware());

// --- MEMBER ROUTES ---

memberRoutes.get('/:tenantId/members', async (c) => {
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
  } catch (err) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: 'Failed' }, 500);
  }
});

memberRoutes.post('/:tenantId/members', zValidator('json', addMemberSchema), async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const userId = getUserId(c);
    await rbacService.requirePermission(tenantId, userId, 'members.manage');
    const { userId: targetUserId, role } = c.req.valid('json');
    const member = await tenantService.addMember(
      tenantId,
      targetUserId,
      role as TenantRole,
      userId,
    );
    return c.json(member, 201);
  } catch (err) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: 'Failed' }, 400);
  }
});

memberRoutes.put(
  '/:tenantId/members/:userId/role',
  zValidator('json', updateRoleSchema),
  async (c) => {
    try {
      const tenantId = c.req.param('tenantId');
      const targetUserId = c.req.param('userId');
      const currentUserId = getUserId(c);
      await rbacService.requirePermission(tenantId, currentUserId, 'members.manage');
      const { role } = c.req.valid('json');
      return c.json(
        await tenantService.updateMemberRole(tenantId, targetUserId, role as TenantRole),
      );
    } catch (err) {
      if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
      return c.json({ error: 'Failed' }, 400);
    }
  },
);

memberRoutes.delete('/:tenantId/members/:userId', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const targetUserId = c.req.param('userId');
    const currentUserId = getUserId(c);
    await rbacService.requirePermission(tenantId, currentUserId, 'members.manage');
    await tenantService.removeMember(tenantId, targetUserId);
    return c.json({ message: 'Removed' });
  } catch (err) {
    if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
    return c.json({ error: 'Failed' }, 400);
  }
});

memberRoutes.post(
  '/:tenantId/invitations',
  zValidator('json', inviteTenantMemberSchema),
  async (c) => {
    try {
      const tenantId = c.req.param('tenantId');
      const userId = getUserId(c);
      await rbacService.requirePermission(tenantId, userId, 'members.manage');
      const { email, role } = c.req.valid('json');
      const invitation = await tenantService.inviteMember(
        tenantId,
        email,
        role as TenantRole,
        userId,
      );
      return c.json(invitation, 201);
    } catch (err) {
      if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
      return c.json({ error: 'Failed' }, 400);
    }
  },
);

memberRoutes.post('/invitations/accept', zValidator('json', acceptInvitationSchema), async (c) => {
  try {
    const { token, userId: bodyUserId } = c.req.valid('json');
    let userId: string | undefined;
    try {
      userId = getUserId(c);
    } catch {
      userId = bodyUserId;
    }
    if (!userId) return c.json({ error: 'userId required' }, 400);
    return c.json(await tenantService.acceptInvitation(token, userId));
  } catch {
    return c.json({ error: 'Failed' }, 400);
  }
});

export default memberRoutes;
