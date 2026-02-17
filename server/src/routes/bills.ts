import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { BillService } from '../services/bills.js';
import { getUserId } from '../utils/auth-helpers.js';

const billRoutes = new Hono();
const billService = new BillService();

const createBillSchema = z.object({
  supplierId: z.string().min(1),
  billNumber: z.string().max(50).optional(),
  issueDate: z.string().min(1),
  dueDate: z.string().min(1),
  currency: z.string().max(3).optional(),
  notes: z.string().max(2000).optional(),
  lineItems: z.array(z.object({ description: z.string().min(1), quantity: z.number().min(0), unitPriceCents: z.number().int(), gstRate: z.number().min(0).max(1).optional(), accountCode: z.string().optional(), taxCode: z.string().optional() })).min(1),
});

const updateBillSchema = z.object({
  billNumber: z.string().max(50).optional(), issueDate: z.string().optional(), dueDate: z.string().optional(), notes: z.string().max(2000).optional(),
  lineItems: z.array(z.object({ id: z.string().optional(), description: z.string().min(1), quantity: z.number().min(0), unitPriceCents: z.number().int(), gstRate: z.number().min(0).max(1).optional(), accountCode: z.string().optional(), taxCode: z.string().optional() })).optional(),
});

const billPaymentSchema = z.object({
  paymentDate: z.string().min(1), amountCents: z.number().int().min(1), paymentMethod: z.string().max(50).optional(), reference: z.string().max(100).optional(), transactionId: z.string().optional(), notes: z.string().max(2000).optional(),
});

billRoutes.get('/', async (c) => {
  const userId = getUserId(c);
  const filters = { page: parseInt(c.req.query('page') ?? '1'), limit: parseInt(c.req.query('limit') ?? '50'), status: c.req.query('status'), supplierId: c.req.query('supplierId') };
  return c.json(await billService.listBills(userId, filters));
});

billRoutes.post('/', zValidator('json', createBillSchema), async (c) => {
  try {
    const userId = getUserId(c);
    return c.json({ data: await billService.createBill(userId, c.req.valid('json')) }, 201);
  } catch { return c.json({ error: 'Failed' }, 400); }
});

billRoutes.get('/:id', async (c) => {
  try {
    return c.json({ data: await billService.getBill(c.req.param('id')) });
  } catch { return c.json({ error: 'Failed' }, 404); }
});

billRoutes.patch('/:id', zValidator('json', updateBillSchema), async (c) => {
  try {
    return c.json({ data: await billService.updateBill(c.req.param('id'), c.req.valid('json')) });
  } catch { return c.json({ error: 'Failed' }, 400); }
});

billRoutes.post('/:id/approve', async (c) => {
  try {
    return c.json({ data: await billService.approveBill(c.req.param('id'), getUserId(c)) });
  } catch { return c.json({ error: 'Failed' }, 400); }
});

billRoutes.post('/:id/pay', zValidator('json', billPaymentSchema), async (c) => {
  try {
    return c.json({ data: await billService.recordPayment(c.req.param('id'), c.req.valid('json')) });
  } catch { return c.json({ error: 'Failed' }, 400); }
});

billRoutes.get('/aging', async (c) => {
  return c.json({ data: await billService.getAPAging(getUserId(c), c.req.query('asOfDate')) });
});

export default billRoutes;
