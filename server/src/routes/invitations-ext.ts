import { Hono, type Context } from 'hono';
import { getErrorMessage } from '../utils/error.js';
import { tenantService } from '../services/tenant.js';

const invitationsExtRoutes = new Hono();

function getUserId(c: Context): string {
  const userId = c.get('userId') as string | undefined;
  if (userId) return userId;
  const payload = c.get('jwtPayload') as { sub?: string; userId?: string } | undefined;
  if (payload?.sub) return payload.sub;
  if (payload?.userId) return payload.userId;
  throw new Error('No authenticated user found');
}

// POST /api/invitations/accept — Accept a tenant invitation via token
invitationsExtRoutes.post('/invitations/accept', async (c) => {
  try {
    const body = (await c.req.json()) as { token: string; userId: string };
    if (!body.token) return c.json({ error: 'Invitation token is required' }, 400);
    let userId: string;
    try {
      userId = getUserId(c);
    } catch {
      userId = body.userId;
    }
    if (!userId) return c.json({ error: 'userId is required (via auth or body)' }, 400);
    return c.json(await tenantService.acceptInvitation(body.token, userId));
  } catch (err: unknown) {
    console.error('[Invitations] Accept failed:', err);
    return c.json({ error: getErrorMessage(err) || 'Failed to accept invitation' }, 400);
  }
});

export default invitationsExtRoutes;
