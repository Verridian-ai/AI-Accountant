/**
 * AuditService types and interfaces.
 *
 * Extracted from audit.ts to comply with the 300-line enterprise standard.
 */

import type { AgentType } from './types.js';

/**
 * Audit log entry as stored in the database.
 */
export interface AuditEntry {
  id: string;
  mutationId?: string | null;
  sessionId?: string | null;
  agentType: AgentType;
  action: AuditAction;
  targetTable?: string | null;
  targetId?: string | null;
  beforeState?: string | null;
  afterState?: string | null;
  metadata?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

/**
 * All possible audit actions.
 */
export type AuditAction =
  | 'mutation_proposed'
  | 'mutation_confirmed'
  | 'mutation_rejected'
  | 'mutation_executed'
  | 'mutation_failed'
  | 'mutation_expired'
  | 'mutation_auto_executed'
  | 'query_executed'
  | 'tool_called'
  | 'error_occurred';

/**
 * Filters for querying the audit log.
 */
export interface AuditQueryOptions {
  agentType?: AgentType;
  action?: AuditAction;
  sessionId?: string;
  mutationId?: string;
  targetTable?: string;
  userId?: string;
  from?: string; // ISO date
  to?: string; // ISO date
  limit?: number;
  offset?: number;
}

/** Sensitive field keys for redaction (D02-SEC-07). */
export const AUDIT_SENSITIVE_KEYS = new Set([
  'tfn',
  'tax_file_number',
  'bank_account_number',
  'bsb',
  'account_number',
]);

/** Regex patterns for sensitive data redaction. */
export const TFN_PATTERN = /\b\d{3}\s?\d{3}\s?\d{3}\b/g;
export const BSB_PATTERN = /\b\d{3}-?\d{3}\b/g;

/** SQL column selection for audit log queries. */
export const AUDIT_SELECT_COLUMNS =
  `id, mutation_id as "mutationId", session_id as "sessionId", ` +
  `agent_type as "agentType", action, target_table as "targetTable", ` +
  `target_id as "targetId", before_state as "beforeState", ` +
  `after_state as "afterState", metadata, user_id as "userId", ` +
  `ip_address as "ipAddress", created_at as "createdAt"`;
