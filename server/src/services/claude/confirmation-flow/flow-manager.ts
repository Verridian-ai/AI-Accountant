/**
 * Confirmation Flow — Session management and mutation query methods.
 *
 * Handles session creation/retrieval, query count tracking,
 * agent usage recording, and session history queries.
 */

import { MutationTools } from '../mutation-tools.js';
import { MutationAuthService } from '../mutation-auth.js';
import { logger } from '../../../lib/logger.js';
import type { AgentType } from '../types.js';
import type { CreateSessionOptions, AgentSession } from './types.js';

export class ConfirmationFlowManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected db: any;
  protected authService: MutationAuthService;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(db: any) {
    this.db = db;
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
          return existing[0] as AgentSession;
        }
      } catch (error) {
        logger.error({ err: error }, '[ConfirmationFlow] Error finding existing session:');
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

  // ── Query Methods ───────────────────────────────────────────────────────

  /**
   * Get pending mutations for a session.
   */
  async getPendingMutations(sessionId: string): Promise<unknown[]> {
    return (await this.db.all(
      `SELECT * FROM agent_mutations
       WHERE session_id = ? AND status = 'pending_confirmation'
       ORDER BY created_at DESC`,
      [sessionId],
    )) as unknown[];
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
      sessions: sessions as AgentSession[],
      total: countResult[0]?.count ?? 0,
    };
  }

  /**
   * Get a single session by ID.
   */
  async getSession(sessionId: string): Promise<AgentSession | null> {
    const rows = await this.db.all('SELECT * FROM agent_sessions WHERE id = ?', [sessionId]);
    return rows.length > 0 ? (rows[0] as AgentSession) : null;
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
      ? JSON.parse(session[0].agent_types_used)
      : [];

    if (!existing.includes(agentType)) {
      existing.push(agentType);
      await this.db.run('UPDATE agent_sessions SET agent_types_used = ? WHERE id = ?', [
        JSON.stringify(existing),
        sessionId,
      ]);
    }
  }

  // ── Protected Helpers ─────────────────────────────────────────────────

  /**
   * REVISION (D02-CRIT-02): Validate that a user owns the session associated
   * with a mutation. Throws an error if the session belongs to a different user.
   *
   * ISSUE-05-002 fix: The original condition `sessions[0].user_id && ...` was falsy
   * when user_id is NULL, silently permitting ANY authenticated user to confirm or
   * reject mutations from anonymous sessions. Fixed to explicitly reject NULL-owner sessions.
   */
  protected async validateSessionOwnership(sessionId: string, userId: string): Promise<void> {
    const sessions = await this.db.all('SELECT user_id FROM agent_sessions WHERE id = ?', [
      sessionId,
    ]);

    if (sessions.length === 0) {
      throw new Error('Session not found');
    }

    const sessionUserId: string | null = sessions[0].user_id ?? null;

    // Anonymous sessions (NULL user_id) have no owner to verify against —
    // disallow mutations to prevent privilege escalation via unowned sessions.
    if (sessionUserId === null) {
      throw new Error('Cannot confirm mutations from an unowned session');
    }

    if (sessionUserId !== userId) {
      throw new Error('Cannot perform action: session belongs to a different user');
    }
  }
}
