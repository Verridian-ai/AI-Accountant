# Agent 2: Mutation Tools Service

## Role
Create the core `MutationTools` class that provides standardized methods for agents to propose, execute, and batch database mutations through the confirmation pipeline.

## Priority: SUB-WAVE 1 (No dependencies)

## Files to CREATE

### 1. `server/src/services/claude/mutation-tools.ts`
**Purpose**: Central service for agent-proposed database mutations

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { AgentType } from './types.js';

/**
 * Represents a proposed database mutation from an agent.
 */
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

/**
 * A mutation record as stored in the database.
 */
export interface AgentMutation {
  id: string;
  sessionId: string;
  agentType: AgentType;
  mutationType: string;
  targetTable: string;
  targetId?: string | null;
  targetIds?: string | null;
  beforeState?: string | null;
  afterState: string;
  description: string;
  status: MutationStatus;
  confidence?: number | null;
  requiresConfirmation: boolean;
  confirmedAt?: string | null;
  executedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  errorMessage?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MutationStatus =
  | 'proposed'
  | 'pending_confirmation'
  | 'confirmed'
  | 'executing'
  | 'executed'
  | 'rejected'
  | 'expired'
  | 'failed';

/**
 * Result of executing a mutation.
 */
export interface MutationExecutionResult {
  success: boolean;
  mutationId: string;
  error?: string;
  affectedRows?: number;
}

/**
 * MutationTools provides a standardized interface for Claude agents
 * to propose database mutations that flow through the confirmation pipeline.
 *
 * Design principles:
 * - Agents never write directly to the DB — they propose mutations
 * - High-confidence categorization mutations can auto-execute
 * - All mutations are logged in the audit trail
 * - Users can confirm or reject pending mutations
 */
export class MutationTools {
  private db: any;
  private sessionId: string;
  private eventEmitter: any;

  constructor(db: any, sessionId: string, eventEmitter?: any) {
    this.db = db;
    this.sessionId = sessionId;
    this.eventEmitter = eventEmitter;
  }

  /**
   * Propose a single mutation. Returns the mutation record.
   * If the mutation doesn't require confirmation (auto-execute), it will
   * be executed immediately and returned with status 'executed'.
   */
  async proposeMutation(proposal: MutationProposal): Promise<AgentMutation> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const requiresConfirmation = proposal.requiresConfirmation ?? true;

    // Default expiration: 15 minutes for mutations requiring confirmation
    const expiresAt = requiresConfirmation
      ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
      : null;

    const mutation: AgentMutation = {
      id,
      sessionId: this.sessionId,
      agentType: proposal.agentType,
      mutationType: proposal.mutationType,
      targetTable: proposal.targetTable,
      targetId: proposal.targetId ?? null,
      targetIds: proposal.targetIds ? JSON.stringify(proposal.targetIds) : null,
      beforeState: proposal.beforeState ? JSON.stringify(proposal.beforeState) : null,
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

    // Insert into database
    await this.insertMutation(mutation);

    // Broadcast SSE event
    this.broadcastMutationEvent('mutation_proposed', mutation);

    // Update session mutation count
    await this.incrementSessionMutationCount();

    return mutation;
  }

  /**
   * Propose multiple mutations in a batch (e.g., bulk categorization).
   * Each becomes an individual mutation record for granular confirm/reject.
   */
  async batchProposeMutations(
    proposals: MutationProposal[]
  ): Promise<AgentMutation[]> {
    const mutations: AgentMutation[] = [];

    for (const proposal of proposals) {
      const mutation = await this.proposeMutation(proposal);
      mutations.push(mutation);
    }

    return mutations;
  }

  /**
   * Execute a confirmed mutation against the database.
   * This is called by the ConfirmationFlowService after user confirmation.
   */
  async executeMutation(mutationId: string): Promise<MutationExecutionResult> {
    // Fetch the mutation record
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
            afterState
          );
          break;
        case 'create':
          affectedRows = await this.executeCreate(
            mutation.targetTable,
            afterState
          );
          break;
        case 'delete':
          affectedRows = await this.executeDelete(
            mutation.targetTable,
            mutation.targetId!
          );
          break;
        case 'batch_update':
          const targetIds = mutation.targetIds
            ? JSON.parse(mutation.targetIds)
            : [];
          affectedRows = await this.executeBatchUpdate(
            mutation.targetTable,
            targetIds,
            afterState
          );
          break;
        default:
          throw new Error(`Unknown mutation type: ${mutation.mutationType}`);
      }

      // Mark as executed
      await this.updateMutationStatus(mutationId, 'executed', {
        executedAt: new Date().toISOString(),
      });

      // Broadcast success
      this.broadcastMutationEvent('mutation_executed', mutation);

      return { success: true, mutationId, affectedRows };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Mark as failed
      await this.updateMutationStatus(mutationId, 'failed', {
        errorMessage,
      });

      // Broadcast failure
      this.broadcastMutationEvent('mutation_failed', {
        ...mutation,
        errorMessage,
      });

      return { success: false, mutationId, error: errorMessage };
    }
  }

  /**
   * Fetch a mutation record by ID.
   */
  async getMutation(mutationId: string): Promise<AgentMutation | null> {
    try {
      const rows = await this.db.all(
        'SELECT * FROM agent_mutations WHERE id = ?',
        [mutationId]
      );
      return rows.length > 0 ? (rows[0] as AgentMutation) : null;
    } catch (error) {
      console.error('[MutationTools] Failed to fetch mutation:', error);
      return null;
    }
  }

  /**
   * List mutations for the current session with optional status filter.
   */
  async getSessionMutations(
    status?: MutationStatus
  ): Promise<AgentMutation[]> {
    try {
      if (status) {
        return (await this.db.all(
          'SELECT * FROM agent_mutations WHERE session_id = ? AND status = ? ORDER BY created_at DESC',
          [this.sessionId, status]
        )) as AgentMutation[];
      }
      return (await this.db.all(
        'SELECT * FROM agent_mutations WHERE session_id = ? ORDER BY created_at DESC',
        [this.sessionId]
      )) as AgentMutation[];
    } catch (error) {
      console.error('[MutationTools] Failed to list mutations:', error);
      return [];
    }
  }

  // ── Private helpers ────────────────────────────────────

  private async insertMutation(mutation: AgentMutation): Promise<void> {
    await this.db.run(
      `INSERT INTO agent_mutations (
        id, session_id, agent_type, mutation_type, target_table,
        target_id, target_ids, before_state, after_state, description,
        status, confidence, requires_confirmation, confirmed_at, executed_at,
        rejected_at, rejection_reason, error_message, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mutation.id, mutation.sessionId, mutation.agentType,
        mutation.mutationType, mutation.targetTable, mutation.targetId,
        mutation.targetIds, mutation.beforeState, mutation.afterState,
        mutation.description, mutation.status, mutation.confidence,
        mutation.requiresConfirmation ? 1 : 0, mutation.confirmedAt,
        mutation.executedAt, mutation.rejectedAt, mutation.rejectionReason,
        mutation.errorMessage, mutation.expiresAt, mutation.createdAt,
        mutation.updatedAt,
      ]
    );
  }

  private async updateMutationStatus(
    mutationId: string,
    status: MutationStatus,
    extra?: Record<string, string | null>
  ): Promise<void> {
    const now = new Date().toISOString();
    let sql = 'UPDATE agent_mutations SET status = ?, updated_at = ?';
    const params: (string | null)[] = [status, now];

    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        // Convert camelCase to snake_case
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        sql += `, ${snakeKey} = ?`;
        params.push(value);
      }
    }

    sql += ' WHERE id = ?';
    params.push(mutationId);

    await this.db.run(sql, params);
  }

  private async incrementSessionMutationCount(): Promise<void> {
    await this.db.run(
      'UPDATE agent_sessions SET total_mutations = total_mutations + 1, last_activity_at = ? WHERE id = ?',
      [new Date().toISOString(), this.sessionId]
    );
  }

  // ── REVISION NOTE (D01-CRIT-01): SQL Injection Prevention ──────
  // Table and column names come from agent output which could be influenced
  // by prompt injection. WHITELIST validation is MANDATORY before any SQL.

  /**
   * REVISION (D01-CRIT-01): Whitelist of tables that agents are allowed to mutate.
   * Any table NOT in this list will be rejected before SQL is built.
   */
  private static readonly MUTABLE_TABLES = new Set([
    'transactions', 'accounts', 'merchant_memory', 'pending_categorization',
    'bas_calculations', 'bas_periods', 'transfer_links', 'reconciliation_alerts',
    'deductions', 'tax_strategies', 'report_snapshots', 'kpi_metrics',
    'budgets', 'budget_lines', 'budget_vs_actual', 'forecast_scenarios',
    'forecast_periods', 'ocr_documents', 'ocr_line_items', 'payment_matches',
    'payment_match_rules', 'inventory_items', 'inventory_stock',
    'inventory_movements', 'bank_recon_matches', 'bank_recon_rules',
    'bank_recon_sessions', 'fixed_assets', 'asset_depreciation',
    'asset_disposals', 'inter_entity_transactions', 'consolidation_snapshots',
    'consolidation_snapshot_lines', 'wage_payments', 'statements',
  ]);

  /**
   * REVISION (D01-CRIT-01): Validate that a table name is in the whitelist
   * and matches the safe identifier pattern (lowercase alphanumeric + underscore).
   */
  private validateTableName(table: string): void {
    if (!/^[a-z_][a-z0-9_]*$/.test(table)) {
      throw new Error(`Invalid table name: '${table}' — must be lowercase alphanumeric with underscores`);
    }
    if (!MutationTools.MUTABLE_TABLES.has(table)) {
      throw new Error(`Table '${table}' is not in the mutation whitelist — mutation denied`);
    }
  }

  /**
   * REVISION (D01-CRIT-01): Validate that column names match the safe identifier pattern.
   * Rejects any column name that could be used for SQL injection.
   */
  private validateColumnNames(columns: string[]): void {
    for (const col of columns) {
      if (!/^[a-z_][a-z0-9_]*$/.test(col)) {
        throw new Error(`Invalid column name: '${col}' — must be lowercase alphanumeric with underscores`);
      }
    }
  }

  private async executeUpdate(
    table: string,
    targetId: string,
    afterState: Record<string, unknown>
  ): Promise<number> {
    // REVISION (D01-CRIT-01): Validate table and column names before building SQL
    this.validateTableName(table);
    const columns = Object.keys(afterState);
    this.validateColumnNames(columns);

    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    const values = columns.map((col) => afterState[col]);

    const result = await this.db.run(
      `UPDATE ${table} SET ${setClause} WHERE id = ?`,
      [...values, targetId]
    );
    return result?.changes ?? 1;
  }

  private async executeCreate(
    table: string,
    afterState: Record<string, unknown>
  ): Promise<number> {
    // REVISION (D01-CRIT-01): Validate table and column names before building SQL
    this.validateTableName(table);
    const columns = Object.keys(afterState);
    this.validateColumnNames(columns);

    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map((col) => afterState[col]);

    await this.db.run(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );
    return 1;
  }

  private async executeDelete(table: string, targetId: string): Promise<number> {
    // REVISION (D01-CRIT-01): Validate table name before building SQL
    this.validateTableName(table);

    const result = await this.db.run(
      `DELETE FROM ${table} WHERE id = ?`,
      [targetId]
    );
    return result?.changes ?? 1;
  }

  private async executeBatchUpdate(
    table: string,
    targetIds: string[],
    afterState: Record<string, unknown>
  ): Promise<number> {
    // REVISION (D01-CRIT-01): Validate once for the batch (same table/columns)
    this.validateTableName(table);
    this.validateColumnNames(Object.keys(afterState));

    let totalAffected = 0;
    for (const id of targetIds) {
      const affected = await this.executeUpdate(table, id, afterState);
      totalAffected += affected;
    }
    return totalAffected;
  }

  private broadcastMutationEvent(eventType: string, data: unknown): void {
    if (this.eventEmitter) {
      this.eventEmitter.emit('update', {
        type: eventType,
        data,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

#### Key Design Decisions:
- [ ] Agents call `proposeMutation()` — NEVER write to the DB directly
- [ ] Mutations flow through states: proposed → pending_confirmation → confirmed → executing → executed
- [ ] Auto-execute path: proposed → executing → executed (when `requiresConfirmation = false`)
- [ ] Rejection path: pending_confirmation → rejected
- [ ] Expiration: pending_confirmation → expired (after 15 min TTL)
- [ ] All DB operations are try/catch wrapped with error state capture
- [ ] Uses existing `db.run()` / `db.all()` pattern from wrapPgDb()
- [ ] SSE broadcasting via existing EventEmitter pattern from `events.ts`

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `MutationTools` class is exported
- [ ] `MutationProposal`, `AgentMutation`, `MutationStatus`, `MutationExecutionResult` interfaces exported
- [ ] `proposeMutation()` creates a mutation record and returns it
- [ ] `batchProposeMutations()` creates multiple records
- [ ] `executeMutation()` applies changes and updates status
- [ ] `getMutation()` and `getSessionMutations()` query correctly
- [ ] REVISION (D01-CRIT-01): `MUTABLE_TABLES` whitelist exists and is checked in all execute methods
- [ ] REVISION (D01-CRIT-01): `validateTableName()` rejects tables not in whitelist
- [ ] REVISION (D01-CRIT-01): `validateColumnNames()` rejects columns with invalid characters
- [ ] REVISION (D01-CRIT-01): `executeUpdate('users; DROP TABLE--', ...)` throws an error (not executes)
- [ ] No modifications to any existing files
- [ ] Create marker file: `.agent-done-W02-02` (REVISION: zero-padded per D04/D05)

## Dependencies
- **Requires**: Nothing — Sub-Wave 1 task
- **Blocks**: Agents 4, 8 (ConfirmationFlow and Agent Integration need MutationTools)
