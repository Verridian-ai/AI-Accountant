import { Hono } from 'hono';
import { DashboardService } from '../services/dashboard.js';

const chartsExtRoutes = new Hono();
const dashboardService = new DashboardService();

// GET /api/charts — list saved charts
chartsExtRoutes.get('/charts', async (c) => {
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

// POST /api/charts — save a chart
chartsExtRoutes.post('/charts', async (c) => {
  try {
    const body = await c.req.json();
    const userId = body.userId || 'default';
    const chart = await dashboardService.saveChart(userId, body);
    return c.json(chart, 201);
  } catch (err) {
    console.error('Error saving chart:', err);
    return c.json({ error: 'Failed to save chart' }, 500);
  }
});

// DELETE /api/charts/:id — delete a chart
chartsExtRoutes.delete('/charts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await dashboardService.deleteChart(id);
    return c.json({ success: true });
  } catch (err) {
    console.error('Error deleting chart:', err);
    return c.json({ error: 'Failed to delete chart' }, 500);
  }
});

export default chartsExtRoutes;
