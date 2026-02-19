import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Clock,
  User,
  FileText,
} from 'lucide-react';
import { useFeedbackQueue } from './hooks/useFeedbackQueue.js';
import { FeedbackQueueSkeleton } from './FeedbackQueueSkeleton.js';
import { formatCurrency, formatTime, getFeedbackTypeBadge, getStatusBadge } from './helpers.js';
import type { FeedbackQueueProps } from './types.js';

export function FeedbackQueue({
  onApproveFeedback,
  onRejectFeedback,
  onApplyCorrection,
  onViewTransaction,
  className,
}: FeedbackQueueProps) {
  const {
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
  } = useFeedbackQueue({ onApproveFeedback, onRejectFeedback });

  if (loading) {
    return <FeedbackQueueSkeleton className={className} />;
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4">
        <button
          type="button"
          className={cn(
            'neu-raised rounded-2xl p-4 border transition-all cursor-pointer w-full text-left',
            statusFilter === 'pending'
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-border/50 hover:border-border',
          )}
          onClick={() => setStatusFilter('pending')}
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
              Pending Review
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
        </button>
        <button
          type="button"
          className={cn(
            'neu-raised rounded-2xl p-4 border transition-all cursor-pointer w-full text-left',
            statusFilter === 'approved'
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-border/50 hover:border-border',
          )}
          onClick={() => setStatusFilter('approved')}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
              Approved
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{approvedCount}</p>
        </button>
        <button
          type="button"
          className={cn(
            'neu-raised rounded-2xl p-4 border transition-all cursor-pointer w-full text-left',
            statusFilter === 'rejected'
              ? 'border-red-500/30 bg-red-500/5'
              : 'border-border/50 hover:border-border',
          )}
          onClick={() => setStatusFilter('rejected')}
        >
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
              Rejected
            </span>
          </div>
          <p className="text-2xl font-bold text-red-400">{rejectedCount}</p>
        </button>
      </div>

      {/* Main Queue */}
      <div className="neu-raised rounded-[2rem] p-6 relative overflow-hidden border border-border/50">
        <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />

        {/* Header */}
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="neu-inset p-3 rounded-xl border border-border/50">
              <MessageSquare className="w-5 h-5 text-cba-gold" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100">Feedback Queue</h3>
              <p className="text-xs text-muted">User corrections and parser feedback</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchFeedback}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Filters */}
        <div className="relative flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <Input
              placeholder="Search feedback..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-overlay border-border rounded-xl"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="category_correction">Category</SelectItem>
              <SelectItem value="gst_correction">GST</SelectItem>
              <SelectItem value="parser_error">Parser Error</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="applied">Applied</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Feedback Items */}
        <div className="relative space-y-3">
          {paginatedFeedback.map((item) => (
            <div
              key={item.id}
              className={cn(
                'p-4 rounded-xl border transition-all',
                item.status === 'pending'
                  ? 'bg-white/[0.02] border-border'
                  : 'bg-white/[0.01] border-border/50',
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {getFeedbackTypeBadge(item.feedbackType)}
                  {getStatusBadge(item.status)}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <User className="w-3 h-3" />
                  <span>{item.username}</span>
                  <span className="text-zinc-600">|</span>
                  <Clock className="w-3 h-3" />
                  <span>{formatTime(item.createdAt)}</span>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-muted" />
                  <span className="text-sm text-primary font-medium truncate">
                    {item.transactionDescription}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-semibold ml-auto shrink-0',
                      item.transactionAmount < 0 ? 'text-red-400' : 'text-emerald-400',
                    )}
                  >
                    {formatCurrency(item.transactionAmount)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] mb-3">
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
                    Original
                  </p>
                  <p className="text-sm text-secondary">{item.originalValue}</p>
                </div>
                <div className="text-zinc-600">
                  <ChevronRight className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
                    Suggested
                  </p>
                  <p className="text-sm text-cba-gold font-medium">{item.suggestedValue}</p>
                </div>
              </div>

              {item.userComment && (
                <div className="mb-3 p-3 rounded-lg bg-white/[0.01] border border-border/50">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
                    User Comment
                  </p>
                  <p className="text-sm text-secondary italic">"{item.userComment}"</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewTransaction?.(item.transactionId)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>

                {item.status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                      disabled={processingId === item.id}
                      onClick={() => handleApprove(item.id)}
                    >
                      <ThumbsUp className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                      disabled={processingId === item.id}
                      onClick={() => handleReject(item.id)}
                    >
                      <ThumbsDown className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </>
                )}

                {item.status === 'approved' && (
                  <Button
                    size="sm"
                    className="ml-auto"
                    onClick={() => onApplyCorrection?.(item.id)}
                  >
                    Apply Correction
                  </Button>
                )}
              </div>
            </div>
          ))}

          {paginatedFeedback.length === 0 && (
            <div className="py-12 text-center text-muted">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No feedback items found</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="relative flex items-center justify-between mt-6 pt-4 border-t border-border/50">
            <p className="text-sm text-muted">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredFeedback.length)} of{' '}
              {filteredFeedback.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-secondary">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
