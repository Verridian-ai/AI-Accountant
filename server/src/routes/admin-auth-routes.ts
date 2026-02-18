import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { adminAuthService } from '../services/admin-auth.js';

const adminAuthRoutes = new Hono();

const adminLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

adminAuthRoutes.post('/login', zValidator('json', adminLoginSchema), async (c) => {
  try {
    const { username, password } = c.req.valid('json');
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
    const result = await adminAuthService.login(username, password, ip);

    if (!result.success) {
      return c.json({ error: result.error, remainingAttempts: result.remainingAttempts }, 401);
    }

    return c.json({
      token: result.token,
      refreshToken: result.refreshToken,
      user: result.admin,
    });
  } catch (err: unknown) {
    console.error('[AdminAuth] Login error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

adminAuthRoutes.post('/refresh', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Refresh token required' }, 401);
    }
    const refreshToken = authHeader.slice(7);
    const result = await adminAuthService.refreshAccessToken(refreshToken);
    if (!result) return c.json({ error: 'Invalid or expired refresh token' }, 401);
    return c.json({ token: result.token, admin: result.admin });
  } catch (err: unknown) {
    console.error('[AdminAuth] Refresh error:', err);
    return c.json({ error: 'Token refresh failed' }, 500);
  }
});

adminAuthRoutes.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Token required' }, 401);
    }
    const token = authHeader.slice(7);
    const payload = await adminAuthService.verifyToken(token);
    if (!payload) return c.json({ error: 'Invalid token' }, 401);
    const admin = await adminAuthService.getAdminById(payload.adminId);
    if (!admin) return c.json({ error: 'Admin not found' }, 404);
    return c.json({ admin });
  } catch (err: unknown) {
    console.error('[AdminAuth] Me error:', err);
    return c.json({ error: 'Failed to get admin profile' }, 500);
  }
});

export default adminAuthRoutes;
