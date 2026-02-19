import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authService } from '../services/auth/auth-service.js';
import { tenantService } from '../services/tenant.js';
import { adminAuthService } from '../services/admin-auth.js';
import { getUserId } from '../utils/auth-helpers.js';
import { generateToken } from '../auth.js';

const authRoutes = new Hono();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  tenantId: z.string().optional(),
});

const registerSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  tenantName: z.string().optional(),
  tenantSlug: z.string().optional(),
});

// POST /auth/login
authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { username, password, tenantId } = c.req.valid('json');
  if (!username || !password) return c.json({ error: 'username and password are required' }, 400);

  let user: { id: string; username: string };
  let baseToken: string;

  try {
    // Try regular user auth first (users table)
    const authResult = await authService.login(username, password);
    user = authResult.user;
    baseToken = authResult.token;
  } catch {
    // Fall back to admin auth (admin_users table)
    try {
      const adminResult = await adminAuthService.login(username, password);
      if (!adminResult.success || !adminResult.token || !adminResult.admin) {
        return c.json({ error: adminResult.error || 'Invalid credentials' }, 401);
      }
      user = { id: adminResult.admin.id, username: adminResult.admin.username };
      baseToken = adminResult.token;
    } catch {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
  }

  // Multi-tenant check
  const memberTenants = await tenantService.getMemberTenants(user.id);

  if (memberTenants.length === 0) {
    // User has no tenants (legacy or new user)
    return c.json({ token: baseToken, user, tenants: [], activeTenant: null });
  }

  // Determine target tenant
  const targetTenantId = tenantId ?? memberTenants[0].tenant.id;
  const match = memberTenants.find((mt) => mt.tenant.id === targetTenantId);

  if (!match) return c.json({ error: 'Not a member of specified tenant' }, 403);

  // Generate Tenant-scoped Token
  const token = await adminAuthService.generateTenantToken(user.id, targetTenantId);
  const context = await tenantService.getTenantContext(user.id, targetTenantId);

  return c.json({ token, user, tenants: memberTenants, activeTenant: context });
});

// POST /auth/register
authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const { username, password, tenantName, tenantSlug } = c.req.valid('json');
  if (!username || !password) return c.json({ error: 'username and password required' }, 400);

  const result = await authService.register(username, password);

  if (tenantName && tenantSlug) {
    await tenantService.createTenant(tenantName, tenantSlug, result.user.id);
  }

  return c.json(result, 201);
});

// POST /auth/refresh
authRoutes.post('/refresh', async (c) => {
  try {
    const userId = getUserId(c);
    const tenantId = c.req.query('tenantId');
    const token = tenantId
      ? await adminAuthService.generateTenantToken(userId, tenantId)
      : await generateToken(userId);
    return c.json({ token });
  } catch {
    return c.json({ error: 'Refresh failed' }, 401);
  }
});

// GET /auth/me
authRoutes.get('/me', async (c) => {
  try {
    const userId = getUserId(c);
    const { user } = await authService.getCurrentUser(userId);
    const memberTenants = await tenantService.getMemberTenants(userId);
    return c.json({ user, tenants: memberTenants });
  } catch {
    return c.json({ error: 'Auth context failed' }, 500);
  }
});

export default authRoutes;
