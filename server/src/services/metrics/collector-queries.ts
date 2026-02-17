/**
 * Metric Collector Queries — Error analysis, confidence distribution, and feedback summary.
 */

import { db, parserMetrics, statements, parserFeedback } from '../../schema.js';
import { eq, and, gte, lte, desc, sql, count, max } from 'drizzle-orm';
import type { DateRange, TopError, ConfidenceBucket } from './types.js';

/** Get most common parse errors */
export async function getTopErrors(limit: number = 10, dateRange?: DateRange): Promise<TopError[]> {
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

  const results: TopError[] = [];

  for (const error of errors) {
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
      .selectDistinct({ bankId: parserMetrics.bankId })
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

/** Get confidence score distribution as histogram data */
export async function getConfidenceDistribution(
  dateRange?: DateRange,
): Promise<ConfidenceBucket[]> {
  const conditions = [];
  if (dateRange) {
    conditions.push(gte(parserMetrics.createdAt, dateRange.startDate));
    conditions.push(lte(parserMetrics.createdAt, dateRange.endDate + 'T23:59:59.999Z'));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const metrics = await db
    .select({
      highConfidence: parserMetrics.highConfidenceCount,
      lowConfidence: parserMetrics.lowConfidenceCount,
      total: parserMetrics.transactionsParsed,
    })
    .from(parserMetrics)
    .where(whereClause)
    .all();

  const buckets: ConfidenceBucket[] = [
    { range: '0-20%', min: 0, max: 0.2, count: 0, percentage: 0 },
    { range: '20-40%', min: 0.2, max: 0.4, count: 0, percentage: 0 },
    { range: '40-60%', min: 0.4, max: 0.6, count: 0, percentage: 0 },
    { range: '60-80%', min: 0.6, max: 0.8, count: 0, percentage: 0 },
    { range: '80-100%', min: 0.8, max: 1.0, count: 0, percentage: 0 },
  ];

  let totalTransactions = 0;
  let totalHighConfidence = 0;
  let totalLowConfidence = 0;

  for (const m of metrics) {
    totalTransactions += m.total || 0;
    totalHighConfidence += m.highConfidence || 0;
    totalLowConfidence += m.lowConfidence || 0;
  }

  buckets[4].count = totalHighConfidence;

  const lowPerBucket = Math.floor(totalLowConfidence / 3);
  buckets[0].count = lowPerBucket;
  buckets[1].count = lowPerBucket;
  buckets[2].count = totalLowConfidence - lowPerBucket * 2;

  const mediumConfidence = totalTransactions - totalHighConfidence - totalLowConfidence;
  buckets[3].count = mediumConfidence;

  for (const bucket of buckets) {
    bucket.percentage = totalTransactions > 0 ? (bucket.count / totalTransactions) * 100 : 0;
  }

  return buckets;
}

/** Get feedback summary for parser improvement */
export async function getFeedbackSummary(dateRange?: DateRange): Promise<{
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
  const feedback = await db.select().from(parserFeedback).where(whereClause).all();

  const byType: Record<string, number> = {};
  const byBank: Record<string, number> = {};
  let pendingCount = 0;
  let appliedCount = 0;

  for (const f of feedback) {
    byType[f.feedbackType] = (byType[f.feedbackType] || 0) + 1;
    if (f.bankId) byBank[f.bankId] = (byBank[f.bankId] || 0) + 1;
    if (f.status === 'pending') pendingCount++;
    if (f.status === 'applied') appliedCount++;
  }

  return { totalFeedback: feedback.length, byType, byBank, pendingCount, appliedCount };
}
