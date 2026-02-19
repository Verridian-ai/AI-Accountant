/**
 * AuditService — Immutable audit trail for all agent operations.
 *
 * Design principles:
 * - Append-only: NO UPDATE or DELETE operations on the audit log
 * - Every mutation state change is recorded
 * - Non-throwing: Audit logging failures are caught internally — never propagated
 *
 * REVISION NOTES:
 * - D02-SEC-07: Sensitive fields (TFN, BSB, bank account numbers) are redacted in query results
 * - D05: Audit trail is immutable — only INSERTs, no UPDATE/DELETE
 */

import type { AgentType } from '../types.js';
import type { PgDbAdapter } from '../../../db/pg-db.js';
import {
  type AuditEntry,
  type AuditAction,
  type AuditQueryOptions,
  AUDIT_SENSITIVE_KEYS,
  TFN_PATTERN,
  BSB_PATTERN,
  AUDIT_SELECT_COLUMNS,
} from '../audit-types.js';

export type { AuditEntry, AuditAction, AuditQueryOptions };

/**
 * AuditService manages the immutable audit trail for all agent operations.
 *
 * Uses the project-wide db wrapper pattern (db.run, db.all, db.get)
 * with parameterized queries for SQL injection safety.
 */
export class AuditService {
  private db: PgDbAdapter;

  constructor(db: PgDbAdapter) {
    this.db = db;
  }

  // ── Mutation Lifecycle Events ────────────────────────

  async logMutationProposed(
    mutationId: string,
    sessionId: string,
    agentType: AgentType,
    targetTable: string,
    targetId: string | null,
    afterState: unknown,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    return this.log({
      mutationId,
      sessionId,
      agentType,
      action: 'mutation_proposed',
      targetTable,
      targetId,
      afterState: JSON.stringify(afterState),
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  }

  async logMutationConfirmed(
    mutationId: string,
    sessionId: string,
    agentType: AgentType,
    userId?: string,
    ipAddress?: string,
  ): Promise<string> {
    return this.log({
      mutationId,
      sessionId,
      agentType,
      action: 'mutation_confirmed',
      userId,
      ipAddress,
    });
  }

  async logMutationRejected(
    mutationId: string,
    sessionId: string,
    agentType: AgentType,
    reason?: string,
    userId?: string,
    ipAddress?: string,
  ): Promise<string> {
    return this.log({
      mutationId,
      sessionId,
      agentType,
      action: 'mutation_rejected',
      userId,
      ipAddress,
      metadata: reason ? JSON.stringify({ reason }) : null,
    });
  }

  async logMutationExecuted(
    mutationId: string,
    sessionId: string,
    agentType: AgentType,
    targetTable: string,
    targetId: string | null,
    beforeState: unknown,
    afterState: unknown,
    affectedRows?: number,
  ): Promise<string> {
    return this.log({
      mutationId,
      sessionId,
      agentType,
      action: 'mutation_executed',
      targetTable,
      targetId,
      beforeState: beforeState ? JSON.stringify(beforeState) : null,
      afterState: JSON.stringify(afterState),
      metadata: affectedRows != null ? JSON.stringify({ affectedRows }) : null,
    });
  }

  async logMutationFailed(
    mutationId: string,
    sessionId: string,
    agentType: AgentType,
    error: string,
    targetTable?: string,
  ): Promise<string> {
    return this.log({
      mutationId,
      sessionId,
      agentType,
      action: 'mutation_failed',
      targetTable,
      metadata: JSON.stringify({ error }),
    });
  }

  async logMutationExpired(
    mutationId: string,
    sessionId: string,
    agentType: AgentType,
  ): Promise<string> {
    return this.log({ mutationId, sessionId, agentType, action: 'mutation_expired' });
  }

  async logMutationAutoExecuted(
    mutationId: string,
    sessionId: string,
    agentType: AgentType,
    targetTable: string,
    targetId: string | null,
    confidence: number,
  ): Promise<string> {
    return this.log({
      mutationId,
      sessionId,
      agentType,
      action: 'mutation_auto_executed',
      targetTable,
      targetId,
      metadata: JSON.stringify({ confidence }),
    });
  }

  // ── Agent Activity Events ───────────────────────────

  async logQueryExecuted(
    sessionId: string,
    agentType: AgentType,
    query: string,
    durationMs?: number,
  ): Promise<string> {
    return this.log({
      sessionId,
      agentType,
      action: 'query_executed',
      metadata: JSON.stringify({ query: query.substring(0, 500), durationMs }),
    });
  }

  async logToolCalled(
    sessionId: string,
    agentType: AgentType,
    toolName: string,
    toolInput?: unknown,
    toolResult?: unknown,
    durationMs?: number,
  ): Promise<string> {
    return this.log({
      sessionId,
      agentType,
      action: 'tool_called',
      metadata: JSON.stringify({
        tool: toolName,
        input: toolInput,
        result: typeof toolResult === 'string' ? toolResult.substring(0, 1000) : toolResult,
        durationMs,
      }),
    });
  }

  async logError(
    sessionId: string | null,
    agentType: AgentType,
    error: string,
    context?: Record<string, unknown>,
  ): Promise<string> {
    return this.log({
      sessionId,
      agentType,
      action: 'error_occurred',
      metadata: JSON.stringify({ error, ...context }),
    });
  }

  // ── Query ───────────────────────────────────────────

  /**
   * REVISION NOTE (D02-SEC-07): Redact sensitive fields from audit log entries.
   */
  private redactSensitiveFields(entry: AuditEntry): AuditEntry {
    const redactJson = (jsonStr: string | null | undefined): string | null => {
      if (!jsonStr) return jsonStr ?? null;
      try {
        const obj = JSON.parse(jsonStr) as Record<string, unknown>;
        if (typeof obj === 'object' && obj !== null) {
          for (const key of Object.keys(obj)) {
            if (AUDIT_SENSITIVE_KEYS.has(key.toLowerCase())) {
              obj[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'string') {
              obj[key] = (obj[key] as string)
                .replace(TFN_PATTERN, '[TFN-REDACTED]')
                .replace(BSB_PATTERN, '[BSB-REDACTED]');
            }
          }
        }
        return JSON.stringify(obj);
      } catch {
        return jsonStr;
      }
    };
    return {
      ...entry,
      beforeState: redactJson(entry.beforeState),
      afterState: redactJson(entry.afterState),
      metadata: redactJson(entry.metadata),
    };
  }

  async queryAudit(options?: AuditQueryOptions): Promise<{ entries: AuditEntry[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options?.agentType) {
      conditions.push('agent_type = ?');
      params.push(options.agentType);
    }
    if (options?.action) {
      conditions.push('action = ?');
      params.push(options.action);
    }
    if (options?.sessionId) {
      conditions.push('session_id = ?');
      params.push(options.sessionId);
    }
    if (options?.mutationId) {
      conditions.push('mutation_id = ?');
      params.push(options.mutationId);
    }
    if (options?.targetTable) {
      conditions.push('target_table = ?');
      params.push(options.targetTable);
    }
    if (options?.userId) {
      conditions.push('user_id = ?');
      params.push(options.userId);
    }
    if (options?.from) {
      conditions.push('created_at >= ?');
      params.push(options.from);
    }
    if (options?.to) {
      conditions.push('created_at <= ?');
      params.push(options.to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    try {
      const [entries, countResult] = await Promise.all([
        this.db.all(
          `SELECT ${AUDIT_SELECT_COLUMNS} FROM agent_audit_log ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        ),
        this.db.all(`SELECT COUNT(*) as count FROM agent_audit_log ${whereClause}`, params),
      ]);

      const redactedEntries = (entries as unknown as AuditEntry[]).map((e) =>
        this.redactSensitiveFields(e),
      );
      return {
        entries: redactedEntries,
        total: ((countResult[0] as Record<string, unknown> | undefined)?.count as number) ?? 0,
      };
    } catch (error) {
      console.error('[AuditService] Failed to query audit log:', error);
      return { entries: [], total: 0 };
    }
  }

  async getMutationAuditTrail(mutationId: string): Promise<AuditEntry[]> {
    try {
      const entries = (await this.db.all(
        `SELECT ${AUDIT_SELECT_COLUMNS} FROM agent_audit_log WHERE mutation_id = ? ORDER BY created_at ASC`,
        [mutationId],
      )) as unknown as AuditEntry[];
      return entries.map((e) => this.redactSensitiveFields(e));
    } catch (error) {
      console.error('[AuditService] Failed to get mutation audit trail:', error);
      return [];
    }
  }

  async getSessionAuditTrail(sessionId: string): Promise<AuditEntry[]> {
    try {
      const entries = (await this.db.all(
        `SELECT ${AUDIT_SELECT_COLUMNS} FROM agent_audit_log WHERE session_id = ? ORDER BY created_at ASC`,
        [sessionId],
      )) as unknown as AuditEntry[];
      return entries.map((e) => this.redactSensitiveFields(e));
    } catch (error) {
      console.error('[AuditService] Failed to get session audit trail:', error);
      return [];
    }
  }

  // ── Private ─────────────────────────────────────────

  private async log(entry: Partial<AuditEntry>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await this.db.run(
        `INSERT INTO agent_audit_log (
          id, mutation_id, session_id, agent_type, action,
          target_table, target_id, before_state, after_state,
          metadata, user_id, ip_address, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          entry.mutationId ?? null,
          entry.sessionId ?? null,
          entry.agentType,
          entry.action,
          entry.targetTable ?? null,
          entry.targetId ?? null,
          entry.beforeState ?? null,
          entry.afterState ?? null,
          entry.metadata ?? null,
          entry.userId ?? null,
          entry.ipAddress ?? null,
          now,
        ],
      );
    } catch (error) {
      console.error('[AuditService] Failed to log audit entry:', error, {
        action: entry.action,
        agentType: entry.agentType,
        mutationId: entry.mutationId,
      });
    }
    return id;
  }
}
