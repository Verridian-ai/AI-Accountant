import { useState, useEffect, useCallback } from 'react';
import type { FeedbackItem, FeedbackQueueProps } from '../types.js';

export function useFeedbackQueue(
  props: Pick<FeedbackQueueProps, 'onApproveFeedback' | 'onRejectFeedback'>,
) {
  const { onApproveFeedback, onRejectFeedback } = props;
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const itemsPerPage = 10;

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge/feedback');
      if (res.ok) {
        const json = (await res.json()) as { items?: FeedbackItem[] };
        setFeedback(json.items ?? []);
      } else {
        setFeedback([]);
      }
    } catch {
      setFeedback([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const filteredFeedback = feedback.filter((item) => {
    const matchesSearch =
      item.transactionDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.suggestedValue.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesType = typeFilter === 'all' || item.feedbackType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalPages = Math.ceil(filteredFeedback.length / itemsPerPage);
  const paginatedFeedback = filteredFeedback.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const pendingCount = feedback.filter((f) => f.status === 'pending').length;
  const approvedCount = feedback.filter((f) => f.status === 'approved').length;
  const rejectedCount = feedback.filter((f) => f.status === 'rejected').length;

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await onApproveFeedback?.(id);
      setFeedback((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, status: 'approved', reviewedAt: new Date().toISOString() } : f,
        ),
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await onRejectFeedback?.(id);
      setFeedback((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, status: 'rejected', reviewedAt: new Date().toISOString() } : f,
        ),
      );
    } finally {
      setProcessingId(null);
    }
  };

  return {
    loading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    currentPage,
    setCurrentPage,
    processingId,
    paginatedFeedback,
    filteredFeedback,
    totalPages,
    itemsPerPage,
    pendingCount,
    approvedCount,
    rejectedCount,
    fetchFeedback,
    handleApprove,
    handleReject,
  };
}
