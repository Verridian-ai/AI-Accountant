import { Hono } from 'hono';
import { tenantAuthMiddleware } from '../../services/auth-middleware.js';
import { registerTransferHandlers } from './transfer-handlers.js';
import { registerEnrichmentHandlers } from './enrichment-handlers.js';
import { registerMerchantHandlers } from './merchant-handlers.js';

const pipelineRoutes = new Hono();

pipelineRoutes.use('/*', tenantAuthMiddleware());

registerTransferHandlers(pipelineRoutes);
registerEnrichmentHandlers(pipelineRoutes);
registerMerchantHandlers(pipelineRoutes);

export default pipelineRoutes;
