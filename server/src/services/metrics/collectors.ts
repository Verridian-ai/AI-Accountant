/**
 * Metric collection logic -- recording parse attempts and accuracy queries.
 *
 * Error analysis, confidence distribution, and feedback summary in collector-queries.ts.
 */

import { db, parserMetrics, statements } from '../../schema.js';
import { eq, and, gte, lte, sql, count, avg, sum } from 'drizzle-orm';
import crypto from 'crypto';
import type { DateRange, ParserAccuracyResult } from './types.js';

const PARSER_VERSION = '1.0.0';

/** Record a parse attempt with all relevant metrics */
export async function recordParseAttempt(
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

  const confidenceScores = options?.confidenceScores || [];
  const highConfidenceCount = confidenceScores.filter((s) => s >= 0.8).length;
  const lowConfidenceCount = confidenceScores.filter((s) => s < 0.5).length;

  await db.insert(parserMetrics).values({
    id,
    statementId,
    bankId: parserId,
    parserVersion: PARSER_VERSION,
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

/** Get parser accuracy (success rate) for a specific parser within a date range */
export async function getParserAccuracy(
  parserId: string,
  dateRange?: DateRange,
): Promise<ParserAccuracyResult> {
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

/** Calculate percentile from sorted array */
export function percentile(sortedArr: number[], p: number): number | null {
  if (sortedArr.length === 0) return null;
  const index = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(index, sortedArr.length - 1))];
}

// Re-export query functions for backward compatibility
export {
  getTopErrors,
  getConfidenceDistribution,
  getFeedbackSummary,
} from './collector-queries.js';
