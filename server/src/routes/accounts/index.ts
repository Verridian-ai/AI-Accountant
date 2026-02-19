import { Hono } from 'hono';
import { tenantAuthMiddleware } from '../../services/auth-middleware.js';
import { registerAccountHandlers } from './handlers.js';

const accountRoutes = new Hono();

accountRoutes.use('/*', tenantAuthMiddleware());
registerAccountHandlers(accountRoutes);

export default accountRoutes;
