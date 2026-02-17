// ============================================================================
// Metrics Types and Interfaces
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
