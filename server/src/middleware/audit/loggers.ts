/**
 * Audit Logging — Explicit event loggers
 *
 * Use these functions to log security events outside the middleware
 * (e.g., login attempts, password changes, data exports).
 */

import { db, auditLog } from '../../schema.js';
import crypto from 'crypto';
import type { AuditLogParams } from './types.js';

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
  userAgent?: string,
): Promise<void> {
  await logAuditEvent({
    userId,
    action: success ? 'LOGIN' : 'LOGIN_FAILED',
    entityType: 'auth',
    metadata: { username, success },
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
  userAgent?: string,
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
  userAgent?: string,
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'EXPORT',
    entityType: 'export',
    metadata: { exportType, recordCount },
    ipAddress,
    userAgent,
  });
}
