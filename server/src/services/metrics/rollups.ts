/**
 * Metric Rollups — compute and save daily/weekly/monthly rollups + trend data.
 */

import { db, parserMetrics, parserAccuracyAggregates } from '../../schema.js';
import { eq, desc } from 'drizzle-orm';
import type { TrendDataPoint } from './types.js';
import { computeAndSaveRollup } from './aggregators.js';

/**
 * Compute daily, weekly, and monthly rollups and store in aggregates table
 */
export async function computeRollups(): Promise<{
  daily: number;
  weekly: number;
  monthly: number;
}> {
  const now = new Date();
  let dailyCount = 0;
  let weeklyCount = 0;
  let monthlyCount = 0;

  // Get all unique bank IDs
  const banks = await db.selectDistinct({ bankId: parserMetrics.bankId }).from(parserMetrics).all();

  for (const { bankId } of banks) {
    // Daily rollup (last 30 days)
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = date.toISOString().split('T')[0];
      const dayEnd = dayStart;

      const saved = await computeAndSaveRollup(bankId, 'daily', dayStart, dayEnd);
      if (saved) dailyCount++;
    }

    // Weekly rollup (last 12 weeks)
    for (let i = 0; i < 12; i++) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);

      const saved = await computeAndSaveRollup(
        bankId,
        'weekly',
        weekStart.toISOString().split('T')[0],
        weekEnd.toISOString().split('T')[0],
      );
      if (saved) weeklyCount++;
    }

    // Monthly rollup (last 12 months)
    for (let i = 0; i < 12; i++) {
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);

      const saved = await computeAndSaveRollup(
        bankId,
        'monthly',
        monthStart.toISOString().split('T')[0],
        monthEnd.toISOString().split('T')[0],
      );
      if (saved) monthlyCount++;
    }
  }

  return { daily: dailyCount, weekly: weeklyCount, monthly: monthlyCount };
}

/**
 * Get time series trend data for dashboard charts
 */
export async function getTrendData(
  periodType: 'daily' | 'weekly' | 'monthly' = 'daily',
  limit: number = 30,
): Promise<TrendDataPoint[]> {
  const aggregates = await db
    .select()
    .from(parserAccuracyAggregates)
    .where(eq(parserAccuracyAggregates.periodType, periodType))
    .orderBy(desc(parserAccuracyAggregates.periodStart))
    .limit(limit)
    .all();

  // Group by date (aggregate across all parsers)
  const dateMap = new Map<
    string,
    {
      totalAttempts: number;
      successfulParses: number;
      totalDuration: number;
      durationCount: number;
      totalTransactions: number;
    }
  >();

  for (const agg of aggregates) {
    const existing = dateMap.get(agg.periodStart) || {
      totalAttempts: 0,
      successfulParses: 0,
      totalDuration: 0,
      durationCount: 0,
      totalTransactions: 0,
    };

    existing.totalAttempts += agg.totalParseAttempts;
    existing.successfulParses += agg.successfulParses;
    if (agg.avgDurationMs !== null) {
      existing.totalDuration += agg.avgDurationMs * agg.totalParseAttempts;
      existing.durationCount += agg.totalParseAttempts;
    }
    existing.totalTransactions += agg.totalTransactionsParsed;

    dateMap.set(agg.periodStart, existing);
  }

  const results: TrendDataPoint[] = [];

  for (const [date, data] of dateMap) {
    results.push({
      date,
      successRate: data.totalAttempts > 0 ? data.successfulParses / data.totalAttempts : 0,
      totalAttempts: data.totalAttempts,
      avgDurationMs: data.durationCount > 0 ? data.totalDuration / data.durationCount : 0,
      avgTransactions: data.totalAttempts > 0 ? data.totalTransactions / data.totalAttempts : 0,
    });
  }

  // Sort by date descending
  return results.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get parser stats by bank for a specific period
 */
export async function getParserStatsByBank(
  dateRange?: import('./types.js').DateRange,
): Promise<Map<string, import('./types.js').ParserAccuracyResult>> {
  const { getAggregatedMetrics } = await import('./aggregators.js');
  const aggregated = await getAggregatedMetrics(dateRange);
  const result = new Map<string, import('./types.js').ParserAccuracyResult>();

  for (const agg of aggregated) {
    result.set(agg.parserId, {
      parserId: agg.parserId,
      totalAttempts: agg.totalParseAttempts,
      successfulAttempts: agg.successfulParses,
      failedAttempts: agg.failedParses,
      successRate: agg.successRate,
      avgDurationMs: agg.avgDurationMs || 0,
      avgTransactionsPerStatement: agg.avgTransactionsPerStatement || 0,
    });
  }

  return result;
}
