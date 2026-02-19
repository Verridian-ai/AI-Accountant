import { Hono } from 'hono';
import { tenantAuthMiddleware } from '../../services/auth-middleware.js';
import { registerCustomerHandlers } from './customer-handlers.js';
import { registerInvoiceHandlers } from './invoice-handlers.js';

const invoicingRoutes = new Hono();

invoicingRoutes.use('/*', tenantAuthMiddleware());

registerCustomerHandlers(invoicingRoutes);
registerInvoiceHandlers(invoicingRoutes);

export default invoicingRoutes;
