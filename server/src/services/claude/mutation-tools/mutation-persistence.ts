/**
 * MutationTools — DB persistence helpers and SSE broadcasting
 */

import { events } from '../../../events.js';
import type { AgentMutation, MutationStatus } from '../mutation-tools-types.js';
import type { AgentType } from '../types.js';
import type { MutationDb } from './mutation-validators.js';

export async function insertMutation(db: MutationDb, mutation: AgentMutation): Promise<void> {
  await db.run(
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

export async function incrementSessionMutationCount(
  db: MutationDb,
  sessionId: string,
): Promise<void> {
  try {
    await db.run(
      'UPDATE agent_sessions SET total_mutations = total_mutations + 1, last_activity_at = ? WHERE id = ?',
      [new Date().toISOString(), sessionId],
    );
  } catch (error) {
    console.warn('[MutationTools] Could not update session mutation count:', error);
  }
}

export function rowToMutation(row: Record<string, unknown>): AgentMutation {
  const s = (a: unknown, b: unknown): string | null =>
    a != null || b != null ? String(a ?? b) : null;
  return {
    id: String(row.id),
    sessionId: String(row.session_id ?? row.sessionId),
    agentType: String(row.agent_type ?? row.agentType) as AgentType,
    mutationType: String(row.mutation_type ?? row.mutationType),
    targetTable: String(row.target_table ?? row.targetTable),
    targetId: s(row.target_id, row.targetId),
    targetIds: s(row.target_ids, row.targetIds),
    beforeState: s(row.before_state, row.beforeState),
    afterState: String(row.after_state ?? row.afterState ?? ''),
    description: String(row.description ?? ''),
    status: row.status as MutationStatus,
    confidence: row.confidence != null ? Number(row.confidence) : null,
    requiresConfirmation: Boolean(row.requires_confirmation ?? row.requiresConfirmation),
    confirmedAt: s(row.confirmed_at, row.confirmedAt),
    executedAt: s(row.executed_at, row.executedAt),
    rejectedAt: s(row.rejected_at, row.rejectedAt),
    rejectionReason: s(row.rejection_reason, row.rejectionReason),
    errorMessage: s(row.error_message, row.errorMessage),
    expiresAt: s(row.expires_at, row.expiresAt),
    createdAt: String(row.created_at ?? row.createdAt),
    updatedAt: String(row.updated_at ?? row.updatedAt),
  };
}

export function broadcastMutationEvent(eventType: string, data: unknown): void {
  events.emit('update', {
    type: eventType,
    data,
    timestamp: new Date().toISOString(),
  } as Record<string, unknown>);
}
