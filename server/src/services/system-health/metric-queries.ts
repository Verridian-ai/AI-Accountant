/**
 * Metric Queries — Query methods for system metrics and health history.
 */

import { db } from '../../schema.js';
import { systemMetrics, systemHealthChecks } from '../../db/admin-schema.js';
import { sql, desc, gte, lte, eq, and } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';
import type { MetricFilter } from './types.js';
import { CONFIG } from './types.js';

export async function getMetrics(filters: MetricFilter = {}): Promise<any[]> {
  try {
    const conditions: any[] = [];
    if (filters.startTime) {
      conditions.push(gte(systemMetrics.observationTime, filters.startTime));
    }
    if (filters.endTime) {
      conditions.push(lte(systemMetrics.observationTime, filters.endTime));
    }
    if (filters.source) {
      conditions.push(eq(systemMetrics.source, filters.source));
    }
    if (filters.metricName) {
      conditions.push(eq(systemMetrics.metricName, filters.metricName));
    }

    if (filters.aggregation) {
      const aggFn = {
        avg: sql`AVG(${systemMetrics.value})`,
        min: sql`MIN(${systemMetrics.value})`,
        max: sql`MAX(${systemMetrics.value})`,
        sum: sql`SUM(${systemMetrics.value})`,
      }[filters.aggregation];

      const intervalExpr =
        filters.interval === 'minute'
          ? sql`substr(${systemMetrics.observationTime}, 1, 16)`
          : filters.interval === 'hour'
            ? sql`substr(${systemMetrics.observationTime}, 1, 13)`
            : sql`substr(${systemMetrics.observationTime}, 1, 10)`;

      const query = db
        .select({
          period: intervalExpr,
          metricName: systemMetrics.metricName,
          value: aggFn,
          count: sql<number>`count(*)`,
        })
        .from(systemMetrics);

      if (conditions.length > 0) {
        return await (query as any)
          .where(and(...conditions))
          .groupBy(intervalExpr, systemMetrics.metricName)
          .orderBy(desc(intervalExpr))
          .limit(filters.limit ?? 500)
          .all();
      }

      return await (query as any)
        .groupBy(intervalExpr, systemMetrics.metricName)
        .orderBy(desc(intervalExpr))
        .limit(filters.limit ?? 500)
        .all();
    }

    const query = db.select().from(systemMetrics);
    if (conditions.length > 0) {
      return await (query as any)
        .where(and(...conditions))
        .orderBy(desc(systemMetrics.observationTime))
        .limit(filters.limit ?? 200)
        .all();
    }

    return await (query as any)
      .orderBy(desc(systemMetrics.observationTime))
      .limit(filters.limit ?? 200)
      .all();
  } catch (err: any) {
    logger.error('[SystemHealth] Failed to get metrics:', err.message);
    return [];
  }
}

export async function getHealthHistory(serviceName?: string, hours: number = 24): Promise<any[]> {
  try {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const conditions: any[] = [gte(systemHealthChecks.checkedAt, cutoff)];
    if (serviceName) {
      conditions.push(eq(systemHealthChecks.serviceName, serviceName));
    }
    return await db
      .select()
      .from(systemHealthChecks)
      .where(and(...conditions))
      .orderBy(desc(systemHealthChecks.checkedAt))
      .limit(500)
      .all();
  } catch (err: any) {
    logger.error('[SystemHealth] Failed to get health history:', err.message);
    return [];
  }
}

export async function cleanupOldData(): Promise<{ deletedMetrics: number; deletedChecks: number }> {
  const cutoff = new Date(Date.now() - CONFIG.retentionHours * 60 * 60 * 1000).toISOString();
  let deletedMetrics = 0;
  let deletedChecks = 0;

  try {
    await db.delete(systemMetrics).where(lte(systemMetrics.observationTime, cutoff)).run();
    deletedMetrics = -1;
    await db.delete(systemHealthChecks).where(lte(systemHealthChecks.checkedAt, cutoff)).run();
    deletedChecks = -1;
    logger.info(`[SystemHealth] Cleaned up data older than ${CONFIG.retentionHours}h`);
  } catch (err: any) {
    logger.error('[SystemHealth] Cleanup failed:', err.message);
  }

  return { deletedMetrics, deletedChecks };
}
