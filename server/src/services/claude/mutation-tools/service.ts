/**
 * MutationTools — thin orchestrator class
 *
 * Agents NEVER write directly to the database. Instead they call
 * `proposeMutation()` which creates a tracked mutation record that
 * flows through the confirmation pipeline.
 */

import type { AgentType } from '../types.js';
import {
  type MutationStatus,
  type MutationProposal,
  type AgentMutation,
  type MutationExecutionResult,
} from '../mutation-tools-types.js';
import { MUTATION_EXPIRY_MS, SAFE_IDENTIFIER_RE } from '../mutation-tools-constants.js';
import { type MutationDb, validateTableName } from './mutation-validators.js';
import {
  executeUpdate,
  executeCreate,
  executeDelete,
  executeBatchUpdate,
} from './mutation-executors.js';
import {
  insertMutation,
  incrementSessionMutationCount,
  rowToMutation,
  broadcastMutationEvent,
} from './mutation-persistence.js';

export type {
  MutationStatus,
  MutationProposal,
  AgentMutation,
  MutationExecutionResult,
  MutationDb,
};
// Re-export AgentType so callers don't need two imports
export type { AgentType };

export class MutationTools {
  private db: MutationDb;
  private sessionId: string;

  constructor(db: MutationDb | Record<string, unknown>, sessionId: string) {
    this.db = db as MutationDb;
    this.sessionId = sessionId;
  }

  // ── Public API ────────────────────────────────────────────────

  async proposeMutation(proposal: MutationProposal): Promise<AgentMutation> {
    validateTableName(proposal.targetTable);

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
      await insertMutation(this.db, mutation);
      broadcastMutationEvent('mutation_proposed', mutation);
      await incrementSessionMutationCount(this.db, this.sessionId);
    } catch (error) {
      console.error('[MutationTools] Failed to propose mutation:', error);
      throw error;
    }

    return mutation;
  }

  async batchProposeMutations(proposals: MutationProposal[]): Promise<AgentMutation[]> {
    const mutations: AgentMutation[] = [];
    for (const proposal of proposals) {
      mutations.push(await this.proposeMutation(proposal));
    }
    return mutations;
  }

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

    await this.updateMutationStatus(mutationId, 'executing');

    try {
      const afterState = JSON.parse(mutation.afterState) as Record<string, unknown>;
      let affectedRows = 0;

      switch (mutation.mutationType) {
        case 'update':
          affectedRows = await executeUpdate(
            this.db,
            mutation.targetTable,
            mutation.targetId!,
            afterState,
          );
          break;
        case 'create':
          affectedRows = await executeCreate(this.db, mutation.targetTable, afterState);
          break;
        case 'delete':
          affectedRows = await executeDelete(this.db, mutation.targetTable, mutation.targetId!);
          break;
        case 'batch_update': {
          const targetIds: string[] = mutation.targetIds
            ? (JSON.parse(mutation.targetIds) as string[])
            : [];
          affectedRows = await executeBatchUpdate(
            this.db,
            mutation.targetTable,
            targetIds,
            afterState,
          );
          break;
        }
        default:
          throw new Error(`Unknown mutation type: ${mutation.mutationType}`);
      }

      await this.updateMutationStatus(mutationId, 'executed', {
        executedAt: new Date().toISOString(),
      });
      broadcastMutationEvent('mutation_executed', mutation);
      return { success: true, mutationId, affectedRows };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateMutationStatus(mutationId, 'failed', { errorMessage });
      broadcastMutationEvent('mutation_failed', { ...mutation, errorMessage });
      return { success: false, mutationId, error: errorMessage };
    }
  }

  async getMutation(mutationId: string): Promise<AgentMutation | null> {
    try {
      const rows = await this.db.all('SELECT * FROM agent_mutations WHERE id = ?', [mutationId]);
      return rows.length > 0 ? rowToMutation(rows[0]) : null;
    } catch (error) {
      console.error('[MutationTools] Failed to fetch mutation:', error);
      return null;
    }
  }

  async getSessionMutations(status?: MutationStatus): Promise<AgentMutation[]> {
    try {
      if (status) {
        const rows = await this.db.all(
          'SELECT * FROM agent_mutations WHERE session_id = ? AND status = ? ORDER BY created_at DESC',
          [this.sessionId, status],
        );
        return rows.map((r) => rowToMutation(r));
      }
      const rows = await this.db.all(
        'SELECT * FROM agent_mutations WHERE session_id = ? ORDER BY created_at DESC',
        [this.sessionId],
      );
      return rows.map((r) => rowToMutation(r));
    } catch (error) {
      console.error('[MutationTools] Failed to list session mutations:', error);
      return [];
    }
  }

  async getPendingMutations(sessionId?: string): Promise<AgentMutation[]> {
    const sid = sessionId ?? this.sessionId;
    try {
      const rows = await this.db.all(
        `SELECT * FROM agent_mutations WHERE session_id = ? AND status = 'pending_confirmation' ORDER BY created_at DESC`,
        [sid],
      );
      return rows.map((r) => rowToMutation(r));
    } catch (error) {
      console.error('[MutationTools] Failed to list pending mutations:', error);
      return [];
    }
  }

  async expireStale(): Promise<number> {
    const now = new Date().toISOString();
    try {
      const result = await this.db.run(
        `UPDATE agent_mutations SET status = 'expired', updated_at = ?
         WHERE status = 'pending_confirmation' AND expires_at IS NOT NULL AND expires_at < ?`,
        [now, now],
      );
      const count = result?.changes ?? 0;
      if (count > 0) console.log(`[MutationTools] Expired ${count} stale mutation(s)`);
      return count;
    } catch (error) {
      console.error('[MutationTools] Failed to expire stale mutations:', error);
      return 0;
    }
  }

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
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
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

  getSessionId(): string {
    return this.sessionId;
  }
}
