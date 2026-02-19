import type { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { tenantService } from '../../services/tenant.js';
import { rbacService } from '../../services/rbac.js';
import { ForbiddenError } from '../../services/rbac-errors.js';
import { getErrorMessage } from '../../utils/error.js';
import { getUserId } from '../../utils/auth-helpers.js';
import type { TenantRole } from '../../services/tenant-types.js';
import {
  addTenantMemberSchema,
  updateMemberRoleSchema,
  createTenantInvitationSchema,
} from './schemas.js';

export function registerMemberHandlers(app: Hono): void {
  // GET /:tenantId/members — List members + pending invitations
  app.get('/:tenantId/members', async (c) => {
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

  // POST /:tenantId/members — Add member
  app.post('/:tenantId/members', zValidator('json', addTenantMemberSchema), async (c) => {
    try {
      const tenantId = c.req.param('tenantId');
      const currentUserId = getUserId(c);
      await rbacService.requirePermission(tenantId, currentUserId, 'members.manage');
      const { userId: targetUserId, role } = c.req.valid('json');
      const member = await tenantService.addMember(
        tenantId,
        targetUserId,
        role as TenantRole,
        currentUserId,
      );
      return c.json(member, 201);
    } catch (err: unknown) {
      if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
      return c.json({ error: getErrorMessage(err) || 'Failed to add member' }, 400);
    }
  });

  // PUT /:tenantId/members/:userId/role — Update member role
  app.put(
    '/:tenantId/members/:userId/role',
    zValidator('json', updateMemberRoleSchema),
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
      } catch (err: unknown) {
        if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
        return c.json({ error: getErrorMessage(err) || 'Failed to update member role' }, 400);
      }
    },
  );

  // DELETE /:tenantId/members/:userId — Remove member
  app.delete('/:tenantId/members/:userId', async (c) => {
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

  // POST /:tenantId/invitations — Send invitation
  app.post(
    '/:tenantId/invitations',
    zValidator('json', createTenantInvitationSchema),
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
      } catch (err: unknown) {
        if (err instanceof ForbiddenError) return c.json({ error: getErrorMessage(err) }, 403);
        return c.json({ error: getErrorMessage(err) || 'Failed to send invitation' }, 400);
      }
    },
  );

  // POST /:tenantId/permissions/reset — Reset permissions to defaults
  app.post(
    '/:tenantId/permissions/reset',
    zValidator('json', z.object({}).optional()),
    async (c) => {
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
    },
  );
}
