/**
 * Cognee Feedback Service — Type definitions.
 */

export interface FeedbackSubmission {
  entityType: 'datapoint' | 'search_result' | 'graph_node' | 'extraction';
  entityId: string;
  feedbackType: 'correct' | 'incorrect' | 'partial' | 'irrelevant' | 'missing';
  originalValue?: string;
  correctedValue?: string;
  context?: { query?: string; dataset?: string; searchType?: string };
  datapointConfigId?: string;
}

export interface FeedbackFilters {
  entityType?: string;
  feedbackType?: string;
  datapointConfigId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface FeedbackStats {
  total: number;
  byType: Record<string, number>;
  byEntityType: Record<string, number>;
  accuracyRate: number;
  trend: 'improving' | 'declining' | 'stable';
  topCorrectedFields: Array<{ field: string; correctionCount: number }>;
  recentFeedback: any[];
}

export interface MemifyOptions {
  datasetNames?: string[];
  minFeedbackCount?: number;
  forceRun?: boolean;
}

export interface MemifyResult {
  processed: number;
  datasets: string[];
  newAccuracyScores: Record<string, number>;
  status: 'triggered' | 'skipped' | 'insufficient_feedback';
}

export interface DataPointAccuracy {
  datapointConfigId: string;
  totalFeedback: number;
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
  accuracyScore: number;
  trend: 'improving' | 'declining' | 'stable';
  lastUpdated: string;
}
