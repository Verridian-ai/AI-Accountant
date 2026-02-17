/**
 * Team Audit Logger
 *
 * Handles audit event logging and audit log retrieval for teams.
 */

import { db, teamMembers, auditLog } from '../../schema.js';
import { eq, and, inArray, desc } from 'drizzle-orm';
import crypto from 'crypto';
import type { AuditLogEntry } from './types.js';
import { hasPermission } from './permissions.js';

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log an audit event
 */
export async function logAuditEvent(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'>,
): Promise<string> {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  await db.insert(auditLog).values({
    id,
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    metadata: entry.metadata,
    timestamp,
  });

  return id;
}

/**
 * Get audit log entries for a team
 */
export async function getTeamAuditLog(
  teamId: string,
  actorId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    action?: string;
    entityType?: string;
    limit?: number;
    offset?: number;
  },
): Promise<AuditLogEntry[]> {
  // Verify actor has permission
  if (!(await hasPermission(actorId, teamId, 'view_audit_log'))) {
    throw new Error('Permission denied: cannot view audit log');
  }

  // Get all team members
  const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId)).all();

  const memberIds = members.map((m: typeof teamMembers.$inferSelect) => m.userId);

  // Build query
  const query = db
    .select()
    .from(auditLog)
    .where(inArray(auditLog.userId, memberIds))
    .orderBy(desc(auditLog.timestamp));

  const results = await query.all();

  // Apply filters in memory (SQLite doesn't support complex dynamic queries well)
  let filtered = results;

  if (options?.startDate) {
    filtered = filtered.filter(
      (e: typeof auditLog.$inferSelect) => e.timestamp >= options.startDate!,
    );
  }
  if (options?.endDate) {
    filtered = filtered.filter(
      (e: typeof auditLog.$inferSelect) => e.timestamp <= options.endDate!,
    );
  }
  if (options?.action) {
    filtered = filtered.filter((e: typeof auditLog.$inferSelect) => e.action === options.action);
  }
  if (options?.entityType) {
    filtered = filtered.filter(
      (e: typeof auditLog.$inferSelect) => e.entityType === options.entityType,
    );
  }

  // Apply pagination
  const offset = options?.offset || 0;
  const limit = options?.limit || 100;
  filtered = filtered.slice(offset, offset + limit);

  return filtered as AuditLogEntry[];
}

/**
 * Get accountant access history (for compliance)
 */
export async function getAccountantAccessHistory(
  teamId: string,
  actorId: string,
  options?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  },
): Promise<AuditLogEntry[]> {
  // Verify actor has permission
  if (!(await hasPermission(actorId, teamId, 'view_audit_log'))) {
    throw new Error('Permission denied: cannot view access history');
  }

  // Get accountant members
  const accountants = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.role, 'accountant')))
    .all();

  if (accountants.length === 0) {
    return [];
  }

  const accountantIds = options?.userId
    ? accountants
        .filter((a: typeof teamMembers.$inferSelect) => a.userId === options.userId)
        .map((a: typeof teamMembers.$inferSelect) => a.userId)
    : accountants.map((a: typeof teamMembers.$inferSelect) => a.userId);

  if (accountantIds.length === 0) {
    return [];
  }

  // Get audit entries for accountants
  const results = await db
    .select()
    .from(auditLog)
    .where(inArray(auditLog.userId, accountantIds))
    .orderBy(desc(auditLog.timestamp))
    .all();

  // Apply filters
  let filtered = results;

  if (options?.startDate) {
    filtered = filtered.filter(
      (e: typeof auditLog.$inferSelect) => e.timestamp >= options.startDate!,
    );
  }
  if (options?.endDate) {
    filtered = filtered.filter(
      (e: typeof auditLog.$inferSelect) => e.timestamp <= options.endDate!,
    );
  }

  // Apply limit
  const limit = options?.limit || 500;
  filtered = filtered.slice(0, limit);

  return filtered as AuditLogEntry[];
}
