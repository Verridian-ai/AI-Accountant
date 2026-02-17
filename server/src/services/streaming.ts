/**
 * Streaming Service (Wave 21)
 *
 * Manages SSE streaming sessions for VercelAgent responses.
 * Tracks sessions in-memory with best-effort DB persistence to
 * the `agent_stream_sessions` table.
 */

import crypto from 'crypto';
import type { AgentType, StreamSession } from './claude/types.js';
import type { VercelAgent } from './claude/vercel-agent.js';
import { db } from '../schema.js';

// ============================================================================
// INTERNAL SESSION STATE
// ============================================================================

interface InternalSession extends StreamSession {
  abortController: AbortController;
  userId: string;
  createdAt: number;
}

// ============================================================================
// SSE EVENT TYPES
// ============================================================================

export interface SSETokenEvent {
  event: 'token';
  data: {
    sessionId: string;
    content: string;
    done: false;
  };
}

export interface SSEDoneEvent {
  event: 'done';
  data: {
    sessionId: string;
    totalTokens: number;
    latencyMs: number;
  };
}

export interface SSEErrorEvent {
  event: 'error';
  data: {
    sessionId: string;
    error: string;
  };
}

export type SSEStreamEvent = SSETokenEvent | SSEDoneEvent | SSEErrorEvent;

// ============================================================================
// STREAMING SERVICE
// ============================================================================

export class StreamingService {
  private sessions = new Map<string, InternalSession>();

  // --------------------------------------------------------------------------
  // Create a new streaming session
  // --------------------------------------------------------------------------

  async createStreamSession(agentType: AgentType, userId: string): Promise<StreamSession> {
    const id = crypto.randomUUID();

    const session: InternalSession = {
      id,
      agentType,
      status: 'pending',
      userId,
      createdAt: Date.now(),
      abortController: new AbortController(),
    };

    this.sessions.set(id, session);

    // Best-effort DB persistence
    try {
      await (db as unknown as { run: (...args: unknown[]) => Promise<unknown> }).run(
        `INSERT INTO agent_stream_sessions (id, agent_type, user_id, session_status, model_id, provider, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [id, agentType, userId, 'pending', 'default', 'anthropic'],
      );
    } catch {
      // DB write is best-effort; in-memory map is the source of truth
    }

    return {
      id: session.id,
      agentType: session.agentType,
      status: session.status,
    };
  }

  // --------------------------------------------------------------------------
  // Stream an agent response as SSE events
  // --------------------------------------------------------------------------

  async *streamAgentResponse(
    sessionId: string,
    agent: VercelAgent<any, any>,
    input: unknown,
  ): AsyncGenerator<SSEStreamEvent> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      yield {
        event: 'error',
        data: { sessionId, error: 'Session not found' },
      };
      return;
    }

    session.status = 'streaming';
    const startMs = Date.now();
    let tokenCount = 0;

    // Update DB status to streaming
    this.updateSessionInDb(sessionId, {
      session_status: 'streaming',
      stream_started_at: new Date().toISOString(),
      input_payload: JSON.stringify(input),
    });

    try {
      for await (const chunk of agent.stream(input)) {
        // Check if session has been cancelled
        if (session.abortController.signal.aborted) {
          yield {
            event: 'error',
            data: { sessionId, error: 'Session cancelled' },
          };
          return;
        }

        tokenCount += 1; // Approximate: 1 chunk ~ 1 token

        yield {
          event: 'token',
          data: {
            sessionId,
            content: chunk,
            done: false as const,
          },
        };
      }

      // Completed successfully
      const latencyMs = Date.now() - startMs;

      session.status = 'completed';
      session.latencyMs = latencyMs;
      session.tokenUsage = {
        promptTokens: 0, // Not available from stream
        completionTokens: tokenCount,
        totalTokens: tokenCount,
      };

      yield {
        event: 'done',
        data: {
          sessionId,
          totalTokens: tokenCount,
          latencyMs,
        },
      };

      // Update DB on completion
      this.updateSessionInDb(sessionId, {
        session_status: 'completed',
        stream_completed_at: new Date().toISOString(),
        latency_ms: latencyMs,
        token_usage: JSON.stringify({
          promptTokens: 0,
          completionTokens: tokenCount,
          totalTokens: tokenCount,
        }),
      });
    } catch (err) {
      const latencyMs = Date.now() - startMs;
      const errorMessage = err instanceof Error ? err.message : 'Unknown streaming error';

      session.status = 'errored';
      session.latencyMs = latencyMs;

      yield {
        event: 'error',
        data: {
          sessionId,
          error: errorMessage,
        },
      };

      // Update DB on error
      this.updateSessionInDb(sessionId, {
        session_status: 'errored',
        stream_completed_at: new Date().toISOString(),
        latency_ms: latencyMs,
        error_message: errorMessage,
      });
    }
  }

  // --------------------------------------------------------------------------
  // Get session status
  // --------------------------------------------------------------------------

  async getSessionStatus(sessionId: string): Promise<StreamSession | null> {
    const session = this.sessions.get(sessionId);
    if (session) {
      return {
        id: session.id,
        agentType: session.agentType,
        status: session.status,
        tokenUsage: session.tokenUsage,
        latencyMs: session.latencyMs,
      };
    }

    // Fall back to DB lookup
    try {
      const rows = await (db as unknown as { all: (...args: unknown[]) => Promise<unknown[]> }).all(
        `SELECT id, agent_type, session_status, token_usage, latency_ms
         FROM agent_stream_sessions WHERE id = $1`,
        [sessionId],
      );
      const rawRow = Array.isArray(rows) ? rows[0] : rows;
      if (!rawRow) return null;
      const row = rawRow as Record<string, unknown>;

      let tokenUsage: StreamSession['tokenUsage'];
      if (row.token_usage) {
        try {
          tokenUsage =
            typeof row.token_usage === 'string' ? JSON.parse(row.token_usage) : row.token_usage;
        } catch {
          // ignore parse errors
        }
      }

      return {
        id: row.id as string,
        agentType: row.agent_type as AgentType,
        status: row.session_status as StreamSession['status'],
        tokenUsage,
        latencyMs: (row.latency_ms as number | null) ?? undefined,
      };
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Cancel a streaming session
  // --------------------------------------------------------------------------

  async cancelSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.abortController.abort();
      session.status = 'errored';
    }

    this.updateSessionInDb(sessionId, {
      session_status: 'cancelled',
      stream_completed_at: new Date().toISOString(),
      error_message: 'Cancelled by user',
    });
  }

  // --------------------------------------------------------------------------
  // Get session history for a user
  // --------------------------------------------------------------------------

  async getSessionHistory(
    userId: string,
    limit: number = 50,
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const rows = await (db as unknown as { all: (...args: unknown[]) => Promise<unknown[]> }).all(
        `SELECT id, agent_type, session_status, token_usage, latency_ms,
                stream_started_at, stream_completed_at, error_message,
                model_id, provider, created_at
         FROM agent_stream_sessions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit],
      );
      return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
    } catch {
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // Cleanup stale sessions (stuck in 'streaming' for > 5 minutes)
  // --------------------------------------------------------------------------

  async cleanupStaleSessions(): Promise<number> {
    const staleThresholdMs = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    let cleaned = 0;

    // Clean in-memory sessions
    for (const [id, session] of this.sessions.entries()) {
      if (session.status === 'streaming' && now - session.createdAt > staleThresholdMs) {
        session.status = 'errored';
        session.abortController.abort();
        this.sessions.delete(id);
        cleaned++;
      }
    }

    // Clean DB sessions
    try {
      await (db as unknown as { run: (...args: unknown[]) => Promise<unknown> }).run(
        `UPDATE agent_stream_sessions
         SET session_status = 'errored',
             error_message = 'Session timed out (stale cleanup)',
             updated_at = NOW()
         WHERE session_status = 'streaming'
           AND stream_started_at < NOW() - INTERVAL '5 minutes'`,
      );
    } catch {
      // Best effort
    }

    return cleaned;
  }

  // --------------------------------------------------------------------------
  // Private: best-effort DB update helper
  // --------------------------------------------------------------------------

  private updateSessionInDb(
    sessionId: string,
    fields: Record<string, string | number | null>,
  ): void {
    const setClauses: string[] = [];
    const values: Array<string | number | null> = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = $${paramIdx}`);
      values.push(value);
      paramIdx++;
    }

    // Always update updated_at
    setClauses.push(`updated_at = NOW()`);

    values.push(sessionId);

    const sql = `UPDATE agent_stream_sessions SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`;

    // Fire-and-forget — do not await
    (db as unknown as { run: (...args: unknown[]) => Promise<unknown> }).run(sql, values).catch(() => {
      // Silently ignore DB write failures
    });
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const streamingService = new StreamingService();
