import { Hono } from 'hono';
import { z } from 'zod';
import { db, marketDataFeeds } from '../schema.js';
import { eq } from 'drizzle-orm';
import { rbaDataFeed } from '../services/rba-data-feed.js';
import { absDataFeed } from '../services/abs-data-feed.js';
import { marketPriceService } from '../services/market-prices.js';
import { getErrorMessage } from '../utils/error.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

// POST /refresh endpoints read no JSON body — trigger external data fetches only
const _feedRefreshShape = z.object({ force: z.boolean().optional() });

const feedRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
feedRoutes.use('/*', tenantAuthMiddleware());

feedRoutes.get('/', async (c) => {
  return c.json(await db.select().from(marketDataFeeds).all());
});

feedRoutes.post('/refresh', async (c) => {
  const results: Record<string, unknown> = {};
  try {
    results.rba = await rbaDataFeed.fetchAllTables();
  } catch (e) {
    results.rba = { error: getErrorMessage(e) };
  }
  try {
    results.abs = await absDataFeed.fetchAllIndicators();
  } catch (e) {
    results.abs = { error: getErrorMessage(e) };
  }
  try {
    results.prices = await marketPriceService.refreshPrices();
  } catch (e) {
    results.prices = { error: getErrorMessage(e) };
  }
  return c.json(results);
});

feedRoutes.post('/:feedId/refresh', async (c) => {
  const feedId = c.req.param('feedId');
  if (feedId.startsWith('rba-')) {
    const csv = await rbaDataFeed.fetchTable(feedId.replace('rba-', '').toUpperCase());
    return c.json({
      indicators: (await rbaDataFeed.parseTable(feedId.replace('rba-', '').toUpperCase(), csv))
        .length,
    });
  } else if (feedId.startsWith('abs-')) {
    return c.json(await absDataFeed.fetchAllIndicators());
  } else if (feedId.startsWith('feed-alpha') || feedId.startsWith('feed-coingecko')) {
    return c.json(await marketPriceService.refreshPrices());
  }
  return c.json({ error: 'Unknown' }, 404);
});

feedRoutes.get('/:feedId/status', async (c) => {
  const rows = await db
    .select()
    .from(marketDataFeeds)
    .where(eq(marketDataFeeds.id, c.req.param('feedId')))
    .all();
  return rows.length ? c.json(rows[0]) : c.json({ error: 'Not found' }, 404);
});

export default feedRoutes;
