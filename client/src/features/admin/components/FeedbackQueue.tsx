import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    AlertCircle,
    Search,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    ThumbsUp,
    ThumbsDown,
    Edit3,
    Eye,
    Clock,
    User,
    FileText,
    Tag,
} from 'lucide-react';

// Types
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

interface FeedbackQueueProps {
    onApproveFeedback?: (id: string) => Promise<void>;
    onRejectFeedback?: (id: string, reason?: string) => Promise<void>;
    onApplyCorrection?: (id: string) => Promise<void>;
    onViewTransaction?: (transactionId: string) => void;
    className?: string;
}

// Mock data
const mockFeedback: FeedbackItem[] = [
    {
        id: 'f1',
        userId: 'u1',
        username: 'john.doe',
        transactionId: 't1',
        transactionDescription: 'WOOLWORTHS 1234 SYDNEY',
        transactionAmount: -8750,
        feedbackType: 'category_correction',
        originalValue: 'Shopping',
        suggestedValue: 'Groceries',
        userComment: 'This should be Groceries, not general Shopping',
        status: 'pending',
        createdAt: '2024-01-28T10:30:00Z',
    },
    {
        id: 'f2',
        userId: 'u2',
        username: 'jane.smith',
        transactionId: 't2',
        transactionDescription: 'OFFICE SUPPLIES CO',
        transactionAmount: -24500,
        feedbackType: 'gst_correction',
        originalValue: 'No GST',
        suggestedValue: 'GST Applicable',
        userComment: 'Office supplies include GST',
        status: 'pending',
        createdAt: '2024-01-28T09:15:00Z',
    },
    {
        id: 'f3',
        userId: 'u1',
        username: 'john.doe',
        transactionId: 't3',
        transactionDescription: 'UBER *EATS SYDNEY AU',
        transactionAmount: -3250,
        feedbackType: 'category_correction',
        originalValue: 'Transport',
        suggestedValue: 'Food & Dining',
        status: 'approved',
        createdAt: '2024-01-27T16:45:00Z',
        reviewedAt: '2024-01-27T18:00:00Z',
        reviewedBy: 'admin',
    },
    {
        id: 'f4',
        userId: 'u3',
        username: 'bob.wilson',
        transactionId: 't4',
        transactionDescription: 'INTEREST CHARGE',
        transactionAmount: -1523,
        feedbackType: 'parser_error',
        originalValue: 'Parsed as income',
        suggestedValue: 'Should be expense',
        userComment: 'Parser incorrectly identified this as income',
        status: 'pending',
        createdAt: '2024-01-28T08:00:00Z',
    },
    {
        id: 'f5',
        userId: 'u2',
        username: 'jane.smith',
        transactionId: 't5',
        transactionDescription: 'AMAZON AU MARKETPLACE',
        transactionAmount: -15999,
        feedbackType: 'category_correction',
        originalValue: 'Shopping',
        suggestedValue: 'Business Expense',
        userComment: 'This was a business purchase',
        status: 'rejected',
        createdAt: '2024-01-26T14:20:00Z',
        reviewedAt: '2024-01-27T10:00:00Z',
        reviewedBy: 'admin',
    },
];

export function FeedbackQueue({
    onApproveFeedback,
    onRejectFeedback,
    onApplyCorrection,
    onViewTransaction,
    className,
}: FeedbackQueueProps) {
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
            await new Promise((resolve) => setTimeout(resolve, 500));
            setFeedback(mockFeedback);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFeedback();
    }, [fetchFeedback]);

    // Filtering
    const filteredFeedback = feedback.filter((item) => {
        const matchesSearch =
            item.transactionDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.suggestedValue.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
        const matchesType = typeFilter === 'all' || item.feedbackType === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
    });

    // Pagination
    const totalPages = Math.ceil(filteredFeedback.length / itemsPerPage);
    const paginatedFeedback = filteredFeedback.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Stats
    const pendingCount = feedback.filter((f) => f.status === 'pending').length;
    const approvedCount = feedback.filter((f) => f.status === 'approved').length;
    const rejectedCount = feedback.filter((f) => f.status === 'rejected').length;

    const handleApprove = async (id: string) => {
        setProcessingId(id);
        try {
            await onApproveFeedback?.(id);
            setFeedback((prev) =>
                prev.map((f) =>
                    f.id === id
                        ? { ...f, status: 'approved', reviewedAt: new Date().toISOString() }
                        : f
                )
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
                    f.id === id
                        ? { ...f, status: 'rejected', reviewedAt: new Date().toISOString() }
                        : f
                )
            );
        } finally {
            setProcessingId(null);
        }
    };

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
        }).format(cents / 100);
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
    };

    const getFeedbackTypeBadge = (type: FeedbackItem['feedbackType']) => {
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
    };

    const getStatusBadge = (status: FeedbackItem['status']) => {
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
    };

    if (loading) {
        return <FeedbackQueueSkeleton className={className} />;
    }

    return (
        <div className={cn('space-y-6', className)}>
            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-4">
                <div
                    className={cn(
                        'neu-raised rounded-2xl p-4 border transition-all cursor-pointer',
                        statusFilter === 'pending'
                            ? 'border-amber-500/30 bg-amber-500/5'
                            : 'border-white/5 hover:border-white/10'
                    )}
                    onClick={() => setStatusFilter('pending')}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                            Pending Review
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
                </div>
                <div
                    className={cn(
                        'neu-raised rounded-2xl p-4 border transition-all cursor-pointer',
                        statusFilter === 'approved'
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-white/5 hover:border-white/10'
                    )}
                    onClick={() => setStatusFilter('approved')}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                            Approved
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400">{approvedCount}</p>
                </div>
                <div
                    className={cn(
                        'neu-raised rounded-2xl p-4 border transition-all cursor-pointer',
                        statusFilter === 'rejected'
                            ? 'border-red-500/30 bg-red-500/5'
                            : 'border-white/5 hover:border-white/10'
                    )}
                    onClick={() => setStatusFilter('rejected')}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                            Rejected
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-red-400">{rejectedCount}</p>
                </div>
            </div>

            {/* Main Queue */}
            <div className="neu-raised rounded-[2rem] p-6 relative overflow-hidden border border-white/5">
                <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />

                {/* Header */}
                <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="neu-inset p-3 rounded-xl border border-white/5">
                            <MessageSquare className="w-5 h-5 text-[#FFCC00]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-zinc-100">Feedback Queue</h3>
                            <p className="text-xs text-zinc-500">
                                User corrections and parser feedback
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={fetchFeedback}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>

                {/* Filters */}
                <div className="relative flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <Input
                            placeholder="Search feedback..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-white/5 border-white/10 rounded-xl"
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
                                    ? 'bg-white/[0.02] border-white/10'
                                    : 'bg-white/[0.01] border-white/5'
                            )}
                        >
                            {/* Header Row */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {getFeedbackTypeBadge(item.feedbackType)}
                                    {getStatusBadge(item.status)}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                    <User className="w-3 h-3" />
                                    <span>{item.username}</span>
                                    <span className="text-zinc-600">|</span>
                                    <Clock className="w-3 h-3" />
                                    <span>{formatTime(item.createdAt)}</span>
                                </div>
                            </div>

                            {/* Transaction Info */}
                            <div className="mb-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <FileText className="w-4 h-4 text-zinc-500" />
                                    <span className="text-sm text-zinc-300 font-medium truncate">
                                        {item.transactionDescription}
                                    </span>
                                    <span
                                        className={cn(
                                            'text-sm font-semibold ml-auto shrink-0',
                                            item.transactionAmount < 0
                                                ? 'text-red-400'
                                                : 'text-emerald-400'
                                        )}
                                    >
                                        {formatCurrency(item.transactionAmount)}
                                    </span>
                                </div>
                            </div>

                            {/* Correction Details */}
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] mb-3">
                                <div className="flex-1">
                                    <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
                                        Original
                                    </p>
                                    <p className="text-sm text-zinc-400">{item.originalValue}</p>
                                </div>
                                <div className="text-zinc-600">
                                    <ChevronRight className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
                                        Suggested
                                    </p>
                                    <p className="text-sm text-[#FFCC00] font-medium">
                                        {item.suggestedValue}
                                    </p>
                                </div>
                            </div>

                            {/* User Comment */}
                            {item.userComment && (
                                <div className="mb-3 p-3 rounded-lg bg-white/[0.01] border border-white/5">
                                    <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
                                        User Comment
                                    </p>
                                    <p className="text-sm text-zinc-400 italic">
                                        "{item.userComment}"
                                    </p>
                                </div>
                            )}

                            {/* Actions */}
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
                        <div className="py-12 text-center text-zinc-500">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No feedback items found</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="relative flex items-center justify-between mt-6 pt-4 border-t border-white/5">
                        <p className="text-sm text-zinc-500">
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
                            <span className="text-sm text-zinc-400">
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

function FeedbackQueueSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn('space-y-6', className)}>
            <div className="grid grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="neu-raised rounded-2xl p-4 border border-white/5">
                        <Skeleton className="w-24 h-3 rounded mb-2" />
                        <Skeleton className="w-12 h-8 rounded" />
                    </div>
                ))}
            </div>
            <div className="neu-raised rounded-[2rem] p-6 border border-white/5">
                <div className="flex items-center gap-3 mb-6">
                    <Skeleton className="w-11 h-11 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="w-32 h-5 rounded" />
                        <Skeleton className="w-48 h-3 rounded" />
                    </div>
                </div>
                <div className="flex gap-3 mb-6">
                    <Skeleton className="flex-1 h-10 rounded-xl" />
                    <Skeleton className="w-[150px] h-10 rounded-xl" />
                    <Skeleton className="w-[140px] h-10 rounded-xl" />
                </div>
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="w-full h-40 rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}
