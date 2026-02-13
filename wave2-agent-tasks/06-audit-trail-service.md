# Agent 6: Audit Trail Service

## Role
Create the `AuditService` that provides immutable audit logging for all agent actions, mutations, tool calls, and errors. The audit log is append-only — no updates or deletes.

## Priority: SUB-WAVE 2 (After Agent 1 — needs schema)

## Files to CREATE

### 1. `server/src/services/claude/audit.ts`
**Purpose**: Immutable audit trail for agent actions

```typescript
import { v4 as uuidv4 } from 'uuid';
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
  to?: string;   // ISO date
  limit?: number;
  offset?: number;
}

/**
 * AuditService manages the immutable audit trail for all agent operations.
 *
 * Design principles:
 * - Append-only: NO UPDATE or DELETE operations on the audit log
 * - Every mutation state change is recorded
 * - Tool calls are logged for debugging and compliance
 * - Errors are logged with full context
 * - All timestamps are server-side (not client-provided)
 */
export class AuditService {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  // ── Mutation Lifecycle Events ────────────────────────

  /**
   * Log when an agent proposes a mutation.
   */
  async logMutationProposed(
    mutationId: string,
    sessionId: string,
    agentType: AgentType,
    targetTable: string,
    targetId: string | null,
    afterState: unknown,
    metadata?: Record<string, unknown>
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

  /**
   * Log when a user confirms a mutation.
   */
  async logMutationConfirmed(
    mutationId: string,
    sessionId: string,
    agentType: AgentType,
    userId?: string,
    ipAddress?: string
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

  /**
   * Log when a user rejects a mutation.
   */
  async logMutationRejected(
    mutationId: string,
    sessionId: string,
    agentType: AgentType,
    reason?: string,
    userId?: string,
    ipAddress?: string
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

  /**
   * Log when a mutation is successfully executed.
   */
  async logMutationExecuted(
    mutationId: string,
    sessionId: string,
    agentType: AgentType,
    targetTable: string,
    targetId: string | null,
    beforeState: unknown,
    afterState: unknown,
    affectedRows?: number
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
      metadata: affectedRows != null
        ? JSON.stringify({ affectedRows })
        : null,
    });
  }

  /**
   * Log when a mutation execution fails.
   */
  async logMutationFailed(
    mutationId: string,
    sessionId: string,
    agentType: AgentType,
    error: string,
    targetTable?: string
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

  /**
   * Log when a mutation expires without confirmation.
   */
  async logMutationExpired(
    mutationId: string,
    sessionId: string,
    agentType: AgentType
  ): Promise<string> {
    return this.log({
      mutationId,
      sessionId,
      agentType,
      action: 'mutation_expired',
    });
  }

  /**
   * Log when a mutation is auto-executed (skipped confirmation).
   */
  async logMutationAutoExecuted(
    mutationId: string,
    sessionId: string,
    agentType: AgentType,
    targetTable: string,
    targetId: string | null,
    confidence: number
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

  /**
   * Log when an agent executes a query.
   */
  async logQueryExecuted(
    sessionId: string,
    agentType: AgentType,
    query: string,
    durationMs?: number
  ): Promise<string> {
    return this.log({
      sessionId,
      agentType,
      action: 'query_executed',
      metadata: JSON.stringify({
        query: query.substring(0, 500), // Truncate for storage
        durationMs,
      }),
    });
  }

  /**
   * Log when an agent calls a tool.
   */
  async logToolCalled(
    sessionId: string,
    agentType: AgentType,
    toolName: string,
    toolInput?: unknown,
    toolResult?: unknown,
    durationMs?: number
  ): Promise<string> {
    return this.log({
      sessionId,
      agentType,
      action: 'tool_called',
      metadata: JSON.stringify({
        tool: toolName,
        input: toolInput,
        result: typeof toolResult === 'string'
          ? toolResult.substring(0, 1000)
          : toolResult,
        durationMs,
      }),
    });
  }

  /**
   * Log when an error occurs during agent execution.
   */
  async logError(
    sessionId: string | null,
    agentType: AgentType,
    error: string,
    context?: Record<string, unknown>
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
   * Strips TFNs, BSBs, bank account numbers, and other PII from before/after state.
   */
  private redactSensitiveFields(entry: AuditEntry): AuditEntry {
    const SENSITIVE_KEYS = new Set(['tfn', 'tax_file_number', 'bank_account_number', 'bsb', 'account_number']);
    const TFN_PATTERN = /\b\d{3}\s?\d{3}\s?\d{3}\b/g;
    const BSB_PATTERN = /\b\d{3}-?\d{3}\b/g;

    const redactJson = (jsonStr: string | null | undefined): string | null => {
      if (!jsonStr) return jsonStr ?? null;
      try {
        const obj = JSON.parse(jsonStr);
        if (typeof obj === 'object' && obj !== null) {
          for (const key of Object.keys(obj)) {
            if (SENSITIVE_KEYS.has(key.toLowerCase())) {
              obj[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'string') {
              obj[key] = obj[key].replace(TFN_PATTERN, '[TFN-REDACTED]').replace(BSB_PATTERN, '[BSB-REDACTED]');
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

  /**
   * Query the audit log with filters and pagination.
   *
   * REVISION NOTE (D02-SEC-07): Results are redacted to remove sensitive PII.
   * The `userId` filter is REQUIRED when called from the API endpoint (scoped to authenticated user).
   */
  async queryAudit(
    options?: AuditQueryOptions
  ): Promise<{ entries: AuditEntry[]; total: number }> {
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

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const [entries, countResult] = await Promise.all([
      this.db.all(
        `SELECT * FROM agent_audit_log ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      this.db.all(
        `SELECT COUNT(*) as count FROM agent_audit_log ${whereClause}`,
        params
      ),
    ]);

    return {
      entries: entries as AuditEntry[],
      total: countResult[0]?.count ?? 0,
    };
  }

  /**
   * Get audit entries for a specific mutation (full lifecycle).
   */
  async getMutationAuditTrail(mutationId: string): Promise<AuditEntry[]> {
    return (await this.db.all(
      'SELECT * FROM agent_audit_log WHERE mutation_id = ? ORDER BY created_at ASC',
      [mutationId]
    )) as AuditEntry[];
  }

  // ── Private ─────────────────────────────────────────

  private async log(entry: Partial<AuditEntry>): Promise<string> {
    const id = uuidv4();
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
        ]
      );
    } catch (error) {
      // Audit logging should NEVER throw — log the error and continue
      console.error('[AuditService] Failed to log audit entry:', error, entry);
    }

    return id;
  }
}
```

#### Key Design Decisions:
- [ ] **Append-only**: The `log()` method only does INSERTs — no UPDATE or DELETE
- [ ] **Non-throwing**: Audit logging failures are caught and logged to console — never propagated
- [ ] **All 10 audit actions covered**: mutation lifecycle (7) + query + tool + error
- [ ] **Truncation**: Long query strings truncated to 500 chars, tool results to 1000 chars
- [ ] **Pagination**: `queryAudit()` supports limit/offset with count
- [ ] **Mutation lifecycle**: `getMutationAuditTrail()` returns chronological history of a mutation

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `AuditService` class is exported
- [ ] `AuditEntry`, `AuditAction`, `AuditQueryOptions` types exported
- [ ] `logMutationProposed()` creates an audit entry with action 'mutation_proposed'
- [ ] `logMutationExecuted()` stores before/after state
- [ ] `logError()` doesn't throw even if DB write fails
- [ ] `queryAudit()` supports all filter parameters
- [ ] `getMutationAuditTrail()` returns entries in chronological order
- [ ] No modifications to any existing files
- [ ] Create marker file: `.agent-done-W2-06`

## Dependencies
- **Requires**: Agent 1 (schema — `agent_audit_log` table must exist)
- **Blocks**: Agent 7 (API endpoints need AuditService for `/api/agent-audit`)
