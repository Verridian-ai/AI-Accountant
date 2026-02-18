/**
 * Cross-Module Intelligence — Insight CRUD Operations
 *
 * Provides read, update, and status management for persisted insights.
 */

import { db, crossModuleInsights } from '../../schema.js';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { CrossModuleInsight, InsightFilters } from './types.js';
import { rowToInsight } from './helpers.js';

export async function getInsights(
  userId: string,
  filters: InsightFilters = {},
): Promise<{ items: CrossModuleInsight[]; total: number }> {
  const { limit = 20, offset = 0 } = filters;
  const conditions: SQL[] = [eq(crossModuleInsights.userId, userId)];

  if (filters.insightType) {
    conditions.push(eq(crossModuleInsights.insightType, filters.insightType));
  }
  if (filters.severity) {
    conditions.push(eq(crossModuleInsights.severity, filters.severity));
  }
  if (filters.status) {
    conditions.push(eq(crossModuleInsights.status, filters.status));
  }
  if (filters.minConfidence != null) {
    conditions.push(gte(crossModuleInsights.confidence, filters.minConfidence));
  }
  if (filters.dateFrom) {
    conditions.push(gte(crossModuleInsights.createdAt, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(crossModuleInsights.createdAt, filters.dateTo));
  }

  const whereClause = and(...conditions);

  const countResult = await db
    .select({ count: sql`count(*)` })
    .from(crossModuleInsights)
    .where(whereClause)
    .get();
  const total = Number(countResult?.count ?? 0);

  const rows = await db
    .select()
    .from(crossModuleInsights)
    .where(whereClause)
    .orderBy(desc(crossModuleInsights.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  let items: CrossModuleInsight[] = rows.map((r: Record<string, unknown>) => rowToInsight(r));

  if (filters.sourceModules?.length) {
    items = items.filter((i: CrossModuleInsight) =>
      i.sourceModules.some((m: string) => filters.sourceModules!.includes(m)),
    );
    return { items, total: items.length };
  }

  return { items, total };
}

export async function getInsightById(insightId: string): Promise<CrossModuleInsight | null> {
  const row = await db
    .select()
    .from(crossModuleInsights)
    .where(eq(crossModuleInsights.id, insightId))
    .get();

  return row ? rowToInsight(row) : null;
}

export async function markInsightViewed(insightId: string): Promise<void> {
  await db
    .update(crossModuleInsights)
    .set({ status: 'viewed' })
    .where(eq(crossModuleInsights.id, insightId))
    .run();
}

export async function actOnInsight(insightId: string, _action?: string): Promise<void> {
  await db
    .update(crossModuleInsights)
    .set({ status: 'acted_on', actedOnAt: new Date().toISOString() })
    .where(eq(crossModuleInsights.id, insightId))
    .run();
}

export async function dismissInsight(insightId: string): Promise<void> {
  await db
    .update(crossModuleInsights)
    .set({ status: 'dismissed' })
    .where(eq(crossModuleInsights.id, insightId))
    .run();
}
