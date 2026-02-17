import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { transactionService } from '../services/transaction-service.js';
import { transactionUpdateSchema, transactionSplitSchema } from '../validation/index.js';

const transactionRoutes = new Hono();

// Get transactions list
transactionRoutes.get('/', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);
  const offset = parseInt(c.req.query('offset') || '0');

  const filters = {
    limit,
    offset,
    accountId: c.req.query('accountId'),
    startDate: c.req.query('startDate'),
    endDate: c.req.query('endDate'),
    category: c.req.query('category'),
    search: c.req.query('search'),
  };

  const { transactions, total } = await transactionService.listTransactions(userId, filters);
  return c.json({ transactions, total });
});

// Update transaction
transactionRoutes.patch('/:id', zValidator('json', transactionUpdateSchema), async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const result = await transactionService.updateTransaction(userId, id, body);
  if (!result) return c.json({ error: 'Not found' }, 404);

  return c.json(result);
});

// Split transaction
transactionRoutes.post('/:id/split', zValidator('json', transactionSplitSchema), async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const id = c.req.param('id');
  const { splits } = c.req.valid('json');

  const result = await transactionService.splitTransaction(userId, id, splits);
  if (!result) return c.json({ error: 'Not found' }, 404);

  return c.json(result);
});

// Delete transaction
transactionRoutes.delete('/:id', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const id = c.req.param('id');

  const result = await transactionService.deleteTransaction(userId, id);
  if (!result) return c.json({ error: 'Not found' }, 404);

  return c.json(result);
});

// Export transactions
transactionRoutes.get('/export', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const format = (c.req.query('format') || 'csv') as 'csv' | 'xlsx';

  const filters = {
    startDate: c.req.query('startDate'),
    endDate: c.req.query('endDate'),
    category: c.req.query('category'),
    search: c.req.query('search'),
  };

  const data = await transactionService.exportTransactions(userId, filters, format);

  if (format === 'xlsx') {
    c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    c.header('Content-Disposition', 'attachment; filename="transactions.xlsx"');
    return c.body(data as ArrayBuffer);
  } else {
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="transactions.csv"');
    return c.body(data as string);
  }
});

export default transactionRoutes;
