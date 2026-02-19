import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { DashboardService } from '../services/dashboard.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const chartsRoutes = new Hono();
const dashboardService = new DashboardService();

const saveChartSchema = z.object({
  userId: z.string().optional(),
  chartType: z.string(),
  title: z.string(),
  dataSource: z.string(),
  configJson: z.record(z.unknown()).optional(),
  filtersJson: z.record(z.unknown()).optional(),
});

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
chartsRoutes.use('/*', tenantAuthMiddleware());

// GET /api/charts
chartsRoutes.get('/', async (c) => {
  try {
    const userId = c.req.query('userId') || 'default';
    const dashboardId = c.req.query('dashboardId') || undefined;
    const charts = await dashboardService.getCharts(userId, dashboardId);
    return c.json(charts);
  } catch (err) {
    console.error('Error listing charts:', err);
    return c.json({ error: 'Failed to list charts' }, 500);
  }
});

// POST /api/charts
chartsRoutes.post('/', zValidator('json', saveChartSchema), async (c) => {
  try {
    const body = c.req.valid('json');
    const userId = body.userId || 'default';
    const chart = await dashboardService.saveChart(userId, body);
    return c.json(chart, 201);
  } catch (err) {
    console.error('Error saving chart:', err);
    return c.json({ error: 'Failed to save chart' }, 500);
  }
});

// DELETE /api/charts/:id
chartsRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await dashboardService.deleteChart(id);
    return c.json({ success: true });
  } catch (err) {
    console.error('Error deleting chart:', err);
    return c.json({ error: 'Failed to delete chart' }, 500);
  }
});

export default chartsRoutes;
