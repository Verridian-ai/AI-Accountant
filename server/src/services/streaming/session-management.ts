/**
 * Streaming Session Management — History & Cleanup
 * Extracted from StreamingService to keep files under 300 lines.
 */

import { db } from '../../schema.js';
import type { InternalSession } from './types.js';

/**
 * Get session history for a user from the DB.
 */
export async function getSessionHistory(
  userId: string,
  limit: number = 50,
): Promise<Array<Record<string, unknown>>> {
  try {
    const rows = await (db as any).all(
      `SELECT id, agent_type, session_status, token_usage, latency_ms,
              stream_started_at, stream_completed_at, error_message,
              model_id, provider, created_at
       FROM agent_stream_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/**
 * Cleanup stale sessions (stuck in 'streaming' for > 5 minutes).
 */
export async function cleanupStaleSessions(
  sessions: Map<string, InternalSession>,
): Promise<number> {
  const staleThresholdMs = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();
  let cleaned = 0;

  // Clean in-memory sessions
  for (const [id, session] of sessions.entries()) {
    if (session.status === 'streaming' && now - session.createdAt > staleThresholdMs) {
      session.status = 'errored';
      session.abortController.abort();
      sessions.delete(id);
      cleaned++;
    }
  }

  // Clean DB sessions
  try {
    await (db as any).run(
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
