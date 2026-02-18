/**
 * Extended Agent HTTP Routes
 *
 * Provides direct HTTP access to 7 high-priority agents + a health/status
 * endpoint. Must be mounted BEFORE the wildcard `/api/agents/:type/run`
 * route in index.ts so Hono matches these specific paths first.
 */

import { Hono } from 'hono';
import { tenantAuthMiddleware } from '../../services/auth-middleware.js';
import { registerParseRoute } from './routes-parse.js';
import { registerCategorizeRoute } from './routes-categorize.js';
import { registerMerchantRoute } from './routes-merchant.js';
import { registerPayrollRoute } from './routes-payroll.js';
import { registerTaxRoutes } from './routes-tax.js';
import { registerFinancialRoute } from './routes-financial.js';
import { registerStatusRoute } from './routes-status.js';

const agentRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
agentRoutes.use('/*', tenantAuthMiddleware());

registerParseRoute(agentRoutes);
registerCategorizeRoute(agentRoutes);
registerMerchantRoute(agentRoutes);
registerPayrollRoute(agentRoutes);
registerTaxRoutes(agentRoutes);
registerFinancialRoute(agentRoutes);
registerStatusRoute(agentRoutes);

export default agentRoutes;
