import { Hono } from 'hono';
import { z } from 'zod';
import { db, marketPrices } from '../schema.js';
import { eq, desc } from 'drizzle-orm';
import { marketPriceService } from '../services/market-prices.js';

// POST /refresh reads no JSON body — triggers external price refresh only
const _priceRefreshShape = z.object({ symbols: z.array(z.string()).optional() });

const priceRoutes = new Hono();

priceRoutes.get('/search/:query', async (c) => {
  return c.json({ results: await marketPriceService.searchSymbol(c.req.param('query')) });
});

priceRoutes.post('/refresh', async (c) => {
  return c.json(await marketPriceService.refreshPrices());
});

priceRoutes.get('/', async (c) => {
  const prices = await marketPriceService.getLatestPrices(c.req.query('assetType') || undefined);
  return c.json({ prices, count: prices.length });
});

priceRoutes.get('/:symbol', async (c) => {
  const rows = await db
    .select()
    .from(marketPrices)
    .where(eq(marketPrices.symbol, c.req.param('symbol')))
    .orderBy(desc(marketPrices.observationDate))
    .limit(1)
    .all();
  return rows.length ? c.json(rows[0]) : c.json({ error: 'Not found' }, 404);
});

priceRoutes.get('/:symbol/history', async (c) => {
  const history = await marketPriceService.getPriceHistory(
    c.req.param('symbol'),
    parseInt(c.req.query('days') ?? '30'),
  );
  return c.json({ symbol: c.req.param('symbol'), history, count: history.length });
});

export default priceRoutes;
