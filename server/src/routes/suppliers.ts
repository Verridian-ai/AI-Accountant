import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { SupplierService } from '../services/suppliers.js';
import { getUserId } from '../utils/auth-helpers.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const supplierRoutes = new Hono();
const supplierService = new SupplierService();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
supplierRoutes.use('/*', tenantAuthMiddleware());

const createSupplierSchema = z.object({
  businessName: z.string().min(1).max(200),
  contactName: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  abn: z.string().regex(/^\d{11}$/, 'ABN must be 11 digits').optional(),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  bankBsb: z.string().regex(/^\d{6}$/, 'BSB must be 6 digits').optional(),
  bankAccountNumber: z.string().min(4).max(12).optional(),
  bankAccountName: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

const updateSupplierSchema = createSupplierSchema.partial();

supplierRoutes.get('/', async (c) => {
  const userId = getUserId(c);
  const page = parseInt(c.req.query('page') ?? '1', 10);
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const search = c.req.query('search') || undefined;
  return c.json(await supplierService.listSuppliers(userId, { page, limit, search }));
});

supplierRoutes.post('/', zValidator('json', createSupplierSchema), async (c) => {
  try {
    const userId = getUserId(c);
    const body = c.req.valid('json');
    return c.json({ data: await supplierService.createSupplier(userId, body) }, 201);
  } catch { return c.json({ error: 'Failed' }, 400); }
});

supplierRoutes.get('/:id', async (c) => {
  const supplier = await supplierService.getSupplier(c.req.param('id'));
  return supplier ? c.json({ data: supplier }) : c.json({ error: 'Not found' }, 404);
});

supplierRoutes.patch('/:id', zValidator('json', updateSupplierSchema), async (c) => {
  try {
    return c.json({ data: await supplierService.updateSupplier(c.req.param('id'), c.req.valid('json')) });
  } catch { return c.json({ error: 'Failed' }, 400); }
});

supplierRoutes.delete('/:id', async (c) => {
  return c.json({ success: true, ...(await supplierService.archiveSupplier(c.req.param('id'))) });
});

export default supplierRoutes;
