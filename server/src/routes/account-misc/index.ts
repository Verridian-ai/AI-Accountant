import { Hono } from 'hono';
import { tenantAuthMiddleware } from '../../services/auth-middleware.js';
import { registerMiscHandlers } from './misc-handlers.js';
import { registerTransferHandlers } from './transfer-handlers.js';
import { registerAnalyticsHandlers } from './analytics-handlers.js';

const accountMiscRoutes = new Hono();

accountMiscRoutes.use('/*', tenantAuthMiddleware());

registerMiscHandlers(accountMiscRoutes);
registerTransferHandlers(accountMiscRoutes);
registerAnalyticsHandlers(accountMiscRoutes);

export default accountMiscRoutes;
