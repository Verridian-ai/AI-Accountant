import { Hono } from 'hono';
import { z } from 'zod';
import { db, economicIndicators } from '../schema.js';
import { eq, and, desc, like, type SQL } from 'drizzle-orm';
import { rbaDataFeed } from '../services/rba-data-feed.js';
import { absDataFeed } from '../services/abs-data-feed.js';

// All routes are GETs with query params only — no JSON request body validation needed
const _indicatorQueryShape = z.object({
  category: z.string().optional(),
  source: z.string().optional(),
});

const indicatorRoutes = new Hono();

indicatorRoutes.get('/snapshot', async (c) => {
  const indicators = await db.select().from(economicIndicators).all();
  const latestMap = new Map();
  for (const ind of indicators) {
    const existing = latestMap.get(ind.indicatorCode);
    if (!existing || ind.observationDate > existing.observationDate)
      latestMap.set(ind.indicatorCode, ind);
  }
  return c.json({ indicators: Array.from(latestMap.values()), count: latestMap.size });
});

indicatorRoutes.get('/cash-rate', async (c) => {
  return c.json(await rbaDataFeed.getCashRate());
});

indicatorRoutes.get('/cpi', async (c) => {
  return c.json({
    abs: {
      allGroups: await absDataFeed.getLatestIndicator('ABS_CPI_ALL_GROUPS'),
      allGroupsPct: await absDataFeed.getLatestIndicator('ABS_CPI_ALL_GROUPS_PCT'),
    },
    rba: { quarterly: await rbaDataFeed.getRateHistory('RBA_CPI_QUARTERLY', 12) },
  });
});

indicatorRoutes.get('/', async (c) => {
  const conditions: SQL[] = [];
  const category = c.req.query('category');
  const source = c.req.query('source');
  if (category) conditions.push(eq(economicIndicators.category, category));
  if (source) conditions.push(like(economicIndicators.source, `%${source}%`));
  const rows = await db
    .select()
    .from(economicIndicators)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(economicIndicators.observationDate))
    .limit(100)
    .all();
  return c.json({ indicators: rows, count: rows.length });
});

indicatorRoutes.get('/:code/history', async (c) => {
  const code = c.req.param('code');
  const history = [
    ...(await rbaDataFeed.getRateHistory(code, 24)).map((h) => ({ ...h, source: 'rba' })),
    ...(await absDataFeed.getIndicatorHistory(code, 24)).map((h) => ({
      date: h.observationDate,
      value: h.value,
      source: 'abs',
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return c.json({ code, history, count: history.length });
});

export default indicatorRoutes;
