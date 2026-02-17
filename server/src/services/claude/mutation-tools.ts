/**
 * MutationTools — Core mutation proposal/execution engine for Claude agents.
 *
 * Agents NEVER write directly to the database. Instead they call
 * `proposeMutation()` which creates a tracked mutation record that
 * flows through the confirmation pipeline:
 *
 *   proposed → pending_confirmation → confirmed → executing → executed
 *                                   ↘ rejected
 *                   ↘ expired (after 15 min TTL)
 *
 * Auto-execute path (requiresConfirmation = false):
 *   proposed → executing → executed
 *
 * Security: Table and column names are validated against a whitelist
 * before any SQL is constructed (D01-CRIT-01).
 */

import type { AgentType } from './types.js';
import { events } from '../../events.js';

// ── Mutation Status Lifecycle ─────────────────────────────────────

export type MutationStatus =
  | 'proposed'
  | 'pending_confirmation'
  | 'confirmed'
  | 'executing'
  | 'executed'
  | 'rejected'
  | 'expired'
  | 'failed';

// ── Interfaces ────────────────────────────────────────────────────

/** Agent-facing proposal — what the agent submits when it wants a DB change. */
export interface MutationProposal {
  agentType: AgentType;
  mutationType: 'create' | 'update' | 'delete' | 'batch_update';
  targetTable: string;
  targetId?: string;
  targetIds?: string[];
  beforeState?: unknown;
  afterState: unknown;
  description: string;
  confidence?: number;
  requiresConfirmation?: boolean;
}

/** Persisted mutation record stored in the `agent_mutations` table. */
export interface AgentMutation {
  id: string;
  sessionId: string;
  agentType: AgentType;
  mutationType: string;
  targetTable: string;
  targetId: string | null;
  targetIds: string | null;
  beforeState: string | null;
  afterState: string;
  description: string;
  status: MutationStatus;
  confidence: number | null;
  requiresConfirmation: boolean;
  confirmedAt: string | null;
  executedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  errorMessage: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Result returned after attempting to execute a mutation. */
export interface MutationExecutionResult {
  success: boolean;
  mutationId: string;
  error?: string;
  affectedRows?: number;
}

// ── Default TTL for unconfirmed mutations (15 minutes) ────────────
const MUTATION_EXPIRY_MS = 15 * 60 * 1000;

// ── SQL Injection Prevention (D01-CRIT-01) ────────────────────────

/** Safe identifier regex: lowercase alpha + underscore, no special chars. */
const SAFE_IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

/**
 * Whitelist of tables that agents are allowed to mutate.
 * Any table NOT in this set is rejected before SQL is built.
 */
const MUTABLE_TABLES = new Set([
  'transactions',
  'accounts',
  'merchant_memory',
  'pending_categorization',
  'bas_calculations',
  'bas_periods',
  'transfer_links',
  'reconciliation_alerts',
  'deductions',
  'tax_strategies',
  'report_snapshots',
  'kpi_metrics',
  'budgets',
  'budget_lines',
  'budget_vs_actual',
  'forecast_scenarios',
  'forecast_periods',
  'ocr_documents',
  'ocr_line_items',
  'payment_matches',
  'payment_match_rules',
  'inventory_items',
  'inventory_stock',
  'inventory_movements',
  'bank_recon_matches',
  'bank_recon_rules',
  'bank_recon_sessions',
  'fixed_assets',
  'asset_depreciation',
  'asset_disposals',
  'inter_entity_transactions',
  'consolidation_snapshots',
  'consolidation_snapshot_lines',
  'wage_payments',
  'statements',
]);

// ── MutationTools Class ───────────────────────────────────────────

/**
 * Provides a standardized interface for Claude agents to propose
 * database mutations that flow through the confirmation pipeline.
 *
 * Usage:
 * ```ts
 * const tools = new MutationTools(db, sessionId);
 * const mutation = await tools.proposeMutation({
 *   agentType: 'transaction_categorizer',
 *   mutationType: 'update',
 *   targetTable: 'transactions',
 *   targetId: '123',
 *   afterState: { category: 'Office Supplies' },
 *   description: 'Categorize transaction as Office Supplies',
 *   confidence: 0.95,
 * });
 * ```
 */
interface MutationDb {
  all(sql: string, params?: unknown[]): Promise<Array<Record<string, unknown>>>;
  run(sql: string, params?: unknown[]): Promise<{ changes?: number } | undefined>;
}

export class MutationTools {
  private db: MutationDb;
  private sessionId: string;

  constructor(db: MutationDb | Record<string, unknown>, sessionId: string) {
    this.db = db as MutationDb;
    this.sessionId = sessionId;
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Propose a single mutation. Returns the persisted mutation record.
   *
   * If `requiresConfirmation` is false, the mutation status starts
   * as `proposed` (ready for auto-execution by ConfirmationFlowService).
   * Otherwise it enters `pending_confirmation` awaiting user action.
   */
  async proposeMutation(proposal: MutationProposal): Promise<AgentMutation> {
    // Validate table name against whitelist (D01-CRIT-01)
    this.validateTableName(proposal.targetTable);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const requiresConfirmation = proposal.requiresConfirmation ?? true;

    const expiresAt = requiresConfirmation
      ? new Date(Date.now() + MUTATION_EXPIRY_MS).toISOString()
      : null;

    const mutation: AgentMutation = {
      id,
      sessionId: this.sessionId,
      agentType: proposal.agentType,
      mutationType: proposal.mutationType,
      targetTable: proposal.targetTable,
      targetId: proposal.targetId ?? null,
      targetIds: proposal.targetIds ? JSON.stringify(proposal.targetIds) : null,
      beforeState: proposal.beforeState != null ? JSON.stringify(proposal.beforeState) : null,
      afterState: JSON.stringify(proposal.afterState),
      description: proposal.description,
      status: requiresConfirmation ? 'pending_confirmation' : 'proposed',
      confidence: proposal.confidence ?? null,
      requiresConfirmation,
      confirmedAt: null,
      executedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      errorMessage: null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.insertMutation(mutation);
      this.broadcastMutationEvent('mutation_proposed', mutation);
      await this.incrementSessionMutationCount();
    } catch (error) {
      console.error('[MutationTools] Failed to propose mutation:', error);
      throw error;
    }

    return mutation;
  }

  /**
   * Propose multiple mutations in a batch (e.g., bulk categorization).
   * Each becomes an individual mutation record for granular confirm/reject.
   */
  async batchProposeMutations(proposals: MutationProposal[]): Promise<AgentMutation[]> {
    const mutations: AgentMutation[] = [];
    for (const proposal of proposals) {
      const mutation = await this.proposeMutation(proposal);
      mutations.push(mutation);
    }
    return mutations;
  }

  /**
   * Execute a confirmed mutation against the database.
   * Called by ConfirmationFlowService after user confirmation
   * (or immediately for auto-execute mutations).
   */
  async executeMutation(mutationId: string): Promise<MutationExecutionResult> {
    const mutation = await this.getMutation(mutationId);
    if (!mutation) {
      return { success: false, mutationId, error: 'Mutation not found' };
    }

    if (mutation.status !== 'confirmed' && mutation.status !== 'proposed') {
      return {
        success: false,
        mutationId,
        error: `Cannot execute mutation in status: ${mutation.status}`,
      };
    }

    // Mark as executing
    await this.updateMutationStatus(mutationId, 'executing');

    try {
      const afterState = JSON.parse(mutation.afterState);
      let affectedRows = 0;

      switch (mutation.mutationType) {
        case 'update':
          affectedRows = await this.executeUpdate(
            mutation.targetTable,
            mutation.targetId!,
            afterState,
          );
          break;
        case 'create':
          affectedRows = await this.executeCreate(mutation.targetTable, afterState);
          break;
        case 'delete':
          affectedRows = await this.executeDelete(mutation.targetTable, mutation.targetId!);
          break;
        case 'batch_update': {
          const targetIds: string[] = mutation.targetIds ? JSON.parse(mutation.targetIds) : [];
          affectedRows = await this.executeBatchUpdate(mutation.targetTable, targetIds, afterState);
          break;
        }
        default:
          throw new Error(`Unknown mutation type: ${mutation.mutationType}`);
      }

      await this.updateMutationStatus(mutationId, 'executed', {
        executedAt: new Date().toISOString(),
      });

      this.broadcastMutationEvent('mutation_executed', mutation);

      return { success: true, mutationId, affectedRows };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.updateMutationStatus(mutationId, 'failed', {
        errorMessage,
      });

      this.broadcastMutationEvent('mutation_failed', {
        ...mutation,
        errorMessage,
      });

      return { success: false, mutationId, error: errorMessage };
    }
  }

  /**
   * Fetch a single mutation record by ID.
   */
  async getMutation(mutationId: string): Promise<AgentMutation | null> {
    try {
      const rows = await this.db.all('SELECT * FROM agent_mutations WHERE id = ?', [mutationId]);
      return rows.length > 0 ? this.rowToMutation(rows[0]) : null;
    } catch (error) {
      console.error('[MutationTools] Failed to fetch mutation:', error);
      return null;
    }
  }

  /**
   * List mutations for the current session, optionally filtered by status.
   */
  async getSessionMutations(status?: MutationStatus): Promise<AgentMutation[]> {
    try {
      if (status) {
        const rows = await this.db.all(
          'SELECT * FROM agent_mutations WHERE session_id = ? AND status = ? ORDER BY created_at DESC',
          [this.sessionId, status],
        );
        return rows.map((r: Record<string, unknown>) => this.rowToMutation(r));
      }
      const rows = await this.db.all(
        'SELECT * FROM agent_mutations WHERE session_id = ? ORDER BY created_at DESC',
        [this.sessionId],
      );
      return rows.map((r: Record<string, unknown>) => this.rowToMutation(r));
    } catch (error) {
      console.error('[MutationTools] Failed to list session mutations:', error);
      return [];
    }
  }

  /**
   * List all pending (unconfirmed, unexpired) mutations for a given session.
   * Used by the `/api/chat/pending` endpoint.
   */
  async getPendingMutations(sessionId?: string): Promise<AgentMutation[]> {
    const sid = sessionId ?? this.sessionId;
    try {
      const rows = await this.db.all(
        `SELECT * FROM agent_mutations
         WHERE session_id = ? AND status = 'pending_confirmation'
         ORDER BY created_at DESC`,
        [sid],
      );
      return rows.map((r: Record<string, unknown>) => this.rowToMutation(r));
    } catch (error) {
      console.error('[MutationTools] Failed to list pending mutations:', error);
      return [];
    }
  }

  /**
   * Expire stale mutations that have passed their TTL without confirmation.
   * Called periodically by ConfirmationFlowService.
   */
  async expireStale(): Promise<number> {
    const now = new Date().toISOString();
    try {
      const result = await this.db.run(
        `UPDATE agent_mutations
         SET status = 'expired', updated_at = ?
         WHERE status = 'pending_confirmation' AND expires_at IS NOT NULL AND expires_at < ?`,
        [now, now],
      );
      const count = result?.changes ?? 0;
      if (count > 0) {
        console.log(`[MutationTools] Expired ${count} stale mutation(s)`);
      }
      return count;
    } catch (error) {
      console.error('[MutationTools] Failed to expire stale mutations:', error);
      return 0;
    }
  }

  /**
   * Update a mutation's status. Used by ConfirmationFlowService for
   * confirm/reject operations.
   */
  async updateMutationStatus(
    mutationId: string,
    status: MutationStatus,
    extra?: Record<string, string | null>,
  ): Promise<void> {
    const now = new Date().toISOString();
    let sql = 'UPDATE agent_mutations SET status = ?, updated_at = ?';
    const params: (string | number | null)[] = [status, now];

    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        // Convert camelCase to snake_case for DB column names
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        // Validate the derived column name to prevent injection
        if (!SAFE_IDENTIFIER_RE.test(snakeKey)) {
          throw new Error(`Invalid column name derived from key: '${key}'`);
        }
        sql += `, ${snakeKey} = ?`;
        params.push(value);
      }
    }

    sql += ' WHERE id = ?';
    params.push(mutationId);

    await this.db.run(sql, params);
  }

  // ── Getters ───────────────────────────────────────────────────

  getSessionId(): string {
    return this.sessionId;
  }

  // ── Validation (D01-CRIT-01) ──────────────────────────────────

  /**
   * Validate that a table name is in the mutable whitelist
   * and matches the safe identifier pattern.
   */
  private validateTableName(table: string): void {
    if (!SAFE_IDENTIFIER_RE.test(table)) {
      throw new Error(
        `Invalid table name: '${table}' — must be lowercase alphanumeric with underscores`,
      );
    }
    if (!MUTABLE_TABLES.has(table)) {
      throw new Error(`Table '${table}' is not in the mutation whitelist — mutation denied`);
    }
  }

  /**
   * Validate that all column names match the safe identifier pattern.
   * Rejects any column that could be used for SQL injection.
   */
  private validateColumnNames(columns: string[]): void {
    for (const col of columns) {
      if (!SAFE_IDENTIFIER_RE.test(col)) {
        throw new Error(
          `Invalid column name: '${col}' — must be lowercase alphanumeric with underscores`,
        );
      }
    }
  }

  // ── SQL Execution Helpers ─────────────────────────────────────

  private async executeUpdate(
    table: string,
    targetId: string,
    afterState: Record<string, unknown>,
  ): Promise<number> {
    this.validateTableName(table);
    const columns = Object.keys(afterState);
    this.validateColumnNames(columns);

    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    const values = columns.map((col) => afterState[col]);

    const result = await this.db.run(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [
      ...values,
      targetId,
    ]);
    return result?.changes ?? 1;
  }

  private async executeCreate(table: string, afterState: Record<string, unknown>): Promise<number> {
    this.validateTableName(table);
    const columns = Object.keys(afterState);
    this.validateColumnNames(columns);

    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map((col) => afterState[col]);

    await this.db.run(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      values,
    );
    return 1;
  }

  private async executeDelete(table: string, targetId: string): Promise<number> {
    this.validateTableName(table);

    const result = await this.db.run(`DELETE FROM ${table} WHERE id = ?`, [targetId]);
    return result?.changes ?? 1;
  }

  private async executeBatchUpdate(
    table: string,
    targetIds: string[],
    afterState: Record<string, unknown>,
  ): Promise<number> {
    this.validateTableName(table);
    this.validateColumnNames(Object.keys(afterState));

    let totalAffected = 0;
    for (const id of targetIds) {
      const affected = await this.executeUpdate(table, id, afterState);
      totalAffected += affected;
    }
    return totalAffected;
  }

  // ── Persistence Helpers ───────────────────────────────────────

  private async insertMutation(mutation: AgentMutation): Promise<void> {
    await this.db.run(
      `INSERT INTO agent_mutations (
        id, session_id, agent_type, mutation_type, target_table,
        target_id, target_ids, before_state, after_state, description,
        status, confidence, requires_confirmation, confirmed_at, executed_at,
        rejected_at, rejection_reason, error_message, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mutation.id,
        mutation.sessionId,
        mutation.agentType,
        mutation.mutationType,
        mutation.targetTable,
        mutation.targetId,
        mutation.targetIds,
        mutation.beforeState,
        mutation.afterState,
        mutation.description,
        mutation.status,
        mutation.confidence,
        mutation.requiresConfirmation ? 1 : 0,
        mutation.confirmedAt,
        mutation.executedAt,
        mutation.rejectedAt,
        mutation.rejectionReason,
        mutation.errorMessage,
        mutation.expiresAt,
        mutation.createdAt,
        mutation.updatedAt,
      ],
    );
  }

  private async incrementSessionMutationCount(): Promise<void> {
    try {
      await this.db.run(
        'UPDATE agent_sessions SET total_mutations = total_mutations + 1, last_activity_at = ? WHERE id = ?',
        [new Date().toISOString(), this.sessionId],
      );
    } catch (error) {
      // Non-fatal — session might not exist yet (created by orchestrator)
      console.warn('[MutationTools] Could not update session mutation count:', error);
    }
  }

  /**
   * Normalize a database row into a typed AgentMutation.
   * Handles the boolean conversion (SQLite stores as 0/1).
   */
  private rowToMutation(row: Record<string, unknown>): AgentMutation {
    return {
      id: String(row.id),
      sessionId: String(row.session_id ?? row.sessionId),
      agentType: String(row.agent_type ?? row.agentType) as AgentType,
      mutationType: String(row.mutation_type ?? row.mutationType),
      targetTable: String(row.target_table ?? row.targetTable),
      targetId: row.target_id ?? row.targetId ? String(row.target_id ?? row.targetId) : null,
      targetIds: row.target_ids ?? row.targetIds ? String(row.target_ids ?? row.targetIds) : null,
      beforeState: row.before_state ?? row.beforeState ? String(row.before_state ?? row.beforeState) : null,
      afterState: String(row.after_state ?? row.afterState ?? ''),
      description: String(row.description ?? ''),
      status: row.status as MutationStatus,
      confidence: row.confidence != null ? Number(row.confidence) : null,
      requiresConfirmation: Boolean(row.requires_confirmation ?? row.requiresConfirmation),
      confirmedAt: row.confirmed_at ?? row.confirmedAt ? String(row.confirmed_at ?? row.confirmedAt) : null,
      executedAt: row.executed_at ?? row.executedAt ? String(row.executed_at ?? row.executedAt) : null,
      rejectedAt: row.rejected_at ?? row.rejectedAt ? String(row.rejected_at ?? row.rejectedAt) : null,
      rejectionReason: row.rejection_reason ?? row.rejectionReason ? String(row.rejection_reason ?? row.rejectionReason) : null,
      errorMessage: row.error_message ?? row.errorMessage ? String(row.error_message ?? row.errorMessage) : null,
      expiresAt: row.expires_at ?? row.expiresAt ? String(row.expires_at ?? row.expiresAt) : null,
      createdAt: String(row.created_at ?? row.createdAt),
      updatedAt: String(row.updated_at ?? row.updatedAt),
    };
  }

  // ── SSE Broadcasting ──────────────────────────────────────────

  private broadcastMutationEvent(eventType: string, data: unknown): void {
    events.emit('update', {
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
    } as Record<string, unknown>);
  }
}
