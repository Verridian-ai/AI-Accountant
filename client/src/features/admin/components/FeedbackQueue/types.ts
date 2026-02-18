export interface FeedbackItem {
  id: string;
  userId: string;
  username: string;
  transactionId: string;
  transactionDescription: string;
  transactionAmount: number;
  feedbackType: 'category_correction' | 'gst_correction' | 'parser_error' | 'other';
  originalValue: string;
  suggestedValue: string;
  userComment?: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface FeedbackQueueProps {
  onApproveFeedback?: (id: string) => Promise<void>;
  onRejectFeedback?: (id: string, reason?: string) => Promise<void>;
  onApplyCorrection?: (id: string) => Promise<void>;
  onViewTransaction?: (transactionId: string) => void;
  className?: string;
}
