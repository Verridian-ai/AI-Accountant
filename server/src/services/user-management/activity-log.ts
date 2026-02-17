/**
 * User Management — Activity Logging Operations
 */

import crypto from 'crypto';
import { db } from '../../schema.js';
import { userActivityLog } from '../../db/admin-schema.js';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import type {
  ActivityLogInput,
  ActivityLogFilters,
  ActivitySummary,
  PaginatedResult,
} from './types.js';

export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    const id = crypto.randomUUID();
    await db
      .insert(userActivityLog)
      .values({
        id,
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        action: input.action,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        details: JSON.stringify(input.details ?? {}),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        durationMs: input.durationMs ?? null,
        status: input.status ?? 'success',
        createdAt: new Date().toISOString(),
      })
      .run();
  } catch {
    // Non-blocking — don't fail if logging fails
  }
}

export async function getActivityLog(filters: ActivityLogFilters): Promise<PaginatedResult<any>> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const conditions: any[] = [];
  if (filters.userId) conditions.push(eq(userActivityLog.userId, filters.userId));
  if (filters.action) conditions.push(eq(userActivityLog.action, filters.action));
  if (filters.resourceType) conditions.push(eq(userActivityLog.resourceType, filters.resourceType));
  if (filters.status) conditions.push(eq(userActivityLog.status, filters.status));
  if (filters.from) conditions.push(gte(userActivityLog.createdAt, filters.from));
  if (filters.to) conditions.push(lte(userActivityLog.createdAt, filters.to));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(userActivityLog)
    .where(whereClause)
    .get();
  const total = countResult?.count ?? 0;

  const rows = await db
    .select()
    .from(userActivityLog)
    .where(whereClause)
    .orderBy(desc(userActivityLog.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return { data: rows, total, limit, offset };
}

export async function getActivitySummary(
  userId?: string,
  days: number = 30,
): Promise<ActivitySummary> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const conditions: any[] = [gte(userActivityLog.createdAt, cutoff)];
  if (userId) conditions.push(eq(userActivityLog.userId, userId));
  const whereClause = and(...conditions);

  const rows = await db
    .select()
    .from(userActivityLog)
    .where(whereClause)
    .orderBy(desc(userActivityLog.createdAt))
    .all();

  // Compute aggregates
  const actionBreakdown: Record<string, number> = {};
  const dailyCounts: Record<string, number> = {};
  const hourlyCounts: Record<number, number> = {};
  const resourceCounts: Record<string, number> = {};

  for (const row of rows) {
    actionBreakdown[row.action] = (actionBreakdown[row.action] || 0) + 1;

    const date = row.createdAt.substring(0, 10);
    dailyCounts[date] = (dailyCounts[date] || 0) + 1;

    const hour = parseInt(row.createdAt.substring(11, 13), 10);
    if (!isNaN(hour)) {
      hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
    }

    if (row.resourceType) {
      resourceCounts[row.resourceType] = (resourceCounts[row.resourceType] || 0) + 1;
    }
  }

  const dailyActivity = Object.entries(dailyCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const mostActiveHour = Object.entries(hourlyCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '0';

  const topResources = Object.entries(resourceCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalActions: rows.length,
    actionBreakdown,
    dailyActivity,
    mostActiveHour: parseInt(mostActiveHour, 10),
    topResources,
    lastActivity: rows[0]?.createdAt ?? '',
  };
}

export async function cleanupActivityLog(olderThanDays: number = 90): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(userActivityLog)
    .where(lte(userActivityLog.createdAt, cutoff))
    .get();
  const count = countResult?.count ?? 0;

  if (count > 0) {
    await db.delete(userActivityLog).where(lte(userActivityLog.createdAt, cutoff)).run();
  }

  return count;
}
