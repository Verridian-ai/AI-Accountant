import { Hono } from 'hono';
import { tenantAuthMiddleware } from '../../services/auth-middleware.js';
import { registerGSTHandlers } from './gst-handlers.js';
import { registerCGTHandlers } from './cgt-handlers.js';
import { registerDepreciationHandlers } from './depreciation-handlers.js';

const taxExtRoutes = new Hono();

taxExtRoutes.use('/*', tenantAuthMiddleware());

registerGSTHandlers(taxExtRoutes);
registerCGTHandlers(taxExtRoutes);
registerDepreciationHandlers(taxExtRoutes);

export default taxExtRoutes;
