/**
 * Confirmation Flow Handlers — Propose, confirm, reject, and expire mutations.
 *
 * Orchestrates the mutation lifecycle:
 *  1. Agent proposes a mutation via MutationTools
 *  2. MutationAuth checks permissions and auto-execute eligibility
 *  3. If auto-execute: immediately execute + audit log
 *  4. If requires confirmation: broadcast SSE event + wait
 *  5. User confirms -> execute + audit log
 *  6. User rejects -> mark rejected + audit log
 *  7. TTL expires -> mark expired + audit log
 *
 * REVISION NOTES:
 *  - D02-CRIT-02: confirm() and reject() require userId (NOT optional).
 *    Both validate that the requesting user owns the session.
 *  - D01-DC-05: All mutation operations wrapped in try/catch with consistent error response.
 */

import { MutationTools, type AgentMutation, type MutationStatus } from '../mutation-tools.js';
import { events } from '../../../events.js';
import type { AgentType } from '../types.js';
import { logger } from '../../../lib/logger.js';
import { ConfirmationFlowManager } from './flow-manager.js';

export class ConfirmationFlowService extends ConfirmationFlowManager {
  // ── Propose & Broadcast ─────────────────────────────────────────────────

  /**
   * Propose a mutation with authorization check and optional auto-execution.
   *
   * This is the main entry point for agents wanting to make changes.
   * It combines auth checking, proposal creation, and potential auto-execution.
   */
  async proposeAndBroadcast(
    sessionId: string,
    agentType: AgentType,
    proposal: {
      mutationType: 'create' | 'update' | 'delete' | 'batch_update';
      targetTable: string;
      targetId?: string;
      targetIds?: string[];
      beforeState?: unknown;
      afterState: unknown;
      description: string;
      confidence?: number;
    },
  ): Promise<{
    mutation: AgentMutation;
    autoExecuted: boolean;
  }> {
    // Step 1: Authorization check
    const authDecision = this.authService.canPropose(
      agentType,
      proposal.targetTable,
      proposal.mutationType,
    );

    if (!authDecision.allowed) {
      throw new Error(`Authorization denied: ${authDecision.reason ?? 'Unknown reason'}`);
    }

    // Step 2: Check auto-execute eligibility
    const canAutoExec =
      proposal.confidence != null &&
      this.authService.canAutoExecute(
        agentType,
        proposal.mutationType,
        proposal.targetTable,
        proposal.confidence,
      );

    // Step 3: Create mutation via MutationTools
    const tools = this.createMutationTools(sessionId);
    const mutation = await tools.proposeMutation({
      agentType,
      mutationType: proposal.mutationType,
      targetTable: proposal.targetTable,
      targetId: proposal.targetId,
      targetIds: proposal.targetIds,
      beforeState: proposal.beforeState,
      afterState: proposal.afterState,
      description: proposal.description,
      confidence: proposal.confidence,
      requiresConfirmation: !canAutoExec,
    });

    // Step 4: Auto-execute if eligible
    // Track whether execution actually succeeded — canAutoExec only means "eligible",
    // not "did execute". Using canAutoExec for the SSE event type would be wrong if
    // execution fails (ISSUE-05-006 fix).
    let actuallyAutoExecuted = false;
    if (canAutoExec) {
      const execResult = await tools.executeMutation(mutation.id);
      if (execResult.success) {
        mutation.status = 'executed' as MutationStatus;
        mutation.executedAt = new Date().toISOString();
        actuallyAutoExecuted = true;
      } else {
        logger.warn(
          { err: execResult.error },
          `[ConfirmationFlow] Auto-execute failed for ${mutation.id}`,
        );
        // Fall back to requiring confirmation — mutation stays in pending_confirmation
        mutation.status = 'pending_confirmation' as MutationStatus;
      }
    }

    // Step 5: Broadcast SSE event via global events emitter.
    // Use actuallyAutoExecuted (not canAutoExec) so a failed auto-exec correctly
    // emits 'mutation_pending' instead of the misleading 'mutation_auto_executed'.
    events.emit('update', {
      type: actuallyAutoExecuted ? 'mutation_auto_executed' : 'mutation_pending',
      data: {
        mutationId: mutation.id,
        agentType,
        description: proposal.description,
        targetTable: proposal.targetTable,
        requiresConfirmation: !actuallyAutoExecuted,
        confidence: proposal.confidence,
      },
      timestamp: new Date().toISOString(),
    });

    return { mutation, autoExecuted: actuallyAutoExecuted };
  }

  // ── Confirm ─────────────────────────────────────────────────────────────

  /**
   * Confirm a pending mutation. Executes the mutation and logs the audit trail.
   *
   * REVISION (D02-CRIT-02): userId is REQUIRED (not optional).
   * The confirm endpoint validates that the requesting user owns the session.
   */
  async confirm(mutationId: string, userId: string, _reason?: string): Promise<AgentMutation> {
    if (!userId) {
      throw new Error('User identity required to confirm mutations');
    }

    const tools = new MutationTools(this.db, '');
    const mutation = await tools.getMutation(mutationId);

    if (!mutation) {
      throw new Error(`Mutation not found: ${mutationId}`);
    }

    if (mutation.status !== 'pending_confirmation') {
      throw new Error(
        `Cannot confirm mutation in status '${mutation.status}'. Expected 'pending_confirmation'.`,
      );
    }

    // REVISION (D02-CRIT-02): Validate that the confirming user owns the session
    await this.validateSessionOwnership(mutation.sessionId, userId);

    // TOCTOU fix (ISSUE-05-003): Use a single atomic conditional UPDATE instead of
    // a separate expiry check + separate status update. Two concurrent confirm() calls
    // can both pass the status check above, but only one can win the atomic UPDATE below.
    // The WHERE clause simultaneously guards both status AND expiry atomically at the DB level.
    const now = new Date().toISOString();
    const atomicResult = await this.db.run(
      `UPDATE agent_mutations
       SET status = 'confirmed', confirmed_at = ?, updated_at = ?
       WHERE id = ? AND status = 'pending_confirmation'
         AND (expires_at IS NULL OR expires_at > ?)`,
      [now, now, mutationId, now],
    );
    if ((atomicResult?.changes ?? 0) === 0) {
      // Another concurrent request won the race, or the mutation expired
      throw new Error('Mutation already confirmed, rejected, or expired');
    }

    // Execute the mutation
    const result = await tools.executeMutation(mutationId);

    if (!result.success) {
      throw new Error(`Mutation execution failed: ${result.error}`);
    }

    // Update session counters
    await this.db.run(
      'UPDATE agent_sessions SET confirmed_mutations = confirmed_mutations + 1, last_activity_at = ? WHERE id = ?',
      [now, mutation.sessionId],
    );

    // Broadcast confirmation event
    events.emit('update', {
      type: 'mutation_confirmed',
      data: { mutationId, agentType: mutation.agentType, userId },
      timestamp: now,
    });

    return { ...mutation, status: 'executed' as MutationStatus, confirmedAt: now, executedAt: now };
  }

  // ── Reject ──────────────────────────────────────────────────────────────

  /**
   * Reject a pending mutation.
   *
   * REVISION (D02-CRIT-02): userId is REQUIRED. Must validate session ownership.
   */
  async reject(mutationId: string, userId: string, reason?: string): Promise<AgentMutation> {
    if (!userId) {
      throw new Error('User identity required to reject mutations');
    }

    const tools = new MutationTools(this.db, '');
    const mutation = await tools.getMutation(mutationId);

    if (!mutation) {
      throw new Error(`Mutation not found: ${mutationId}`);
    }

    if (mutation.status !== 'pending_confirmation') {
      throw new Error(
        `Cannot reject mutation in status '${mutation.status}'. Expected 'pending_confirmation'.`,
      );
    }

    // REVISION (D02-CRIT-02): Validate that the rejecting user owns the session
    await this.validateSessionOwnership(mutation.sessionId, userId);

    const now = new Date().toISOString();
    await this.db.run(
      'UPDATE agent_mutations SET status = ?, rejected_at = ?, rejection_reason = ?, updated_at = ? WHERE id = ?',
      ['rejected', now, reason ?? null, now, mutationId],
    );

    // Update session counters
    await this.db.run(
      'UPDATE agent_sessions SET rejected_mutations = rejected_mutations + 1, last_activity_at = ? WHERE id = ?',
      [now, mutation.sessionId],
    );

    // Broadcast rejection event
    events.emit('update', {
      type: 'mutation_rejected',
      data: { mutationId, agentType: mutation.agentType, userId, reason },
      timestamp: now,
    });

    return {
      ...mutation,
      status: 'rejected' as MutationStatus,
      rejectedAt: now,
      rejectionReason: reason ?? null,
    };
  }

  // ── Expiration ──────────────────────────────────────────────────────────

  /**
   * Expire stale mutations that have passed their TTL.
   * Should be called periodically (e.g., every 5 minutes via setInterval at server startup).
   */
  async expireStale(): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.db.run(
      `UPDATE agent_mutations
       SET status = 'expired', updated_at = ?
       WHERE status = 'pending_confirmation'
         AND expires_at IS NOT NULL
         AND expires_at < ?`,
      [now, now],
    );
    const count = result?.changes ?? 0;

    if (count > 0) {
      logger.info(`[ConfirmationFlow] Expired ${count} stale mutations`);

      // Broadcast expiration event
      events.emit('update', {
        type: 'mutations_expired',
        data: { count },
        timestamp: now,
      });
    }

    return count;
  }
}
