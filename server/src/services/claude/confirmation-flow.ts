/**
 * Confirmation Flow Service — Full lifecycle management for agent-proposed mutations.
 *
 * Orchestrates the mutation lifecycle:
 *  1. Agent proposes a mutation via MutationTools
 *  2. MutationAuth checks permissions and auto-execute eligibility
 *  3. If auto-execute: immediately execute + audit log
 *  4. If requires confirmation: broadcast SSE event + wait
 *  5. User confirms → execute + audit log
 *  6. User rejects → mark rejected + audit log
 *  7. TTL expires → mark expired + audit log
 *
 * REVISION NOTES:
 *  - D02-CRIT-02: confirm() and reject() require userId (NOT optional).
 *    Both validate that the requesting user owns the session.
 *  - D01-DC-05: All mutation operations wrapped in try/catch with consistent error response.
 */

import { MutationTools, type AgentMutation, type MutationStatus } from './mutation-tools.js';
import { MutationAuthService } from './mutation-auth.js';
import { events } from '../../events.js';
import type { AgentType } from './types.js';

// ── Public Interfaces ───────────────────────────────────────────────────────

/** Session creation options. */
export interface CreateSessionOptions {
  userId?: string;
  context?: Record<string, unknown>;
}

/** Agent session record. */
export interface AgentSession {
  id: string;
  userId?: string | null;
  startedAt: string;
  lastActivityAt: string;
  status: 'active' | 'completed' | 'expired';
  context?: string | null;
  totalMutations: number;
  confirmedMutations: number;
  rejectedMutations: number;
  queryCount: number;
  agentTypesUsed?: string | null;
  createdAt: string;
}

// ── Service ─────────────────────────────────────────────────────────────────

interface ConfirmationDb {
  all(sql: string, params?: unknown[]): Promise<Array<Record<string, unknown>>>;
  run(sql: string, params?: unknown[]): Promise<{ changes?: number } | undefined>;
  get(sql: string, params?: unknown[]): Promise<Record<string, unknown> | undefined>;
}

export class ConfirmationFlowService {
  private db: ConfirmationDb;
  private authService: MutationAuthService;
  private readonly DEFAULT_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

  constructor(db: ConfirmationDb | Record<string, unknown>) {
    this.db = db as ConfirmationDb;
    this.authService = new MutationAuthService();
  }

  // ── Session Management ──────────────────────────────────────────────────

  /**
   * Create or retrieve an active session for a user.
   * Reuses an existing active session if one exists for the given userId.
   */
  async getOrCreateSession(options?: CreateSessionOptions): Promise<AgentSession> {
    // Try to find an active session for this user
    if (options?.userId) {
      try {
        const existing = await this.db.all(
          `SELECT * FROM agent_sessions WHERE user_id = ? AND status = 'active' ORDER BY last_activity_at DESC LIMIT 1`,
          [options.userId],
        );
        if (existing.length > 0) {
          // Update last activity timestamp
          await this.db.run('UPDATE agent_sessions SET last_activity_at = ? WHERE id = ?', [
            new Date().toISOString(),
            existing[0].id,
          ]);
          return existing[0] as unknown as AgentSession;
        }
      } catch (error) {
        console.error('[ConfirmationFlow] Error finding existing session:', error);
        // Fall through to create a new session
      }
    }

    // Create new session
    const session: AgentSession = {
      id: crypto.randomUUID(),
      userId: options?.userId ?? null,
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      status: 'active',
      context: options?.context ? JSON.stringify(options.context) : null,
      totalMutations: 0,
      confirmedMutations: 0,
      rejectedMutations: 0,
      queryCount: 0,
      agentTypesUsed: null,
      createdAt: new Date().toISOString(),
    };

    await this.db.run(
      `INSERT INTO agent_sessions (
        id, user_id, started_at, last_activity_at, status,
        context, total_mutations, confirmed_mutations, rejected_mutations,
        query_count, agent_types_used, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.userId,
        session.startedAt,
        session.lastActivityAt,
        session.status,
        session.context,
        session.totalMutations,
        session.confirmedMutations,
        session.rejectedMutations,
        session.queryCount,
        session.agentTypesUsed,
        session.createdAt,
      ],
    );

    return session;
  }

  /**
   * Create a MutationTools instance bound to a session.
   */
  createMutationTools(sessionId: string): MutationTools {
    return new MutationTools(this.db, sessionId);
  }

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
    if (canAutoExec) {
      const execResult = await tools.executeMutation(mutation.id);
      if (execResult.success) {
        mutation.status = 'executed' as MutationStatus;
        mutation.executedAt = new Date().toISOString();
      } else {
        console.warn(
          `[ConfirmationFlow] Auto-execute failed for ${mutation.id}:`,
          execResult.error,
        );
        // Fall back to requiring confirmation
        mutation.status = 'pending_confirmation' as MutationStatus;
      }
    }

    // Step 5: Broadcast SSE event via global events emitter
    events.emit('update', {
      type: canAutoExec ? 'mutation_auto_executed' : 'mutation_pending',
      data: {
        mutationId: mutation.id,
        agentType,
        description: proposal.description,
        targetTable: proposal.targetTable,
        requiresConfirmation: !canAutoExec,
        confidence: proposal.confidence,
      },
      timestamp: new Date().toISOString(),
    } as Record<string, unknown>);

    return { mutation, autoExecuted: canAutoExec };
  }

  // ── Confirm ─────────────────────────────────────────────────────────────

  /**
   * Confirm a pending mutation. Executes the mutation and logs the audit trail.
   *
   * REVISION (D02-CRIT-02): userId is REQUIRED (not optional).
   * The confirm endpoint validates that the requesting user owns the session.
   */
  async confirm(mutationId: string, userId: string, reason?: string): Promise<AgentMutation> {
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

    // Check expiration
    if (mutation.expiresAt && new Date(mutation.expiresAt) < new Date()) {
      await this.db.run('UPDATE agent_mutations SET status = ?, updated_at = ? WHERE id = ?', [
        'expired',
        new Date().toISOString(),
        mutationId,
      ]);
      throw new Error('Mutation has expired');
    }

    // Mark as confirmed
    const now = new Date().toISOString();
    await this.db.run(
      'UPDATE agent_mutations SET status = ?, confirmed_at = ?, updated_at = ? WHERE id = ?',
      ['confirmed', now, now, mutationId],
    );

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
    } as Record<string, unknown>);

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
    } as Record<string, unknown>);

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
      console.log(`[ConfirmationFlow] Expired ${count} stale mutations`);

      // Broadcast expiration event
      events.emit('update', {
        type: 'mutations_expired',
        data: { count },
        timestamp: now,
      } as Record<string, unknown>);
    }

    return count;
  }

  // ── Query Methods ───────────────────────────────────────────────────────

  /**
   * Get pending mutations for a session.
   */
  async getPendingMutations(sessionId: string): Promise<AgentMutation[]> {
    return (await this.db.all(
      `SELECT * FROM agent_mutations
       WHERE session_id = ? AND status = 'pending_confirmation'
       ORDER BY created_at DESC`,
      [sessionId],
    )) as unknown as AgentMutation[];
  }

  /**
   * Get session history with pagination.
   */
  async getSessionHistory(options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ sessions: AgentSession[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    let whereClause = '';
    const params: unknown[] = [];

    if (options?.userId) {
      whereClause = 'WHERE user_id = ?';
      params.push(options.userId);
    }

    const [sessions, countResult] = await Promise.all([
      this.db.all(
        `SELECT * FROM agent_sessions ${whereClause} ORDER BY last_activity_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      this.db.all(`SELECT COUNT(*) as count FROM agent_sessions ${whereClause}`, params),
    ]);

    return {
      sessions: sessions as unknown as AgentSession[],
      total: (countResult[0]?.count as number) ?? 0,
    };
  }

  /**
   * Get a single session by ID.
   */
  async getSession(sessionId: string): Promise<AgentSession | null> {
    const rows = await this.db.all('SELECT * FROM agent_sessions WHERE id = ?', [sessionId]);
    return rows.length > 0 ? (rows[0] as unknown as AgentSession) : null;
  }

  // ── Session Activity Tracking ───────────────────────────────────────────

  /**
   * Increment query count for a session.
   */
  async incrementQueryCount(sessionId: string): Promise<void> {
    await this.db.run(
      'UPDATE agent_sessions SET query_count = query_count + 1, last_activity_at = ? WHERE id = ?',
      [new Date().toISOString(), sessionId],
    );
  }

  /**
   * Record that an agent type was used in a session.
   */
  async recordAgentUsage(sessionId: string, agentType: AgentType): Promise<void> {
    const session = await this.db.all('SELECT agent_types_used FROM agent_sessions WHERE id = ?', [
      sessionId,
    ]);

    if (session.length === 0) return;

    const existing: string[] = session[0].agent_types_used
      ? JSON.parse(session[0].agent_types_used as string)
      : [];

    if (!existing.includes(agentType)) {
      existing.push(agentType);
      await this.db.run('UPDATE agent_sessions SET agent_types_used = ? WHERE id = ?', [
        JSON.stringify(existing),
        sessionId,
      ]);
    }
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  /**
   * REVISION (D02-CRIT-02): Validate that a user owns the session associated
   * with a mutation. Throws an error if the session belongs to a different user.
   */
  private async validateSessionOwnership(sessionId: string, userId: string): Promise<void> {
    const sessions = await this.db.all('SELECT user_id FROM agent_sessions WHERE id = ?', [
      sessionId,
    ]);

    if (sessions.length > 0 && sessions[0].user_id && sessions[0].user_id !== userId) {
      throw new Error('Cannot perform action: session belongs to a different user');
    }
  }
}
