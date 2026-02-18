/**
 * Tenant-aware auth routes mounted at /api/auth/*.
 * These differ from the legacy /auth/* routes in auth-routes.ts:
 * they include tenant context in tokens and JWT payloads.
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { db, users } from '../schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword, comparePassword, generateToken, verifyToken } from '../auth.js';
import { tenantService } from '../services/tenant.js';
import { adminAuthService } from '../services/admin-auth.js';
import { getErrorMessage } from '../utils/error.js';
import { loginWithTenantSchema, registerSchema, refreshSchema } from '../validation/auth.js';

const apiAuthRoutes = new Hono();

// POST /api/auth/login — tenant-aware login
apiAuthRoutes.post('/login', zValidator('json', loginWithTenantSchema), async (c) => {
  try {
    const body = c.req.valid('json');

    const user = await db.select().from(users).where(eq(users.username, body.username)).get();
    if (!user || !(await comparePassword(body.password, user.passwordHash)))
      return c.json({ error: 'Invalid credentials' }, 401);

    const memberTenants = await tenantService.getMemberTenants(user.id);
    if (memberTenants.length === 0) {
      const token = await generateToken(user.id);
      return c.json({
        token,
        user: { id: user.id, username: user.username },
        tenants: [],
        activeTenant: null,
      });
    }

    const targetTenantId = body.tenantId ?? memberTenants[0].tenant.id;
    const match = memberTenants.find((mt) => mt.tenant.id === targetTenantId);
    if (!match) return c.json({ error: 'User is not a member of the specified tenant' }, 403);

    const token = await adminAuthService.generateTenantToken(user.id, targetTenantId);
    const context = await tenantService.getTenantContext(user.id, targetTenantId);
    return c.json({
      token,
      user: { id: user.id, username: user.username },
      tenants: memberTenants,
      activeTenant: context,
    });
  } catch (err: unknown) {
    console.error('[Auth] Login failed:', err);
    return c.json({ error: getErrorMessage(err) || 'Login failed' }, 500);
  }
});

// POST /api/auth/register
apiAuthRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  try {
    const body = c.req.valid('json');

    const passwordHash = await hashPassword(body.password);
    const userId = crypto.randomUUID();
    try {
      await db.insert(users).values({ id: userId, username: body.username, passwordHash });
    } catch {
      return c.json({ error: 'Username already exists' }, 400);
    }

    let tenant = null;
    let token: string;
    if (body.tenantName && body.tenantSlug) {
      tenant = await tenantService.createTenant(body.tenantName, body.tenantSlug, userId);
      token = await adminAuthService.generateTenantToken(userId, tenant.id);
    } else {
      token = await generateToken(userId);
    }
    return c.json({ token, user: { id: userId, username: body.username }, tenant }, 201);
  } catch (err: unknown) {
    console.error('[Auth] Register failed:', err);
    return c.json({ error: getErrorMessage(err) || 'Registration failed' }, 400);
  }
});

// POST /api/auth/refresh
apiAuthRoutes.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer '))
      return c.json({ error: 'Authorization token required' }, 401);
    const currentToken = authHeader.slice(7);
    const body = c.req.valid('json');
    const result = await adminAuthService.refreshTenantToken(currentToken, body.tenantId);
    if (!result) return c.json({ error: 'Token refresh failed' }, 401);
    return c.json({ token: result.token, payload: result.payload });
  } catch (err: unknown) {
    console.error('[Auth] Refresh failed:', err);
    return c.json({ error: getErrorMessage(err) || 'Token refresh failed' }, 500);
  }
});

// GET /api/auth/me
apiAuthRoutes.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'No token provided' }, 401);
    const token = authHeader.slice(7);

    const tenantPayload = await adminAuthService.verifyTenantToken(token);
    if (tenantPayload) {
      const user = await db.select().from(users).where(eq(users.id, tenantPayload.userId)).get();
      if (!user) return c.json({ error: 'User not found' }, 404);
      const memberTenants = await tenantService.getMemberTenants(tenantPayload.userId);
      let activeTenantContext = null;
      try {
        activeTenantContext = await tenantService.getTenantContext(
          tenantPayload.userId,
          tenantPayload.tenantId,
        );
      } catch {
        /* tenant may be deactivated */
      }
      return c.json({
        user: { id: user.id, username: user.username },
        tenants: memberTenants,
        activeTenant: activeTenantContext,
        role: tenantPayload.role,
        permissions: tenantPayload.permissions,
      });
    }

    const legacyPayload = await verifyToken(token);
    if (!legacyPayload) return c.json({ error: 'Invalid token' }, 401);
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, legacyPayload.userId as string))
      .get();
    if (!user) return c.json({ error: 'User not found' }, 404);
    const memberTenants = await tenantService.getMemberTenants(user.id);
    return c.json({
      user: { id: user.id, username: user.username },
      tenants: memberTenants,
      activeTenant: null,
      role: null,
      permissions: [],
    });
  } catch (err: unknown) {
    console.error('[Auth] Me failed:', err);
    return c.json({ error: 'Verification failed' }, 401);
  }
});

export default apiAuthRoutes;
