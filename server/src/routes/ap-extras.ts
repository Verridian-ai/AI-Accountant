import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { BillService } from '../services/bills.js';
import { PurchaseOrderService } from '../services/purchase-orders.js';
import { getErrorMessage } from '../utils/error.js';
import { getUserId } from '../utils/auth-helpers.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const apExtrasRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
apExtrasRoutes.use('/*', tenantAuthMiddleware());
const billService = new BillService();
const purchaseOrderService = new PurchaseOrderService();

const createPaymentRunSchema = z.object({
  paymentDate: z.string().min(1),
  billIds: z.array(z.string().min(1)).min(1),
  bankReference: z.string().max(100).optional(),
});

// POST /api/bills/:id/void
apExtrasRoutes.post('/bills/:id/void', zValidator('json', z.object({}).optional()), async (c) => {
  try {
    const id = c.req.param('id');
    const bill = await billService.voidBill(id);
    return c.json({ data: bill });
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) ?? 'Failed to void bill' }, 400);
  }
});

// POST /api/purchase-orders/:id/cancel
apExtrasRoutes.post(
  '/purchase-orders/:id/cancel',
  zValidator('json', z.object({}).optional()),
  async (c) => {
    try {
      const id = c.req.param('id');
      const po = await purchaseOrderService.cancelPurchaseOrder(id);
      return c.json({ data: po });
    } catch (err: unknown) {
      return c.json({ error: getErrorMessage(err) ?? 'Failed to cancel purchase order' }, 400);
    }
  },
);

// POST /api/supplier-payments
apExtrasRoutes.post('/supplier-payments', zValidator('json', createPaymentRunSchema), async (c) => {
  try {
    const userId = getUserId(c);
    const body = c.req.valid('json');
    const run = await purchaseOrderService.createPaymentRun(userId, body);
    return c.json({ data: run }, 201);
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) ?? 'Failed to create payment run' }, 400);
  }
});

// GET /api/supplier-payments/:id
apExtrasRoutes.get('/supplier-payments/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const run = await purchaseOrderService.getPaymentRun(id);
    return c.json({ data: run });
  } catch (err: unknown) {
    if (getErrorMessage(err)?.includes('not found'))
      return c.json({ error: getErrorMessage(err) }, 404);
    return c.json({ error: getErrorMessage(err) ?? 'Failed to get payment run' }, 500);
  }
});

// GET /api/ap/aging
apExtrasRoutes.get('/ap/aging', async (c) => {
  try {
    const userId = getUserId(c);
    const asOfDate = c.req.query('asOfDate') || undefined;
    const report = await billService.getAPAging(userId, asOfDate);
    return c.json({ data: report });
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) ?? 'Failed to generate AP aging report' }, 500);
  }
});

export default apExtrasRoutes;
