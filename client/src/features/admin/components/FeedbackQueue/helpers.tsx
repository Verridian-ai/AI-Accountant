import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Clock, Edit3, Tag } from 'lucide-react';
import { formatCurrency } from '../../../../utils/formatters.js';
import type { FeedbackItem } from './types.js';

export { formatCurrency };

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
}

export function getFeedbackTypeBadge(type: FeedbackItem['feedbackType']): React.ReactNode {
  switch (type) {
    case 'category_correction':
      return (
        <Badge variant="secondary" className="gap-1">
          <Tag className="w-3 h-3" />
          Category
        </Badge>
      );
    case 'gst_correction':
      return (
        <Badge variant="warning" className="gap-1">
          <Edit3 className="w-3 h-3" />
          GST
        </Badge>
      );
    case 'parser_error':
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="w-3 h-3" />
          Parser
        </Badge>
      );
    default:
      return <Badge variant="outline">Other</Badge>;
  }
}

export function getStatusBadge(status: FeedbackItem['status']): React.ReactNode {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="warning" className="gap-1">
          <Clock className="w-3 h-3" />
          Pending
        </Badge>
      );
    case 'approved':
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle className="w-3 h-3" />
          Approved
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" />
          Rejected
        </Badge>
      );
    case 'applied':
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle className="w-3 h-3" />
          Applied
        </Badge>
      );
  }
}
