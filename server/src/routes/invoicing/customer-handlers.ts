import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CustomerService } from '../../services/customers.js';
import {
  paginationSchema,
  createCustomerSchema,
  updateCustomerSchema,
  createContactSchema,
} from '../../validation/features/invoicing.js';
import { getUserId } from './helpers.js';

const customerService = new CustomerService();

export function registerCustomerHandlers(app: Hono): void {
  // GET /customers — paginated list
  app.get('/customers', zValidator('query', paginationSchema), async (c) => {
    const userId = getUserId(c);
    const { page, limit } = c.req.valid('query');
    const offset = (page - 1) * limit;

    const search = c.req.query('search') || undefined;
    const isActiveParam = c.req.query('isActive');
    const isActive =
      isActiveParam === 'false' ? false : isActiveParam === 'true' ? true : undefined;

    const result = await customerService.listCustomers(userId, { offset, limit, search, isActive });
    return c.json(result);
  });

  // POST /customers — create customer
  app.post('/customers', zValidator('json', createCustomerSchema), async (c) => {
    try {
      const userId = getUserId(c);
      const data = c.req.valid('json');
      const customer = await customerService.createCustomer(userId, data);
      return c.json(customer, 201);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('ABN')) return c.json({ error: msg }, 400);
      console.error('[Invoicing] Create customer failed:', err);
      return c.json({ error: 'Internal server error. Please try again.' }, 500);
    }
  });

  // GET /customers/:id — get customer with balance
  app.get('/customers/:id', async (c) => {
    try {
      const userId = getUserId(c);
      const customerId = c.req.param('id');
      const result = await customerService.getCustomerWithBalance(userId, customerId);
      return c.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('not found')) return c.json({ error: msg }, 404);
      console.error('[Invoicing] Get customer failed:', err);
      return c.json({ error: 'Internal server error. Please try again.' }, 500);
    }
  });

  // PATCH /customers/:id — update customer
  app.patch('/customers/:id', zValidator('json', updateCustomerSchema), async (c) => {
    try {
      const userId = getUserId(c);
      const customerId = c.req.param('id');
      const data = c.req.valid('json');
      const customer = await customerService.updateCustomer(userId, customerId, data);
      return c.json(customer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('not found')) return c.json({ error: msg }, 404);
      if (msg.includes('ABN')) return c.json({ error: msg }, 400);
      console.error('[Invoicing] Update customer failed:', err);
      return c.json({ error: 'Internal server error. Please try again.' }, 500);
    }
  });

  // DELETE /customers/:id — archive (soft delete)
  app.delete('/customers/:id', async (c) => {
    try {
      const userId = getUserId(c);
      const customerId = c.req.param('id');
      await customerService.archiveCustomer(userId, customerId);
      return c.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('not found')) return c.json({ error: msg }, 404);
      console.error('[Invoicing] Archive customer failed:', err);
      return c.json({ error: 'Internal server error. Please try again.' }, 500);
    }
  });

  // GET /customers/:id/contacts — list contacts
  app.get('/customers/:id/contacts', async (c) => {
    const customerId = c.req.param('id');
    const contacts = await customerService.listContacts(customerId);
    return c.json(contacts);
  });

  // POST /customers/:id/contacts — add contact
  app.post('/customers/:id/contacts', zValidator('json', createContactSchema), async (c) => {
    const customerId = c.req.param('id');
    const data = c.req.valid('json');
    const contact = await customerService.addContact(customerId, data);
    return c.json(contact, 201);
  });
}
