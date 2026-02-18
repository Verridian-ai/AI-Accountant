/**
 * Session CRUD — Create, read, update, destroy, list sessions in Redis.
 */

import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { logger } from '../../lib/logger.js';
import type { CogneeSession } from './types.js';
import { SESSION_TTL_SECONDS, KEY_PREFIX } from './constants.js';
import { scanKeys } from './health-stats.js';

export async function createSession(
  redis: Redis,
  userId: string,
  sessionType: string,
): Promise<CogneeSession | null> {
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  const session: CogneeSession = {
    id,
    userId,
    sessionType,
    state: 'active',
    data: {},
    createdAt: now.toISOString(),
    lastActivityAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  try {
    const key = `${KEY_PREFIX}session:${userId}:${id}`;
    await redis.set(key, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
    return session;
  } catch (err: unknown) {
    logger.warn(
      '[CogneeSession] Failed to create session:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

export async function getSession(
  redis: Redis,
  sessionId: string,
  findKey: (id: string) => Promise<string | null>,
): Promise<CogneeSession | null> {
  try {
    const key = await findKey(sessionId);
    if (!key) return null;
    const data = await redis.get(key);
    if (!data) return null;
    const session: CogneeSession = JSON.parse(data);
    session.lastActivityAt = new Date().toISOString();
    await redis.set(key, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
    return session;
  } catch (err: unknown) {
    logger.warn(
      '[CogneeSession] Failed to get session:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

export async function updateSession(
  redis: Redis,
  sessionId: string,
  updates: Partial<Pick<CogneeSession, 'state' | 'data'>>,
  findKey: (id: string) => Promise<string | null>,
): Promise<CogneeSession | null> {
  try {
    const key = await findKey(sessionId);
    if (!key) return null;
    const data = await redis.get(key);
    if (!data) return null;
    const session: CogneeSession = JSON.parse(data);
    if (updates.state) session.state = updates.state;
    if (updates.data) session.data = { ...session.data, ...updates.data };
    session.lastActivityAt = new Date().toISOString();
    await redis.set(key, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
    return session;
  } catch (err: unknown) {
    logger.warn(
      '[CogneeSession] Failed to update session:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

export async function destroySession(
  redis: Redis,
  sessionId: string,
  findKey: (id: string) => Promise<string | null>,
): Promise<boolean> {
  try {
    const key = await findKey(sessionId);
    if (!key) return false;
    const deleted = await redis.del(key);
    return deleted > 0;
  } catch (err: unknown) {
    logger.warn(
      '[CogneeSession] Failed to destroy session:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

export async function listUserSessions(redis: Redis, userId: string): Promise<CogneeSession[]> {
  try {
    const pattern = `${KEY_PREFIX}session:${userId}:*`;
    const keys = await scanKeys(redis, pattern);
    const sessions: CogneeSession[] = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) sessions.push(JSON.parse(data));
    }
    return sessions;
  } catch (err: unknown) {
    logger.warn(
      '[CogneeSession] Failed to list sessions:',
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}
