import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getErrorMessage } from '../utils/error.js';
import { BillService } from '../services/bills.js';
import { PurchaseOrderService } from '../services/purchase-orders.js';

const apExtRoutes = new Hono();

const billService = new BillService();
const purchaseOrderService = new PurchaseOrderService();

const createPaymentRunSchema = z.object({
  paymentDate: z.string().min(1),
  billIds: z.array(z.string().min(1)).min(1),
  bankReference: z.string().max(100).optional(),
});

function getUserId(c: Context): string {
  const userId = c.get('userId') as string | undefined;
  if (userId) return userId;
  const payload = c.get('jwtPayload') as { sub?: string; userId?: string } | undefined;
  if (payload?.sub) return payload.sub;
  if (payload?.userId) return payload.userId;
  throw new Error('No authenticated user found');
}

// POST /api/bills/:id/void — Void a bill
apExtRoutes.post('/bills/:id/void', async (c) => {
  try {
    const id = c.req.param('id');
    const bill = await billService.voidBill(id);
    return c.json({ data: bill });
  } catch (err: unknown) {
    console.error('[Bills] Void failed:', err);
    return c.json({ error: getErrorMessage(err) ?? 'Failed to void bill' }, 400);
  }
});

// POST /api/purchase-orders/:id/cancel — Cancel a purchase order
apExtRoutes.post('/purchase-orders/:id/cancel', async (c) => {
  try {
    const id = c.req.param('id');
    const po = await purchaseOrderService.cancelPurchaseOrder(id);
    return c.json({ data: po });
  } catch (err: unknown) {
    console.error('[PurchaseOrders] Cancel failed:', err);
    return c.json({ error: getErrorMessage(err) ?? 'Failed to cancel purchase order' }, 400);
  }
});

// POST /api/supplier-payments — Create a payment run
apExtRoutes.post('/supplier-payments', zValidator('json', createPaymentRunSchema), async (c) => {
  try {
    const userId = getUserId(c);
    const body = c.req.valid('json');
    const run = await purchaseOrderService.createPaymentRun(userId, body);
    return c.json({ data: run }, 201);
  } catch (err: unknown) {
    console.error('[PaymentRun] Create failed:', err);
    return c.json({ error: getErrorMessage(err) ?? 'Failed to create payment run' }, 400);
  }
});

// GET /api/supplier-payments/:id — Get a payment run
apExtRoutes.get('/supplier-payments/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const run = await purchaseOrderService.getPaymentRun(id);
    return c.json({ data: run });
  } catch (err: unknown) {
    console.error('[PaymentRun] Get failed:', err);
    if (getErrorMessage(err)?.includes('not found'))
      return c.json({ error: getErrorMessage(err) }, 404);
    return c.json({ error: getErrorMessage(err) ?? 'Failed to get payment run' }, 500);
  }
});

// GET /api/ap/aging — AP aging report
apExtRoutes.get('/ap/aging', async (c) => {
  try {
    const userId = getUserId(c);
    const asOfDate = c.req.query('asOfDate') || undefined;
    const report = await billService.getAPAging(userId, asOfDate);
    return c.json({ data: report });
  } catch (err: unknown) {
    console.error('[APAging] Report failed:', err);
    return c.json({ error: getErrorMessage(err) ?? 'Failed to generate AP aging report' }, 500);
  }
});

export default apExtRoutes;
