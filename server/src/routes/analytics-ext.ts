import { Hono } from 'hono';

const analyticsExtRoutes = new Hono();

// GET /analytics/budgets — stub (budgets are in budgets routes)
analyticsExtRoutes.get('/budgets', async (c) => {
  // Placeholder: budget-vs-actual is handled by /api/analytics/budget-vs-actual
  return c.json([], 200);
});

// POST /analytics/budgets — stub
analyticsExtRoutes.post('/budgets', async (c) => {
  return c.json({ success: true });
});

// POST /analytics/anomalies/:id/dismiss — stub
analyticsExtRoutes.post('/anomalies/:id/dismiss', async (c) => {
  return c.json({ success: true });
});

export default analyticsExtRoutes;
