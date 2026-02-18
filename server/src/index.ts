import { serve } from '@hono/node-server';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { rateLimiter } from 'hono-rate-limiter';
import { jwt, verify } from 'hono/jwt';
import { db } from './schema.js';
import { orchestrator } from './services/claude/orchestrator.js';
import { securityHeaders } from './middleware/security.js';
import { auditMiddleware } from './middleware/audit.js';
import { ConfirmationFlowService } from './services/claude/confirmation-flow.js';
import { SchemaRegistry } from './services/claude/schemas/schema-registry.js';

// Route file imports
import authRoutes from './routes/auth-routes.js';
import transactionRoutes from './routes/transactions.js';
import statementRoutes from './routes/statements.js';
import batchRoutes from './routes/batch-uploads.js';
import settingsRoutes from './routes/settings.js';
import accountRoutes from './routes/accounts.js';
import miscRoutes from './routes/misc.js';
import transferRoutes from './routes/transfers.js';
import basRoutes from './routes/bas.js';
import taxRoutes from './routes/tax.js';
import reportsRoutes from './routes/reports.js';
import analyticsRoutes from './routes/analytics.js';
import budgetsRoutes from './routes/budgets.js';
import dashboardRoutes from './routes/dashboard.js';
import aiAgentsRoutes from './routes/ai-agents.js';
import agentRoutesExtended from './routes/agent-routes-extended.js';
import agentStreamingRoutes from './routes/agent-streaming.js';
import migrationRoutes from './routes/migration.js';
import feedRoutes from './routes/market-feeds.js';
import priceRoutes from './routes/market-prices.js';
import indicatorRoutes from './routes/market-indicators.js';
import sentimentRoutes from './routes/market-sentiment.js';
import calendarRoutes from './routes/market-calendar.js';
import marketAlertRoutes from './routes/market-alerts.js';
import cogneeRoutes from './routes/cognee.js';
import tenantRoutes from './routes/tenants.js';
import memberRoutes from './routes/members.js';
import subscriptionRoutes from './routes/subscriptions.js';
import supplierRoutes from './routes/suppliers.js';
import billRoutes from './routes/bills.js';
import poRoutes from './routes/purchase-orders.js';
import payrollRoutes from './routes/payroll.js';
import chatRoutes from './routes/chat.js';
import agentsExtRoutes from './routes/agents-ext.js';
import taxExtRoutes from './routes/tax-ext.js';
import accountMiscRoutes from './routes/account-misc.js';
import streamSessionsRoutes from './routes/stream-sessions.js';
import migrationExtRoutes from './routes/migration-ext.js';
import chartsRoutes from './routes/charts.js';
import apiAuthRoutes from './routes/api-auth.js';
import apExtrasRoutes from './routes/ap-extras.js';
import agentsRoutes from './routes/agents.js';
import pipelineRoutes from './routes/pipeline.js';
import invoicingRoutes from './routes/invoicing-routes.js';
import invitationsExtRoutes from './routes/invitations-ext.js';
import merchantOpsRoutes from './routes/merchant-ops.js';
import transfersExtRoutes from './routes/transfers-ext.js';
import streamSchemaRoutes from './routes/stream-schema.js';
import adminExtRoutes from './routes/admin-ext.js';
import adminAuthRoutes from './routes/admin-auth-routes.js';
import { adminAuthService } from './services/admin-auth.js';

const app = new Hono();

// Seed default admin user on startup (idempotent)
adminAuthService.seedDefaultAdmin().catch((err) => {
  console.warn('[Startup] Admin seed skipped:', err instanceof Error ? err.message : err);
});

// Security headers (OWASP)
app.use('*', securityHeaders());

// Audit logging for mutation endpoints
app.use('/api/*', auditMiddleware({ logReads: false }));
app.use('/auth/*', auditMiddleware({ logReads: false }));

// Mount auth routes
app.route('/auth', authRoutes);

// Admin auth (public endpoints — must be mounted before tenant-auth-protected routes)
app.route('/api/admin', adminAuthRoutes);

// Mount extracted domain route files
// NOTE: more-specific prefixes first so Hono matches correctly
app.route('/api/statements/batch', batchRoutes);
app.route('/api/statements', statementRoutes);
app.route('/api/transactions', transactionRoutes);
app.route('/api/accounts', accountRoutes);
app.route('/api/transfers', transferRoutes);
app.route('/api/bas', basRoutes);
app.route('/api/reports', reportsRoutes);
app.route('/api/analytics', analyticsRoutes);
app.route('/api/dashboards', dashboardRoutes);
app.route('/api/cognee', cogneeRoutes);
app.route('/api/tenants', tenantRoutes);
app.route('/api/members', memberRoutes);
app.route('/api/subscriptions', subscriptionRoutes);
app.route('/api/suppliers', supplierRoutes);
app.route('/api/bills', billRoutes);
app.route('/api/purchase-orders', poRoutes);
app.route('/api/payroll', payrollRoutes);
app.route('/api/chat', chatRoutes);
// Bare /api mounts (routes define their own sub-paths)
app.route('/api', settingsRoutes);
app.route('/api', taxRoutes);
app.route('/api', budgetsRoutes);
app.route('/api', aiAgentsRoutes);
app.route('/api', agentRoutesExtended);
app.route('/api', agentStreamingRoutes);
app.route('/api', migrationRoutes);
app.route('/api/market/feeds', feedRoutes);
app.route('/api/market/prices', priceRoutes);
app.route('/api/market/indicators', indicatorRoutes);
app.route('/api/market/sentiment', sentimentRoutes);
app.route('/api/market/calendar', calendarRoutes);
app.route('/api/market/alerts', marketAlertRoutes);
app.route('/api', miscRoutes);
app.route('/api', agentsExtRoutes);
app.route('/api', taxExtRoutes);
app.route('/api', accountMiscRoutes);
app.route('/api/stream', streamSessionsRoutes);
app.route('/api', migrationExtRoutes);
app.route('/api/charts', chartsRoutes);
app.route('/api/auth', apiAuthRoutes);
app.route('/api', apExtrasRoutes);
app.route('/api/agents', agentsRoutes);
app.route('/api', pipelineRoutes);
app.route('/api', invoicingRoutes);
app.route('/api', invitationsExtRoutes);
app.route('/api', merchantOpsRoutes);
app.route('/api/transfers', transfersExtRoutes);
app.route('/api', streamSchemaRoutes);
app.route('/api', adminExtRoutes);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Apply body limit to all API routes (except uploads)
app.use(
  '/api/chat',
  bodyLimit({
    maxSize: 100 * 1024, // 100kb limit for chat requests
    onError: (c) => {
      return c.json({ error: 'Payload Too Large' }, 413);
    },
  }),
);

// Rate limiter key: prefer real IP from trusted proxy, fall back to connection addr
const getRateLimitKey = (c: Context) => {
  // x-real-ip is typically set by a trusted reverse proxy (nginx)
  const realIp = c.req.header('x-real-ip');
  // conninfo is set by Hono's node adapter with the socket remote address
  const remoteAddr = c.env?.incoming?.socket?.remoteAddress || 'unknown';
  return realIp || remoteAddr;
};

const isProd = process.env.NODE_ENV === 'production';

// General API rate limiter: production-safe limits gated by NODE_ENV
const generalLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: isProd ? 100 : 1000,
  standardHeaders: true,
  keyGenerator: getRateLimitKey,
  message: { error: 'Too many requests, please try again later.' },
});

// Strict limiter for expensive AI endpoints
const chatLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: isProd ? 10 : 100,
  standardHeaders: true,
  keyGenerator: getRateLimitKey,
  message: { error: 'Chat limit reached. Please wait a minute before trying again.' },
});

// Strict limiter for authentication endpoints — 5 attempts per 15 min in production
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: isProd ? 5 : 100,
  standardHeaders: true,
  keyGenerator: getRateLimitKey,
  message: { error: 'Too many login attempts. Please try again later.' },
});

app.use(
  '/*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:3501'],
    credentials: true,
  }),
);

// --- Wave 21: Schema initialization ---
const schemaRegistry = new SchemaRegistry();
schemaRegistry.initializeDefaults();

// --- Wave 2: Initialize mutation framework for agent orchestrator ---
orchestrator.initMutationFramework(db);
const confirmationFlow = new ConfirmationFlowService(db);

// Start stale mutation expiration timer (every 5 minutes)
setInterval(
  () => {
    confirmationFlow
      .expireStale()
      .catch((err: unknown) => console.warn('[MutationExpiry] Error:', err));
  },
  5 * 60 * 1000,
);

// Apply strict auth rate limiter to all login endpoints
app.use('/api/admin/login', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/auth/login', authLimiter);

// Apply rate limiting to API routes, but exclude statement upload/processing
app.use('/api/*', async (c, next) => {
  const path = c.req.path;
  // Skip rate limiting for statement upload and processing endpoints
  if (path.includes('/statements/upload') || path.includes('/statements/retry')) {
    return next();
  }
  return generalLimiter(c, next);
});
app.use('/api/chat', chatLimiter);

// Protect all /api routes (except public endpoints)
app.use('/api/*', async (c, next) => {
  // Public endpoints that don't require auth
  const publicPaths = [
    '/api/vertex-ai/models',
    '/api/subscriptions/plans',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/admin/login',
    '/api/admin/refresh',
  ];
  const reqPath = new URL(c.req.url).pathname;
  if (publicPaths.some((p) => reqPath === p || reqPath === p + '/')) {
    return next();
  }

  // For SSE, standard EventSource doesn't support headers, so we allow query param
  const token = c.req.query('token');
  if (token && c.req.path === '/api/events') {
    try {
      const payload = await verify(token, JWT_SECRET);
      c.set('jwtPayload', payload);
      return next();
    } catch {
      // Ignore
    }
  }
  const middleware = jwt({ secret: JWT_SECRET });
  return middleware(c, next);
});

app.get('/', (c) => {
  return c.text('GoldLedger API is running!');
});

// Health check for Cloud Run
app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const port = parseInt(process.env.PORT || '3501', 10);
// eslint-disable-next-line no-console
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
