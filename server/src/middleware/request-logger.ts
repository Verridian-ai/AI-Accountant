import { createMiddleware } from 'hono/factory';
import { logger as baseLogger } from '../lib/logger.js';
import crypto from 'crypto';

export const requestLogger = createMiddleware(async (c, next) => {
  const rawId = c.req.header('x-request-id');
  const requestId =
    rawId && /^[a-zA-Z0-9\-]{1,64}$/.test(rawId) ? rawId : crypto.randomUUID();
  const startTime = Date.now();

  // Create request-scoped logger
  const reqLogger = baseLogger.child({
    requestId,
    method: c.req.method,
    path: c.req.path,
  });

  // Attach to context for use in route handlers
  c.set('logger', reqLogger);
  c.set('requestId', requestId);

  // Set response header
  c.header('x-request-id', requestId);

  reqLogger.info('Request started');

  await next();

  const duration = Date.now() - startTime;
  reqLogger.info({ status: c.res.status, duration }, 'Request completed');
});
