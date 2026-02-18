/**
 * Audit Logging — Types, constants, and action definitions
 */

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
  logReads: false,
  logRequestBodies: true,
  logResponseBodies: false,
  maxBodySize: 10000,
  excludePaths: ['/health', '/api/health', '/api/sse', '/favicon.ico'],
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

/** Map HTTP methods to audit actions */
export const METHOD_TO_ACTION: Record<string, AuditAction> = {
  GET: 'READ',
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

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
