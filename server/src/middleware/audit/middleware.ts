/**
 * Audit Logging — Middleware factory
 */

import { Context, MiddlewareHandler, Next } from 'hono';
import { db, auditLog } from '../../schema.js';
import crypto from 'crypto';
import {
  type AuditConfig,
  type AuditAction,
  DEFAULT_AUDIT_CONFIG,
  METHOD_TO_ACTION,
} from './types.js';
import {
  extractEntityInfo,
  redactSensitiveData,
  getClientIp,
  buildAuditMetadata,
} from './helpers.js';

/**
 * Audit logging middleware factory
 */
export function auditMiddleware(customConfig?: Partial<AuditConfig>): MiddlewareHandler {
  const config = { ...DEFAULT_AUDIT_CONFIG, ...customConfig };

  return async (c: Context, next: Next) => {
    if (!config.enabled) {
      await next();
      return;
    }

    const path = c.req.path;
    if (config.excludePaths.some((excluded) => path.startsWith(excluded))) {
      await next();
      return;
    }

    const method = c.req.method;
    if (!config.logReads && method === 'GET') {
      await next();
      return;
    }

    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    const { entityType, entityId } = extractEntityInfo(path);
    const userId = c.get('jwtPayload')?.userId as string | undefined;

    let requestBody: unknown = undefined;
    if (config.logRequestBodies && ['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const contentType = c.req.header('content-type') || '';
        if (contentType.includes('application/json')) {
          const clonedRequest = c.req.raw.clone();
          requestBody = await clonedRequest.json();
          requestBody = redactSensitiveData(requestBody, config.sensitiveFields);
        }
      } catch {
        // Ignore body parsing errors
      }
    }

    let action: AuditAction = METHOD_TO_ACTION[method] || 'READ';
    if (path.includes('/auth/login')) {
      action = 'LOGIN';
    } else if (path.includes('/auth/logout')) {
      action = 'LOGOUT';
    } else if (path.includes('/export')) {
      action = 'EXPORT';
    } else if (path.includes('/import')) {
      action = 'IMPORT';
    }

    let error: Error | null = null;
    try {
      await next();
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
      throw e;
    } finally {
      const durationMs = Date.now() - startTime;
      const statusCode = c.res.status;

      if (action === 'LOGIN' && statusCode >= 400) {
        action = 'LOGIN_FAILED';
      }

      try {
        await db.insert(auditLog).values({
          id: requestId,
          userId: userId || null,
          action,
          entityType,
          entityId: entityId || null,
          oldValue: null,
          newValue: requestBody ? JSON.stringify(requestBody).slice(0, config.maxBodySize) : null,
          ipAddress: getClientIp(c),
          userAgent: c.req.header('user-agent') || null,
          requestPath: path,
          requestMethod: method,
          statusCode,
          durationMs,
          errorMessage: error?.message || null,
          metadata: JSON.stringify(buildAuditMetadata(c, requestId, config.sensitiveFields)),
          timestamp: new Date().toISOString(),
        });
      } catch (dbError) {
        console.error('Failed to write audit log:', dbError);
      }
    }
  };
}
