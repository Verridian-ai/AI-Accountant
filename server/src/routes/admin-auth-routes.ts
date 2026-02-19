import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { adminAuthService } from '../services/admin-auth.js';
import { transactionRepository } from '../repositories/transaction-repository.js';
import { pool } from '../schema/connection.js';
import type { Context } from 'hono';
import { adminAuthMiddleware } from '../services/admin-auth/index.js';

const adminAuthRoutes = new Hono();

// Apply admin auth to protected routes — /login and /refresh stay public
adminAuthRoutes.use('/me', adminAuthMiddleware());
adminAuthRoutes.use('/transactions', adminAuthMiddleware());
adminAuthRoutes.use('/ledger-summary', adminAuthMiddleware());
adminAuthRoutes.use('/bas-summary', adminAuthMiddleware());

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

// GET /admin/transactions — admin-only, no userId filter required
adminAuthRoutes.get('/transactions', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Token required' }, 401);
    }
    const token = authHeader.slice(7);
    const payload = await adminAuthService.verifyToken(token);
    if (!payload) return c.json({ error: 'Invalid admin token' }, 401);

    const limit = parseInt(c.req.query('limit') || '1000', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const userId = c.req.query('userId');

    const { data: transactions, total } = await transactionRepository.findManyAdmin({
      limit,
      offset,
      userId,
    });

    return c.json({ transactions, total });
  } catch (err: unknown) {
    console.error('[AdminAuth] Transactions error:', err);
    return c.json({ error: 'Failed to fetch transactions' }, 500);
  }
});

/** Verify admin token from Authorization header. Returns adminId or sends 401. */
async function requireAdmin(c: Context): Promise<string | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    c.status(401);
    return null;
  }
  const payload = await adminAuthService.verifyToken(authHeader.slice(7));
  if (!payload) {
    c.status(401);
    return null;
  }
  return payload.adminId;
}

// GET /admin/ledger-summary — aggregate transaction stats for admin dashboard
adminAuthRoutes.get('/ledger-summary', async (c) => {
  try {
    const adminId = await requireAdmin(c);
    if (!adminId) return c.json({ error: 'Invalid admin token' }, 401);

    const result = await pool.query(`
      SELECT
        COUNT(*)::text AS total_transactions,
        COUNT(DISTINCT user_id)::text AS total_users,
        COALESCE(SUM(CASE WHEN amount > 0 AND COALESCE(is_transfer, 0) = 0 THEN amount ELSE 0 END), 0)::text AS total_income_cents,
        COALESCE(SUM(CASE WHEN amount < 0 AND COALESCE(is_transfer, 0) = 0 THEN ABS(amount) ELSE 0 END), 0)::text AS total_expenses_cents,
        MIN(date) AS earliest_transaction,
        MAX(date) AS latest_transaction
      FROM transactions
    `);
    const row = result.rows[0];
    return c.json({
      totalTransactions: parseInt(row.total_transactions, 10),
      totalUsers: parseInt(row.total_users, 10),
      totalIncomeCents: parseInt(row.total_income_cents, 10),
      totalExpensesCents: parseInt(row.total_expenses_cents, 10),
      earliestTransaction: row.earliest_transaction,
      latestTransaction: row.latest_transaction,
    });
  } catch (err: unknown) {
    console.error('[AdminAuth] Ledger summary error:', err);
    return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
  }
});

// GET /admin/bas-summary — BAS period stats for admin dashboard
adminAuthRoutes.get('/bas-summary', async (c) => {
  try {
    const adminId = await requireAdmin(c);
    if (!adminId) return c.json({ error: 'Invalid admin token' }, 401);

    const result = await pool.query(`
      SELECT
        COUNT(*)::text AS total_periods,
        COUNT(CASE WHEN status = 'lodged' THEN 1 END)::text AS lodged_count,
        COUNT(CASE WHEN status = 'draft' THEN 1 END)::text AS draft_count,
        COUNT(DISTINCT user_id)::text AS users_with_bas
      FROM bas_periods
    `);
    const row = result.rows[0];
    return c.json({
      totalPeriods: parseInt(row.total_periods ?? '0', 10),
      lodgedCount: parseInt(row.lodged_count ?? '0', 10),
      draftCount: parseInt(row.draft_count ?? '0', 10),
      usersWithBas: parseInt(row.users_with_bas ?? '0', 10),
    });
  } catch (err: unknown) {
    console.error('[AdminAuth] BAS summary error:', err);
    return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
  }
});

export default adminAuthRoutes;
