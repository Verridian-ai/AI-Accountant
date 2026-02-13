import {
  db,
  parserMetrics,
  parserAccuracyAggregates,
  statements,
  parserFeedback,
} from '../schema.js';
import { eq, and, gte, lte, desc, sql, count, avg, min, max, sum, inArray } from 'drizzle-orm';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface ParseAttemptRecord {
  parserId: string;
  statementId: string;
  success: boolean;
  durationMs: number;
  transactionCount: number;
  errorMessage?: string;
  errorType?: string;
  extractionMethod?: 'text' | 'vision' | 'hybrid';
  confidenceScores?: number[];
  pdfExtractionMs?: number;
  textParsingMs?: number;
  aiCategorizationMs?: number;
  aiCallCount?: number;
  aiTokensUsed?: number;
}

export interface ParserAccuracyResult {
  parserId: string;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  successRate: number;
  avgDurationMs: number;
  avgTransactionsPerStatement: number;
}

export interface AggregatedMetrics {
  parserId: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  totalParseAttempts: number;
  successfulParses: number;
  failedParses: number;
  successRate: number;
  totalTransactionsParsed: number;
  avgTransactionsPerStatement: number | null;
  avgDurationMs: number | null;
  minDurationMs: number | null;
  maxDurationMs: number | null;
  p50DurationMs: number | null;
  p95DurationMs: number | null;
  avgConfidenceScore: number | null;
  highConfidenceRate: number | null;
  lowConfidenceRate: number | null;
  errorTypeBreakdown: Record<string, number>;
  methodBreakdown: {
    text: number;
    vision: number;
    hybrid: number;
  };
}

export interface TopError {
  errorType: string;
  errorMessage: string;
  count: number;
  lastOccurred: string;
  affectedParsers: string[];
}

export interface TrendDataPoint {
  date: string;
  successRate: number;
  totalAttempts: number;
  avgDurationMs: number;
  avgTransactions: number;
}

export interface ConfidenceBucket {
  range: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
}

// ============================================================================
// ParserMetrics Class
// ============================================================================

export class ParserMetrics {
  private readonly PARSER_VERSION = '1.0.0';

  /**
   * Record a parse attempt with all relevant metrics
   */
  async recordParseAttempt(
    parserId: string,
    statementId: string,
    success: boolean,
    durationMs: number,
    txCount: number,
    errorMsg?: string,
    options?: {
      errorType?: string;
      extractionMethod?: 'text' | 'vision' | 'hybrid';
      confidenceScores?: number[];
      pdfExtractionMs?: number;
      textParsingMs?: number;
      aiCategorizationMs?: number;
      aiCallCount?: number;
      aiTokensUsed?: number;
      visionFallbackUsed?: boolean;
      detectionConfidence?: number;
    },
  ): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Calculate confidence metrics
    const confidenceScores = options?.confidenceScores || [];
    const highConfidenceCount = confidenceScores.filter((s) => s >= 0.8).length;
    const lowConfidenceCount = confidenceScores.filter((s) => s < 0.5).length;

    await db.insert(parserMetrics).values({
      id,
      statementId,
      bankId: parserId,
      parserVersion: this.PARSER_VERSION,
      totalDurationMs: durationMs,
      pdfExtractionMs: options?.pdfExtractionMs ?? null,
      textParsingMs: options?.textParsingMs ?? null,
      aiCategorizationMs: options?.aiCategorizationMs ?? null,
      transactionsFound: txCount,
      transactionsParsed: success ? txCount : 0,
      highConfidenceCount,
      lowConfidenceCount,
      parseErrorCount: success ? 0 : 1,
      aiCallCount: options?.aiCallCount ?? null,
      aiTokensUsed: options?.aiTokensUsed ?? null,
      visionFallbackUsed: options?.visionFallbackUsed ?? false,
      extractionMethod: options?.extractionMethod || 'text',
      detectionConfidence: options?.detectionConfidence ?? null,
      createdAt: now,
    });

    // If failed, also update the statement with error info
    if (!success && errorMsg) {
      await db
        .update(statements)
        .set({
          errorMessage: errorMsg,
          errorType: options?.errorType || 'PARSE_ERROR',
        })
        .where(eq(statements.id, statementId));
    }

    return id;
  }

  /**
   * Get parser accuracy (success rate) for a specific parser within a date range
   */
  async getParserAccuracy(parserId: string, dateRange?: DateRange): Promise<ParserAccuracyResult> {
    // Build conditions array
    const conditions = [eq(parserMetrics.bankId, parserId)];

    if (dateRange) {
      conditions.push(gte(parserMetrics.createdAt, dateRange.startDate));
      conditions.push(lte(parserMetrics.createdAt, dateRange.endDate + 'T23:59:59.999Z'));
    }

    const result = await db
      .select({
        totalAttempts: count(),
        successfulAttempts: sum(
          sql<number>`CASE WHEN ${parserMetrics.parseErrorCount} = 0 THEN 1 ELSE 0 END`,
        ),
        failedAttempts: sum(
          sql<number>`CASE WHEN ${parserMetrics.parseErrorCount} > 0 THEN 1 ELSE 0 END`,
        ),
        avgDurationMs: avg(parserMetrics.totalDurationMs),
        totalTransactions: sum(parserMetrics.transactionsParsed),
      })
      .from(parserMetrics)
      .where(and(...conditions))
      .get();

    const totalAttempts = Number(result?.totalAttempts || 0);
    const successfulAttempts = Number(result?.successfulAttempts || 0);
    const failedAttempts = Number(result?.failedAttempts || 0);
    const totalTransactions = Number(result?.totalTransactions || 0);

    return {
      parserId,
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      successRate: totalAttempts > 0 ? successfulAttempts / totalAttempts : 0,
      avgDurationMs: Number(result?.avgDurationMs || 0),
      avgTransactionsPerStatement: totalAttempts > 0 ? totalTransactions / totalAttempts : 0,
    };
  }

  /**
   * Get aggregated metrics across all parsers or for a specific date range
   */
  async getAggregatedMetrics(dateRange?: DateRange): Promise<AggregatedMetrics[]> {
    // Build the base query conditions
    const conditions = [];
    if (dateRange) {
      conditions.push(gte(parserMetrics.createdAt, dateRange.startDate));
      conditions.push(lte(parserMetrics.createdAt, dateRange.endDate + 'T23:59:59.999Z'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get raw metrics grouped by bank
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

    // Get duration percentiles (p50, p95) - requires separate queries
    const results: AggregatedMetrics[] = [];

    for (const metric of rawMetrics) {
      // Get all durations for percentile calculation
      const durations = await db
        .select({
          duration: parserMetrics.totalDurationMs,
        })
        .from(parserMetrics)
        .where(
          whereClause
            ? and(eq(parserMetrics.bankId, metric.bankId), whereClause)
            : eq(parserMetrics.bankId, metric.bankId),
        )
        .orderBy(parserMetrics.totalDurationMs)
        .all();

      const durationValues = durations.map((d: { duration: number }) => d.duration);
      const p50 = this.percentile(durationValues, 50);
      const p95 = this.percentile(durationValues, 95);

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
        errorTypeBreakdown: {}, // Will be populated by getTopErrors
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
   * Compute daily, weekly, and monthly rollups and store in aggregates table
   */
  async computeRollups(): Promise<{ daily: number; weekly: number; monthly: number }> {
    const now = new Date();
    let dailyCount = 0;
    let weeklyCount = 0;
    let monthlyCount = 0;

    // Get all unique bank IDs
    const banks = await db
      .selectDistinct({ bankId: parserMetrics.bankId })
      .from(parserMetrics)
      .all();

    for (const { bankId } of banks) {
      // Daily rollup (last 30 days)
      for (let i = 0; i < 30; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dayStart = date.toISOString().split('T')[0];
        const dayEnd = dayStart;

        const saved = await this.computeAndSaveRollup(bankId, 'daily', dayStart, dayEnd);
        if (saved) dailyCount++;
      }

      // Weekly rollup (last 12 weeks)
      for (let i = 0; i < 12; i++) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);

        const saved = await this.computeAndSaveRollup(
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

        const saved = await this.computeAndSaveRollup(
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
   * Get most common parse errors
   */
  async getTopErrors(limit: number = 10, dateRange?: DateRange): Promise<TopError[]> {
    const conditions = [];
    if (dateRange) {
      conditions.push(gte(statements.uploadDate, dateRange.startDate));
      conditions.push(lte(statements.uploadDate, dateRange.endDate + 'T23:59:59.999Z'));
    }
    conditions.push(sql`${statements.errorType} IS NOT NULL`);

    const whereClause = and(...conditions);

    const errors = await db
      .select({
        errorType: statements.errorType,
        errorMessage: statements.errorMessage,
        count: count(),
        lastOccurred: max(statements.uploadDate),
      })
      .from(statements)
      .where(whereClause)
      .groupBy(statements.errorType, statements.errorMessage)
      .orderBy(desc(count()))
      .limit(limit)
      .all();

    // Get affected parsers for each error type
    const results: TopError[] = [];

    for (const error of errors) {
      // Skip if no error type
      if (!error.errorType) {
        results.push({
          errorType: 'UNKNOWN',
          errorMessage: error.errorMessage || 'No message',
          count: Number(error.count || 0),
          lastOccurred: error.lastOccurred || '',
          affectedParsers: [],
        });
        continue;
      }

      const parsers = await db
        .selectDistinct({
          bankId: parserMetrics.bankId,
        })
        .from(parserMetrics)
        .innerJoin(statements, eq(parserMetrics.statementId, statements.id))
        .where(eq(statements.errorType, error.errorType))
        .all();

      results.push({
        errorType: error.errorType,
        errorMessage: error.errorMessage || 'No message',
        count: Number(error.count || 0),
        lastOccurred: error.lastOccurred || '',
        affectedParsers: parsers.map((p: { bankId: string }) => p.bankId),
      });
    }

    return results;
  }

  /**
   * Get time series trend data for dashboard charts
   */
  async getTrendData(
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
   * Get confidence score distribution as histogram data
   */
  async getConfidenceDistribution(dateRange?: DateRange): Promise<ConfidenceBucket[]> {
    const conditions = [];
    if (dateRange) {
      conditions.push(gte(parserMetrics.createdAt, dateRange.startDate));
      conditions.push(lte(parserMetrics.createdAt, dateRange.endDate + 'T23:59:59.999Z'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get all confidence data
    const metrics = await db
      .select({
        highConfidence: parserMetrics.highConfidenceCount,
        lowConfidence: parserMetrics.lowConfidenceCount,
        total: parserMetrics.transactionsParsed,
      })
      .from(parserMetrics)
      .where(whereClause)
      .all();

    // Define buckets: 0-20%, 20-40%, 40-60%, 60-80%, 80-100%
    const buckets: ConfidenceBucket[] = [
      { range: '0-20%', min: 0, max: 0.2, count: 0, percentage: 0 },
      { range: '20-40%', min: 0.2, max: 0.4, count: 0, percentage: 0 },
      { range: '40-60%', min: 0.4, max: 0.6, count: 0, percentage: 0 },
      { range: '60-80%', min: 0.6, max: 0.8, count: 0, percentage: 0 },
      { range: '80-100%', min: 0.8, max: 1.0, count: 0, percentage: 0 },
    ];

    // Calculate totals
    let totalTransactions = 0;
    let totalHighConfidence = 0;
    let totalLowConfidence = 0;

    for (const m of metrics) {
      totalTransactions += m.total || 0;
      totalHighConfidence += m.highConfidence || 0;
      totalLowConfidence += m.lowConfidence || 0;
    }

    // Estimate distribution based on high/low confidence counts
    // High confidence (>=0.8) goes to 80-100% bucket
    buckets[4].count = totalHighConfidence;

    // Low confidence (<0.5) is split between 0-20% and 20-40% and 40-60%
    // Assuming uniform distribution for simplicity
    const lowPerBucket = Math.floor(totalLowConfidence / 3);
    buckets[0].count = lowPerBucket;
    buckets[1].count = lowPerBucket;
    buckets[2].count = totalLowConfidence - lowPerBucket * 2;

    // Medium confidence (0.5-0.8) goes to 60-80%
    const mediumConfidence = totalTransactions - totalHighConfidence - totalLowConfidence;
    buckets[3].count = mediumConfidence;

    // Calculate percentages
    for (const bucket of buckets) {
      bucket.percentage = totalTransactions > 0 ? (bucket.count / totalTransactions) * 100 : 0;
    }

    return buckets;
  }

  /**
   * Get parser stats by bank for a specific period
   */
  async getParserStatsByBank(dateRange?: DateRange): Promise<Map<string, ParserAccuracyResult>> {
    const aggregated = await this.getAggregatedMetrics(dateRange);
    const result = new Map<string, ParserAccuracyResult>();

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

  /**
   * Get feedback summary for parser improvement
   */
  async getFeedbackSummary(dateRange?: DateRange): Promise<{
    totalFeedback: number;
    byType: Record<string, number>;
    byBank: Record<string, number>;
    pendingCount: number;
    appliedCount: number;
  }> {
    const conditions = [];
    if (dateRange) {
      conditions.push(gte(parserFeedback.createdAt, dateRange.startDate));
      conditions.push(lte(parserFeedback.createdAt, dateRange.endDate + 'T23:59:59.999Z'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get all feedback
    const feedback = await db.select().from(parserFeedback).where(whereClause).all();

    const byType: Record<string, number> = {};
    const byBank: Record<string, number> = {};
    let pendingCount = 0;
    let appliedCount = 0;

    for (const f of feedback) {
      // By type
      byType[f.feedbackType] = (byType[f.feedbackType] || 0) + 1;

      // By bank
      if (f.bankId) {
        byBank[f.bankId] = (byBank[f.bankId] || 0) + 1;
      }

      // By status
      if (f.status === 'pending') pendingCount++;
      if (f.status === 'applied') appliedCount++;
    }

    return {
      totalFeedback: feedback.length,
      byType,
      byBank,
      pendingCount,
      appliedCount,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedArr: number[], p: number): number | null {
    if (sortedArr.length === 0) return null;
    const index = Math.ceil((p / 100) * sortedArr.length) - 1;
    return sortedArr[Math.max(0, Math.min(index, sortedArr.length - 1))];
  }

  /**
   * Compute and save a rollup for a specific period
   */
  private async computeAndSaveRollup(
    bankId: string,
    periodType: 'daily' | 'weekly' | 'monthly',
    periodStart: string,
    periodEnd: string,
  ): Promise<boolean> {
    // Get metrics for this period
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

    if (metrics.length === 0) {
      return false;
    }

    // Calculate aggregates
    const totalParseAttempts = metrics.length;
    const successfulParses = metrics.filter(
      (m: { parseErrorCount: number | null }) => m.parseErrorCount === 0,
    ).length;
    const failedParses = totalParseAttempts - successfulParses;
    const totalTransactionsParsed = metrics.reduce(
      (sum: number, m: { transactionsParsed: number | null }) => sum + (m.transactionsParsed || 0),
      0,
    );

    const durations = metrics
      .map((m: { totalDurationMs: number }) => m.totalDurationMs)
      .sort((a: number, b: number) => a - b);
    const avgDurationMs = durations.reduce((a: number, b: number) => a + b, 0) / durations.length;
    const minDurationMs = durations[0];
    const maxDurationMs = durations[durations.length - 1];
    const p50DurationMs = this.percentile(durations, 50);
    const p95DurationMs = this.percentile(durations, 95);

    const confidenceScores = metrics
      .filter((m: { detectionConfidence: number | null }) => m.detectionConfidence !== null)
      .map((m: { detectionConfidence: number | null }) => m.detectionConfidence!);
    const avgConfidenceScore =
      confidenceScores.length > 0
        ? confidenceScores.reduce((a: number, b: number) => a + b, 0) / confidenceScores.length
        : null;

    const totalHighConfidence = metrics.reduce(
      (sum: number, m: { highConfidenceCount: number | null }) =>
        sum + (m.highConfidenceCount || 0),
      0,
    );
    const totalLowConfidence = metrics.reduce(
      (sum: number, m: { lowConfidenceCount: number | null }) => sum + (m.lowConfidenceCount || 0),
      0,
    );
    const totalConfidenceItems = totalHighConfidence + totalLowConfidence;

    const textExtractionCount = metrics.filter(
      (m: { extractionMethod: string | null }) => m.extractionMethod === 'text',
    ).length;
    const visionExtractionCount = metrics.filter(
      (m: { extractionMethod: string | null }) => m.extractionMethod === 'vision',
    ).length;
    const hybridExtractionCount = metrics.filter(
      (m: { extractionMethod: string | null }) => m.extractionMethod === 'hybrid',
    ).length;

    // Get error breakdown from statements
    const stmtIds = metrics
      .map((m: { statementId: string | null }) => m.statementId)
      .filter((id: string | null) => id && typeof id === 'string');
    const errorBreakdown: Record<string, number> = {};

    if (stmtIds.length > 0) {
      // Use inArray from drizzle-orm for safer SQL generation
      const stmts = await db
        .select({
          errorType: statements.errorType,
        })
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

    // Upsert the aggregate
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

    if (existingAgg) {
      await db
        .update(parserAccuracyAggregates)
        .set({
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
          lowConfidenceRate:
            totalConfidenceItems > 0 ? totalLowConfidence / totalConfidenceItems : null,
          errorTypeBreakdown: JSON.stringify(errorBreakdown),
          textExtractionCount,
          visionExtractionCount,
          hybridExtractionCount,
          lastUpdatedAt: now,
        })
        .where(eq(parserAccuracyAggregates.id, existingAgg.id));
    } else {
      await db.insert(parserAccuracyAggregates).values({
        id: crypto.randomUUID(),
        bankId,
        periodType,
        periodStart,
        periodEnd,
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
        lowConfidenceRate:
          totalConfidenceItems > 0 ? totalLowConfidence / totalConfidenceItems : null,
        errorTypeBreakdown: JSON.stringify(errorBreakdown),
        textExtractionCount,
        visionExtractionCount,
        hybridExtractionCount,
        lastUpdatedAt: now,
        createdAt: now,
      });
    }

    return true;
  }
}

// Export singleton instance
export const parserMetricsService = new ParserMetrics();
