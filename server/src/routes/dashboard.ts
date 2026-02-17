import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { DashboardService } from '../services/dashboard.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const createDashboardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  layout: z.record(z.unknown()).optional(),
});

const updateDashboardSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  layout: z.record(z.unknown()).optional(),
}).passthrough();

const saveChartSchema = z.object({
  userId: z.string().optional(),
  type: z.string().optional(),
  title: z.string().optional(),
  config: z.record(z.unknown()).optional(),
}).passthrough();

const dashboardRoutes = new Hono();
const dashboardService = new DashboardService();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
dashboardRoutes.use('/*', tenantAuthMiddleware());

// 1. GET /dashboards — list all dashboards for a user
dashboardRoutes.get('/', async (c) => {
  const payload = c.get('jwtPayload');
  return c.json(await dashboardService.getDashboards(payload.userId));
});

// 2. GET /dashboards/:id — get a single dashboard
dashboardRoutes.get('/:id', async (c) => {
  const dashboard = await dashboardService.getDashboard(c.req.param('id'));
  return dashboard ? c.json(dashboard) : c.json({ error: 'Not found' }, 404);
});

// 3. POST /dashboards — create a new dashboard
dashboardRoutes.post('/', zValidator('json', createDashboardSchema), async (c) => {
  const payload = c.get('jwtPayload');
  const { name, description, layout } = c.req.valid('json');
  return c.json(await dashboardService.createDashboard(payload.userId, name, description, layout), 201);
});

// 4. PUT /dashboards/:id — update a dashboard
dashboardRoutes.put('/:id', zValidator('json', updateDashboardSchema), async (c) => {
  return c.json(await dashboardService.updateDashboard(c.req.param('id'), c.req.valid('json')));
});

// 5. DELETE /dashboards/:id — delete a dashboard
dashboardRoutes.delete('/:id', async (c) => {
  await dashboardService.deleteDashboard(c.req.param('id'));
  return c.json({ success: true });
});

// Charts
dashboardRoutes.get('/charts', async (c) => {
  const userId = c.req.query('userId') || 'default';
  return c.json(await dashboardService.getCharts(userId, c.req.query('dashboardId')));
});

dashboardRoutes.post('/charts', zValidator('json', saveChartSchema), async (c) => {
  const body = c.req.valid('json');
  return c.json(await dashboardService.saveChart(body.userId || 'default', body as any), 201);
});

dashboardRoutes.delete('/charts/:id', async (c) => {
  await dashboardService.deleteChart(c.req.param('id'));
  return c.json({ success: true });
});

export default dashboardRoutes;