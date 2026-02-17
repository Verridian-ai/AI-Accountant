import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { PurchaseOrderService } from '../services/purchase-orders.js';
import { getUserId } from '../utils/auth-helpers.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const poRoutes = new Hono();
const purchaseOrderService = new PurchaseOrderService();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
poRoutes.use('/*', tenantAuthMiddleware());

const createPOSchema = z.object({
  supplierId: z.string().min(1), expectedDate: z.string().optional(), notes: z.string().max(2000).optional(),
  lineItems: z.array(z.object({ description: z.string().min(1), quantity: z.number().min(0), unitPriceCents: z.number().int() })).min(1),
});

const updatePOSchema = z.object({
  expectedDate: z.string().optional(), notes: z.string().max(2000).optional(),
  lineItems: z.array(z.object({ id: z.string().optional(), description: z.string().min(1), quantity: z.number().min(0), unitPriceCents: z.number().int() })).optional(),
});

const receiveGoodsSchema = z.object({
  receiptDate: z.string().min(1), receivedBy: z.string().max(200).optional(), notes: z.string().max(2000).optional(),
  lines: z.array(z.object({ poLineId: z.string().min(1), quantityReceived: z.number().min(0) })).min(1),
});

const createPaymentRunSchema = z.object({
  paymentDate: z.string().min(1), billIds: z.array(z.string().min(1)).min(1), bankReference: z.string().max(100).optional(),
});

poRoutes.get('/', async (c) => {
  const userId = getUserId(c);
  const filters = { page: parseInt(c.req.query('page') ?? '1'), limit: parseInt(c.req.query('limit') ?? '50'), status: c.req.query('status'), supplierId: c.req.query('supplierId') };
  return c.json(await purchaseOrderService.listPurchaseOrders(userId, filters));
});

poRoutes.post('/', zValidator('json', createPOSchema), async (c) => {
  try {
    return c.json({ data: await purchaseOrderService.createPurchaseOrder(getUserId(c), c.req.valid('json')) }, 201);
  } catch { return c.json({ error: 'Failed' }, 400); }
});

poRoutes.get('/:id', async (c) => {
  try {
    return c.json({ data: await purchaseOrderService.getPurchaseOrder(c.req.param('id')) });
  } catch { return c.json({ error: 'Failed' }, 404); }
});

poRoutes.patch('/:id', zValidator('json', updatePOSchema), async (c) => {
  try {
    return c.json({ data: await purchaseOrderService.updatePurchaseOrder(c.req.param('id'), c.req.valid('json')) });
  } catch { return c.json({ error: 'Failed' }, 400); }
});

poRoutes.post('/:id/send', async (c) => {
  try {
    return c.json({ data: await purchaseOrderService.sendPurchaseOrder(c.req.param('id')) });
  } catch { return c.json({ error: 'Failed' }, 400); }
});

poRoutes.post('/:id/receive', zValidator('json', receiveGoodsSchema), async (c) => {
  try {
    return c.json({ data: await purchaseOrderService.receiveGoods(c.req.param('id'), c.req.valid('json')) });
  } catch { return c.json({ error: 'Failed' }, 400); }
});

poRoutes.post('/payment-runs', zValidator('json', createPaymentRunSchema), async (c) => {
  try {
    return c.json({ data: await purchaseOrderService.createPaymentRun(getUserId(c), c.req.valid('json')) }, 201);
  } catch { return c.json({ error: 'Failed' }, 400); }
});

poRoutes.get('/payment-runs/:id', async (c) => {
  try {
    return c.json({ data: await purchaseOrderService.getPaymentRun(c.req.param('id')) });
  } catch { return c.json({ error: 'Failed' }, 404); }
});

export default poRoutes;
