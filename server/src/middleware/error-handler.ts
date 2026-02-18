/**
 * Global Error Handler Middleware
 *
 * Catches all unhandled errors from route handlers and returns
 * consistent JSON error responses. Uses the existing error hierarchy
 * from server/src/errors.ts.
 *
 * Registered via app.onError(globalErrorHandler) in index.ts.
 */

import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { BaseError, isOperationalError, toHttpError } from '../errors.js';
import { logger } from '../lib/logger.js';

export function globalErrorHandler(err: Error, c: Context): Response {
  const httpError = toHttpError(err);

  // Log with full context — operational errors are expected (warn),
  // unexpected errors are bugs (error)
  const logContext = {
    err,
    path: c.req.path,
    method: c.req.method,
    status: httpError.status,
  };

  if (isOperationalError(err)) {
    logger.warn(logContext, 'Operational error');
  } else {
    logger.error(logContext, 'Unexpected error');
  }

  // Build consistent response body
  const body: Record<string, unknown> = {
    error: err instanceof BaseError ? err.message : 'An unexpected error occurred',
    code: err instanceof BaseError ? err.code : 'INTERNAL_ERROR',
  };

  // Include validation errors if present
  if (err instanceof BaseError && 'errors' in err) {
    body.errors = (err as BaseError & { errors: unknown }).errors;
  }

  // Stack trace is logged server-side (above) — never exposed in HTTP responses
  return c.json(body, httpError.status as ContentfulStatusCode);
}
