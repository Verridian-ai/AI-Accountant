/**
 * Metric aggregation — aggregated metrics and rollup computation/save.
 */

import { db, parserMetrics, parserAccuracyAggregates, statements } from '../../schema.js';
import { eq, and, gte, lte, sql, count, avg, min, max, sum, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import type { DateRange, AggregatedMetrics } from './types.js';
import { percentile } from './collectors.js';

// Re-export from rollups for backward compatibility
export { computeRollups, getTrendData, getParserStatsByBank } from './rollups.js';

/**
 * Get aggregated metrics across all parsers or for a specific date range
 */
export async function getAggregatedMetrics(dateRange?: DateRange): Promise<AggregatedMetrics[]> {
  const conditions = [];
  if (dateRange) {
    conditions.push(gte(parserMetrics.createdAt, dateRange.startDate));
    conditions.push(lte(parserMetrics.createdAt, dateRange.endDate + 'T23:59:59.999Z'));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rawMetrics = await db
    .select({
      bankId: parserMetrics.bankId,
      totalAttempts: count(),
      successfulAttempts: sql<number>`SUM(CASE WHEN ${parserMetrics.parseErrorCount} = 0 THEN 1 ELSE 0 END)`,
      failedAttempts: sql<number>`SUM(CASE WHEN ${parserMetrics.parseErrorCount} > 0 THEN 1 ELSE 0 END)`,
      totalTransactions: sum(parserMetrics.transactionsParsed),
      avgDurationMs: avg(parserMetrics.totalDurationMs),
      minDurationMs: min(parserMetrics.totalDurationMs),
      maxDurationMs: max(parserMetrics.totalDurationMs),
      avgConfidence: avg(parserMetrics.detectionConfidence),
      totalHighConfidence: sum(parserMetrics.highConfidenceCount),
      totalLowConfidence: sum(parserMetrics.lowConfidenceCount),
      textCount: sql<number>`SUM(CASE WHEN ${parserMetrics.extractionMethod} = 'text' THEN 1 ELSE 0 END)`,
      visionCount: sql<number>`SUM(CASE WHEN ${parserMetrics.extractionMethod} = 'vision' THEN 1 ELSE 0 END)`,
      hybridCount: sql<number>`SUM(CASE WHEN ${parserMetrics.extractionMethod} = 'hybrid' THEN 1 ELSE 0 END)`,
    })
    .from(parserMetrics)
    .where(whereClause)
    .groupBy(parserMetrics.bankId)
    .all();

  const results: AggregatedMetrics[] = [];

  for (const metric of rawMetrics) {
    const durations = await db
      .select({ duration: parserMetrics.totalDurationMs })
      .from(parserMetrics)
      .where(
        whereClause
          ? and(eq(parserMetrics.bankId, metric.bankId), whereClause)
          : eq(parserMetrics.bankId, metric.bankId),
      )
      .orderBy(parserMetrics.totalDurationMs)
      .all();

    const durationValues = durations.map((d: { duration: number }) => d.duration);
    const p50 = percentile(durationValues, 50);
    const p95 = percentile(durationValues, 95);

    const totalAttempts = Number(metric.totalAttempts || 0);
    const successfulAttempts = Number(metric.successfulAttempts || 0);
    const failedAttempts = Number(metric.failedAttempts || 0);
    const totalTransactions = Number(metric.totalTransactions || 0);
    const totalConfidenceItems =
      Number(metric.totalHighConfidence || 0) + Number(metric.totalLowConfidence || 0);

    results.push({
      parserId: metric.bankId,
      periodType: 'custom',
      periodStart: dateRange?.startDate || '',
      periodEnd: dateRange?.endDate || '',
      totalParseAttempts: totalAttempts,
      successfulParses: successfulAttempts,
      failedParses: failedAttempts,
      successRate: totalAttempts > 0 ? successfulAttempts / totalAttempts : 0,
      totalTransactionsParsed: totalTransactions,
      avgTransactionsPerStatement: totalAttempts > 0 ? totalTransactions / totalAttempts : null,
      avgDurationMs: metric.avgDurationMs ? Number(metric.avgDurationMs) : null,
      minDurationMs: metric.minDurationMs ?? null,
      maxDurationMs: metric.maxDurationMs ?? null,
      p50DurationMs: p50,
      p95DurationMs: p95,
      avgConfidenceScore: metric.avgConfidence ? Number(metric.avgConfidence) : null,
      highConfidenceRate:
        totalConfidenceItems > 0
          ? Number(metric.totalHighConfidence || 0) / totalConfidenceItems
          : null,
      lowConfidenceRate:
        totalConfidenceItems > 0
          ? Number(metric.totalLowConfidence || 0) / totalConfidenceItems
          : null,
      errorTypeBreakdown: {},
      methodBreakdown: {
        text: Number(metric.textCount || 0),
        vision: Number(metric.visionCount || 0),
        hybrid: Number(metric.hybridCount || 0),
      },
    });
  }

  return results;
}

/**
 * Compute and save a rollup for a specific period
 */
export async function computeAndSaveRollup(
  bankId: string,
  periodType: 'daily' | 'weekly' | 'monthly',
  periodStart: string,
  periodEnd: string,
): Promise<boolean> {
  const metrics = await db
    .select()
    .from(parserMetrics)
    .where(
      and(
        eq(parserMetrics.bankId, bankId),
        gte(parserMetrics.createdAt, periodStart),
        lte(parserMetrics.createdAt, periodEnd + 'T23:59:59.999Z'),
      ),
    )
    .all();

  if (metrics.length === 0) return false;

  const totalParseAttempts = metrics.length;
  const successfulParses = metrics.filter(
    (m: { parseErrorCount: number | null }) => m.parseErrorCount === 0,
  ).length;
  const _failedParses = totalParseAttempts - successfulParses;
  const _totalTransactionsParsed = metrics.reduce(
    (s: number, m: { transactionsParsed: number | null }) => s + (m.transactionsParsed || 0),
    0,
  );

  const durations = metrics
    .map((m: { totalDurationMs: number }) => m.totalDurationMs)
    .sort((a: number, b: number) => a - b);
  const avgDurationMs = durations.reduce((a: number, b: number) => a + b, 0) / durations.length;
  const _minDurationMs = durations[0];
  const _maxDurationMs = durations[durations.length - 1];
  const _p50DurationMs = percentile(durations, 50);
  const _p95DurationMs = percentile(durations, 95);

  const confidenceScores = metrics
    .filter((m: { detectionConfidence: number | null }) => m.detectionConfidence !== null)
    .map((m: { detectionConfidence: number | null }) => m.detectionConfidence!);
  const avgConfidenceScore =
    confidenceScores.length > 0
      ? confidenceScores.reduce((a: number, b: number) => a + b, 0) / confidenceScores.length
      : null;

  const totalHighConfidence = metrics.reduce(
    (s: number, m: { highConfidenceCount: number | null }) => s + (m.highConfidenceCount || 0),
    0,
  );
  const totalLowConfidence = metrics.reduce(
    (s: number, m: { lowConfidenceCount: number | null }) => s + (m.lowConfidenceCount || 0),
    0,
  );
  const _totalConfidenceItems = totalHighConfidence + totalLowConfidence;

  const _textExtractionCount = metrics.filter(
    (m: { extractionMethod: string | null }) => m.extractionMethod === 'text',
  ).length;
  const visionExtractionCount = metrics.filter(
    (m: { extractionMethod: string | null }) => m.extractionMethod === 'vision',
  ).length;
  const _hybridExtractionCount = metrics.filter(
    (m: { extractionMethod: string | null }) => m.extractionMethod === 'hybrid',
  ).length;

  const stmtIds = metrics
    .map((m: { statementId: string | null }) => m.statementId)
    .filter((id: string | null) => id && typeof id === 'string');
  const errorBreakdown: Record<string, number> = {};

  if (stmtIds.length > 0) {
    const stmts = await db
      .select({ errorType: statements.errorType })
      .from(statements)
      .where(inArray(statements.id, stmtIds))
      .all();

    for (const stmt of stmts) {
      if (stmt.errorType) {
        errorBreakdown[stmt.errorType] = (errorBreakdown[stmt.errorType] || 0) + 1;
      }
    }
  }

  const now = new Date().toISOString();

  const existingAgg = await db
    .select()
    .from(parserAccuracyAggregates)
    .where(
      and(
        eq(parserAccuracyAggregates.bankId, bankId),
        eq(parserAccuracyAggregates.periodType, periodType),
        eq(parserAccuracyAggregates.periodStart, periodStart),
      ),
    )
    .get();

  const aggregateValues = {
    totalParseAttempts,
    successfulParses,
    failedParses,
    totalTransactionsParsed,
    avgTransactionsPerStatement:
      totalParseAttempts > 0 ? totalTransactionsParsed / totalParseAttempts : null,
    avgDurationMs,
    minDurationMs,
    maxDurationMs,
    p50DurationMs,
    p95DurationMs,
    avgConfidenceScore,
    highConfidenceRate:
      totalConfidenceItems > 0 ? totalHighConfidence / totalConfidenceItems : null,
    lowConfidenceRate: totalConfidenceItems > 0 ? totalLowConfidence / totalConfidenceItems : null,
    errorTypeBreakdown: JSON.stringify(errorBreakdown),
    textExtractionCount,
    visionExtractionCount,
    hybridExtractionCount,
    lastUpdatedAt: now,
  };

  if (existingAgg) {
    await db
      .update(parserAccuracyAggregates)
      .set(aggregateValues)
      .where(eq(parserAccuracyAggregates.id, existingAgg.id));
  } else {
    await db.insert(parserAccuracyAggregates).values({
      id: crypto.randomUUID(),
      bankId,
      periodType,
      periodStart,
      periodEnd,
      ...aggregateValues,
      createdAt: now,
    });
  }

  return true;
}
