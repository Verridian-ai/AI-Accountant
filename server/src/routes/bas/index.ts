import { Hono } from 'hono';
import { tenantAuthMiddleware } from '../../services/auth-middleware.js';
import { registerBASHandlers } from './handlers.js';

const basRoutes = new Hono();

basRoutes.use('/*', tenantAuthMiddleware());
registerBASHandlers(basRoutes);

export default basRoutes;
