import { Hono } from 'hono';
import { tenantAuthMiddleware } from '../../services/auth-middleware.js';
import { registerTenantHandlers } from './tenant-handlers.js';
import { registerMemberHandlers } from './member-handlers.js';
import { registerSubscriptionHandlers } from './subscription-handlers.js';

const tenantRoutes = new Hono();

tenantRoutes.use('/*', tenantAuthMiddleware());

registerTenantHandlers(tenantRoutes);
registerMemberHandlers(tenantRoutes);
registerSubscriptionHandlers(tenantRoutes);

export default tenantRoutes;
