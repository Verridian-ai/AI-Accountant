/**
 * ParserMetrics service class — wraps collectors and aggregators
 * to preserve the original class-based API.
 */

import type {
  DateRange,
  ParserAccuracyResult,
  AggregatedMetrics,
  TopError,
  TrendDataPoint,
  ConfidenceBucket,
} from './types.js';
import {
  recordParseAttempt,
  getParserAccuracy,
  getTopErrors,
  getConfidenceDistribution,
  getFeedbackSummary,
} from './collectors.js';
import {
  getAggregatedMetrics,
  computeRollups,
  getTrendData,
  getParserStatsByBank,
} from './aggregators.js';

export class ParserMetrics {
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
    return recordParseAttempt(
      parserId,
      statementId,
      success,
      durationMs,
      txCount,
      errorMsg,
      options,
    );
  }

  async getParserAccuracy(parserId: string, dateRange?: DateRange): Promise<ParserAccuracyResult> {
    return getParserAccuracy(parserId, dateRange);
  }

  async getAggregatedMetrics(dateRange?: DateRange): Promise<AggregatedMetrics[]> {
    return getAggregatedMetrics(dateRange);
  }

  async computeRollups(): Promise<{ daily: number; weekly: number; monthly: number }> {
    return computeRollups();
  }

  async getTopErrors(limit: number = 10, dateRange?: DateRange): Promise<TopError[]> {
    return getTopErrors(limit, dateRange);
  }

  async getTrendData(
    periodType: 'daily' | 'weekly' | 'monthly' = 'daily',
    limit: number = 30,
  ): Promise<TrendDataPoint[]> {
    return getTrendData(periodType, limit);
  }

  async getConfidenceDistribution(dateRange?: DateRange): Promise<ConfidenceBucket[]> {
    return getConfidenceDistribution(dateRange);
  }

  async getParserStatsByBank(dateRange?: DateRange): Promise<Map<string, ParserAccuracyResult>> {
    return getParserStatsByBank(dateRange);
  }

  async getFeedbackSummary(dateRange?: DateRange): Promise<{
    totalFeedback: number;
    byType: Record<string, number>;
    byBank: Record<string, number>;
    pendingCount: number;
    appliedCount: number;
  }> {
    return getFeedbackSummary(dateRange);
  }
}

// Export singleton instance
export const parserMetricsService = new ParserMetrics();
