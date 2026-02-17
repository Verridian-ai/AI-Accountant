/**
 * Feedback Module — Type Definitions
 *
 * All types, interfaces, and enums for the parser feedback system.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Supported feedback types for parser corrections */
export type FeedbackType =
  | 'category_correction' // User changed category
  | 'amount_correction' // Parsed amount was wrong
  | 'date_correction' // Date parsed incorrectly
  | 'description_correction' // Merchant name wrong
  | 'duplicate_flag' // User marked as duplicate
  | 'split_request'; // User wants to split transaction

/** Status of feedback items */
export type FeedbackStatus = 'pending' | 'reviewed' | 'applied' | 'rejected';

/** Input for submitting feedback */
export interface FeedbackSubmission {
  userId: string;
  transactionId: string;
  feedbackType: FeedbackType;
  correctedValue: string;
  comment?: string;
}

/** Feedback record as stored in the database */
export interface FeedbackRecord {
  id: string;
  userId: string;
  transactionId: string;
  statementId: string | null;
  bankId: string | null;
  feedbackType: string;
  originalValue: string | null;
  correctedValue: string | null;
  aiConfidence: number | null;
  userNotes: string | null;
  status: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

/** Feedback with transaction context for review */
export interface FeedbackWithContext extends FeedbackRecord {
  transaction: {
    id: string;
    date: string;
    description: string;
    amount: number;
    category: string | null;
    merchantNormalized: string | null;
  } | null;
}

/** Aggregated feedback pattern for analysis */
export interface FeedbackPattern {
  feedbackType: FeedbackType;
  originalValue: string;
  correctedValue: string;
  occurrences: number;
  uniqueUsers: number;
  avgConfidence: number | null;
  bankIds: string[];
}

/** Parser improvement suggestion based on feedback patterns */
export interface ParserImprovementSuggestion {
  type:
    | 'category_rule'
    | 'merchant_mapping'
    | 'date_format'
    | 'amount_parsing'
    | 'duplicate_detection';
  priority: 'high' | 'medium' | 'low';
  description: string;
  pattern: string;
  suggestedFix: string;
  affectedCount: number;
  confidence: number;
}

/** Statistics for feedback summary */
export interface FeedbackStats {
  total: number;
  byStatus: Record<FeedbackStatus, number>;
  byType: Record<FeedbackType, number>;
  appliedToday: number;
  pendingReview: number;
  topCorrections: Array<{
    feedbackType: FeedbackType;
    originalValue: string;
    correctedValue: string;
    count: number;
  }>;
}
