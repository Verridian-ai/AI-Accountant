/**
 * Audit Logging Middleware
 *
 * Logs all sensitive operations for compliance and security monitoring.
 * Integrates with the audit_log table in the database.
 */

import { Context, MiddlewareHandler, Next } from 'hono';
import { db, auditLog } from '../schema.js';
import crypto from 'crypto';

// ============================================================================
// AUDIT CONFIGURATION
// ============================================================================

export interface AuditConfig {
  /** Enable/disable audit logging */
  enabled: boolean;
  /** Log read operations (can be verbose) */
  logReads: boolean;
  /** Log request bodies for mutations */
  logRequestBodies: boolean;
  /** Log response bodies */
  logResponseBodies: boolean;
  /** Maximum body size to log (bytes) */
  maxBodySize: number;
  /** Paths to exclude from logging */
  excludePaths: string[];
  /** Sensitive fields to redact */
  sensitiveFields: string[];
}

export const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  enabled: true,
  logReads: false, // Don't log GET requests by default (too verbose)
  logRequestBodies: true,
  logResponseBodies: false,
  maxBodySize: 10000, // 10KB
  excludePaths: [
    '/health',
    '/api/health',
    '/api/sse',
    '/favicon.ico',
  ],
  sensitiveFields: [
    'password',
    'passwordHash',
    'token',
    'refreshToken',
    'apiKey',
    'secret',
    'creditCard',
    'ssn',
    'accountNumber',
  ],
};

// ============================================================================
// AUDIT ACTION TYPES
// ============================================================================

export type AuditAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGE'
  | 'SETTINGS_CHANGE'
  | 'EXPORT'
  | 'IMPORT'
  | 'ADMIN_ACTION';

// Map HTTP methods to audit actions
const METHOD_TO_ACTION: Record<string, AuditAction> = {
  GET: 'READ',
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

// ============================================================================
// ENTITY TYPE EXTRACTION
// ============================================================================

interface EntityInfo {
  entityType: string;
  entityId?: string;
}

/**
 * Extract entity type and ID from request path
 */
function extractEntityInfo(path: string, method: string): EntityInfo {
  // Remove query string and leading slash
  const cleanPath = path.split('?')[0].replace(/^\/+/, '');
  const segments = cleanPath.split('/');

  // Common patterns:
  // /api/transactions/:id -> entityType: 'transaction', entityId: :id
  // /api/statements/:id/reprocess -> entityType: 'statement', entityId: :id
  // /auth/login -> entityType: 'auth', entityId: undefined

  if (segments[0] === 'api' && segments.length >= 2) {
    const resource = segments[1];
    const entityType = singularize(resource);
    const entityId = segments[2] && !isAction(segments[2]) ? segments[2] : undefined;

    return { entityType, entityId };
  }

  if (segments[0] === 'auth') {
    return { entityType: 'auth', entityId: undefined };
  }

  return { entityType: segments[0] || 'unknown', entityId: undefined };
}

/**
 * Convert plural resource name to singular
 */
function singularize(word: string): string {
  if (word.endsWith('ies')) {
    return word.slice(0, -3) + 'y';
  }
  if (word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Check if segment is an action rather than an ID
 */
function isAction(segment: string): boolean {
  const actions = [
    'reprocess', 'split', 'export', 'import', 'calculate',
    'resolve', 'bulk-link', 'auto-detect', 'gap-analysis',
    'categorize-gst', 'balance-history', 'credit-analytics',
  ];
  return actions.includes(segment);
}

// ============================================================================
// DATA REDACTION
// ============================================================================

/**
 * Redact sensitive fields from an object
 */
function redactSensitiveData(
  data: unknown,
  sensitiveFields: string[]
): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item, sensitiveFields));
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (sensitiveFields.some(field =>
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        result[key] = redactSensitiveData(value, sensitiveFields);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return data;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Audit logging middleware factory
 */
export function auditMiddleware(
  customConfig?: Partial<AuditConfig>
): MiddlewareHandler {
  const config = { ...DEFAULT_AUDIT_CONFIG, ...customConfig };

  return async (c: Context, next: Next) => {
    // Check if audit logging is enabled
    if (!config.enabled) {
      await next();
      return;
    }

    // Check if path should be excluded
    const path = c.req.path;
    if (config.excludePaths.some(excluded => path.startsWith(excluded))) {
      await next();
      return;
    }

    const method = c.req.method;

    // Skip reads if not configured to log them
    if (!config.logReads && method === 'GET') {
      await next();
      return;
    }

    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    // Extract entity info
    const { entityType, entityId } = extractEntityInfo(path, method);

    // Get user ID from JWT context (if authenticated)
    const userId = c.get('jwtPayload')?.userId as string | undefined;

    // Capture request body for mutations
    // NOTE: We use c.req.raw.clone() to avoid consuming the body stream,
    // which would prevent the route handler from reading it.
    let requestBody: unknown = undefined;
    if (config.logRequestBodies && ['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const contentType = c.req.header('content-type') || '';
        if (contentType.includes('application/json')) {
          // Clone the request to preserve the original body for the route handler
          const clonedRequest = c.req.raw.clone();
          requestBody = await clonedRequest.json();
          requestBody = redactSensitiveData(requestBody, config.sensitiveFields);
        }
      } catch {
        // Ignore body parsing errors
      }
    }

    // Determine action
    let action: AuditAction = METHOD_TO_ACTION[method] || 'READ';

    // Override action for specific paths
    if (path.includes('/auth/login')) {
      action = 'LOGIN';
    } else if (path.includes('/auth/logout')) {
      action = 'LOGOUT';
    } else if (path.includes('/export')) {
      action = 'EXPORT';
    } else if (path.includes('/import')) {
      action = 'IMPORT';
    }

    // Execute the request
    let error: Error | null = null;
    try {
      await next();
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
      throw e;
    } finally {
      const durationMs = Date.now() - startTime;
      const statusCode = c.res.status;

      // Update action if login failed
      if (action === 'LOGIN' && statusCode >= 400) {
        action = 'LOGIN_FAILED';
      }

      // Create audit log entry
      try {
        await db.insert(auditLog).values({
          id: requestId,
          userId: userId || null,
          action,
          entityType,
          entityId: entityId || null,
          oldValue: null, // Would need to fetch before update for this
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
        // Log to console if database write fails
        console.error('Failed to write audit log:', dbError);
      }
    }
  };
}

/**
 * Validate IP address format (basic validation)
 */
function isValidIpFormat(ip: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 pattern (simplified - allows common formats)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  if (ipv4Pattern.test(ip)) {
    // Validate each octet is 0-255
    const octets = ip.split('.');
    return octets.every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  return ipv6Pattern.test(ip);
}

/**
 * Get client IP address from request
 *
 * SECURITY NOTE: This function validates IP format to prevent header injection.
 * In production, you should also:
 * 1. Configure trusted proxy count (e.g., TRUSTED_PROXY_HOPS=1)
 * 2. Validate against known proxy IPs if possible
 * 3. Consider using a reverse proxy that sets a trusted header
 */
function getClientIp(c: Context): string | null {
  // Check common proxy headers
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP (client IP when behind a single proxy)
    // For multiple proxies, you should take the nth from the right
    // where n is the number of trusted proxies
    const clientIp = forwardedFor.split(',')[0].trim();

    // Validate IP format to prevent header injection attacks
    if (isValidIpFormat(clientIp)) {
      return clientIp;
    }
    // If invalid format, fall through to other methods
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    const trimmedIp = realIp.trim();
    if (isValidIpFormat(trimmedIp)) {
      return trimmedIp;
    }
  }

  // Fallback to connection IP (if available through Hono)
  return null;
}

/**
 * Build audit metadata with safe URL parsing and query param redaction
 */
function buildAuditMetadata(
  c: Context,
  requestId: string,
  sensitiveFields: string[]
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    requestId,
    contentType: c.req.header('content-type'),
  };

  // Safely parse URL and redact sensitive query params
  try {
    const url = new URL(c.req.url);
    const queryParams: Record<string, string> = {};

    for (const [key, value] of url.searchParams.entries()) {
      // Check if this query param key contains any sensitive field name
      const isSensitive = sensitiveFields.some(field =>
        key.toLowerCase().includes(field.toLowerCase())
      );
      queryParams[key] = isSensitive ? '[REDACTED]' : value;
    }

    metadata.queryParams = queryParams;
  } catch {
    // URL parsing failed - log the error but don't fail the audit
    metadata.queryParams = { _error: 'Failed to parse URL' };
  }

  return metadata;
}

// ============================================================================
// EXPLICIT AUDIT LOGGING
// ============================================================================

export interface AuditLogParams {
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Explicitly log an audit event (for use outside middleware)
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      userId: params.userId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
      newValue: params.newValue ? JSON.stringify(params.newValue) : null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      requestPath: null,
      requestMethod: null,
      statusCode: null,
      durationMs: null,
      errorMessage: null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Log a login attempt
 */
export async function logLoginAttempt(
  username: string,
  success: boolean,
  userId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    action: success ? 'LOGIN' : 'LOGIN_FAILED',
    entityType: 'auth',
    metadata: {
      username,
      success,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log a password change
 */
export async function logPasswordChange(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'PASSWORD_CHANGE',
    entityType: 'user',
    entityId: userId,
    ipAddress,
    userAgent,
  });
}

/**
 * Log a data export
 */
export async function logDataExport(
  userId: string,
  exportType: string,
  recordCount: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'EXPORT',
    entityType: 'export',
    metadata: {
      exportType,
      recordCount,
    },
    ipAddress,
    userAgent,
  });
}
