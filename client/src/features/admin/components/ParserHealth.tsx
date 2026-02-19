import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileCheck,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Building2,
} from 'lucide-react';

// Types
export interface BankParserStats {
  bankId: string;
  bankName: string;
  totalParsed: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgProcessingTime: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  recentErrors: ParserError[];
}

export interface ParserError {
  id: string;
  statementId: string;
  filename: string;
  errorType: string;
  errorMessage: string;
  timestamp: string;
  resolved: boolean;
}

export interface OverallStats {
  totalStatements: number;
  successRate: number;
  avgProcessingTime: number;
  errorsToday: number;
  pendingReview: number;
}

interface ParserHealthProps {
  onRetryParsing?: (statementId: string) => Promise<void>;
  onViewError?: (error: ParserError) => void;
  onExportErrors?: (format: 'csv' | 'json') => void;
  className?: string;
}

// Mock data
const mockBankStats: BankParserStats[] = [
  {
    bankId: 'cba',
    bankName: 'Commonwealth Bank',
    totalParsed: 2847,
    successCount: 2789,
    failureCount: 58,
    successRate: 97.96,
    avgProcessingTime: 2.3,
    trend: 'up',
    trendValue: 1.2,
    recentErrors: [
      {
        id: 'e1',
        statementId: 's1',
        filename: 'CBA_Statement_Jan2024.pdf',
        errorType: 'PDF_READ_ERROR',
        errorMessage: 'Unable to extract text from scanned PDF',
        timestamp: '2024-01-28T10:30:00Z',
        resolved: false,
      },
      {
        id: 'e2',
        statementId: 's2',
        filename: 'CBA_Statement_Dec2023.pdf',
        errorType: 'AI_PARSE_ERROR',
        errorMessage: 'Transaction date format not recognized',
        timestamp: '2024-01-27T15:45:00Z',
        resolved: true,
      },
    ],
  },
  {
    bankId: 'anz',
    bankName: 'ANZ Bank',
    totalParsed: 1523,
    successCount: 1445,
    failureCount: 78,
    successRate: 94.88,
    avgProcessingTime: 2.8,
    trend: 'down',
    trendValue: -2.1,
    recentErrors: [
      {
        id: 'e3',
        statementId: 's3',
        filename: 'ANZ_Statement_Jan2024.pdf',
        errorType: 'EMPTY_STATEMENT',
        errorMessage: 'No transactions found in statement',
        timestamp: '2024-01-28T09:15:00Z',
        resolved: false,
      },
    ],
  },
  {
    bankId: 'westpac',
    bankName: 'Westpac',
    totalParsed: 892,
    successCount: 856,
    failureCount: 36,
    successRate: 95.96,
    avgProcessingTime: 2.5,
    trend: 'stable',
    trendValue: 0.3,
    recentErrors: [],
  },
  {
    bankId: 'nab',
    bankName: 'NAB',
    totalParsed: 634,
    successCount: 598,
    failureCount: 36,
    successRate: 94.32,
    avgProcessingTime: 3.1,
    trend: 'up',
    trendValue: 2.8,
    recentErrors: [
      {
        id: 'e4',
        statementId: 's4',
        filename: 'NAB_Statement_Jan2024.pdf',
        errorType: 'CRITICAL_ERROR',
        errorMessage: 'Unexpected format change detected',
        timestamp: '2024-01-28T08:00:00Z',
        resolved: false,
      },
    ],
  },
];

const mockOverallStats: OverallStats = {
  totalStatements: 5896,
  successRate: 96.12,
  avgProcessingTime: 2.6,
  errorsToday: 12,
  pendingReview: 8,
};

export function ParserHealth({
  onRetryParsing,
  onViewError,
  onExportErrors,
  className,
}: ParserHealthProps) {
  const [fetchState, setFetchState] = useState<{
    bankStats: BankParserStats[];
    overallStats: OverallStats | null;
    loading: boolean;
  }>({ bankStats: [], overallStats: null, loading: true });
  const { bankStats, overallStats, loading } = fetchState;
  const [expandedBank, setExpandedBank] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setFetchState((s) => ({ ...s, loading: true }));
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setFetchState({ bankStats: mockBankStats, overallStats: mockOverallStats, loading: false });
    } catch {
      setFetchState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, timeRange]);

  const handleRetry = async (statementId: string) => {
    setRetryingId(statementId);
    try {
      await onRetryParsing?.(statementId);
    } finally {
      setRetryingId(null);
    }
  };

  const getErrorTypeBadge = (errorType: string) => {
    switch (errorType) {
      case 'PDF_READ_ERROR':
        return <Badge variant="warning">PDF Read Error</Badge>;
      case 'AI_PARSE_ERROR':
        return <Badge variant="secondary">AI Parse Error</Badge>;
      case 'EMPTY_STATEMENT':
        return <Badge variant="outline">Empty Statement</Badge>;
      case 'CRITICAL_ERROR':
        return <Badge variant="destructive">Critical Error</Badge>;
      default:
        return <Badge variant="outline">{errorType}</Badge>;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-AU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <ParserHealthSkeleton className={className} />;
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Overall Stats */}
      {overallStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="neu-raised rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <FileCheck className="w-4 h-4 text-[#FFCC00]" />
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Total Parsed
              </span>
            </div>
            <p className="text-2xl font-bold text-zinc-100">
              {overallStats.totalStatements.toLocaleString()}
            </p>
          </div>
          <div className="neu-raised rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Success Rate
              </span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">
              {overallStats.successRate.toFixed(1)}%
            </p>
          </div>
          <div className="neu-raised rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Avg Time
              </span>
            </div>
            <p className="text-2xl font-bold text-zinc-100">{overallStats.avgProcessingTime}s</p>
          </div>
          <div className="neu-raised rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Errors Today
              </span>
            </div>
            <p className="text-2xl font-bold text-amber-400">{overallStats.errorsToday}</p>
          </div>
          <div className="neu-raised rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-red-400" />
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Pending Review
              </span>
            </div>
            <p className="text-2xl font-bold text-red-400">{overallStats.pendingReview}</p>
          </div>
        </div>
      )}

      {/* Parser Health by Bank */}
      <div className="neu-raised rounded-[2rem] p-6 relative overflow-hidden border border-white/5">
        <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="neu-inset p-3 rounded-xl border border-white/5">
              <Building2 className="w-5 h-5 text-[#FFCC00]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100">Parser Health by Bank</h3>
              <p className="text-xs text-zinc-500">Success rates and error tracking</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => onExportErrors?.('csv')}>
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Bank List */}
        <div className="relative space-y-3">
          {bankStats.map((bank) => (
            <div
              key={bank.bankId}
              className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden"
            >
              {/* Bank Header */}
              <button
                className="w-full p-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpandedBank(expandedBank === bank.bankId ? null : bank.bankId)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {expandedBank === bank.bankId ? (
                    <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                  )}
                  <div className="text-left min-w-0">
                    <p className="font-semibold text-zinc-100 truncate">{bank.bankName}</p>
                    <p className="text-xs text-zinc-500">
                      {bank.totalParsed.toLocaleString()} statements
                    </p>
                  </div>
                </div>

                {/* Success Rate */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="hidden sm:block w-32">
                    <Progress value={bank.successRate} className="h-2" />
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'font-bold',
                        bank.successRate >= 95
                          ? 'text-emerald-400'
                          : bank.successRate >= 90
                            ? 'text-amber-400'
                            : 'text-red-400',
                      )}
                    >
                      {bank.successRate.toFixed(1)}%
                    </p>
                    <div className="flex items-center gap-1 text-xs">
                      {bank.trend === 'up' ? (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      ) : bank.trend === 'down' ? (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      ) : (
                        <span className="text-zinc-500">~</span>
                      )}
                      <span
                        className={cn(
                          bank.trend === 'up'
                            ? 'text-emerald-400'
                            : bank.trend === 'down'
                              ? 'text-red-400'
                              : 'text-zinc-500',
                        )}
                      >
                        {bank.trendValue > 0 ? '+' : ''}
                        {bank.trendValue}%
                      </span>
                    </div>
                  </div>
                  {bank.failureCount > 0 && (
                    <Badge variant="destructive" className="shrink-0">
                      {bank.failureCount} errors
                    </Badge>
                  )}
                </div>
              </button>

              {/* Expanded Error Details */}
              {expandedBank === bank.bankId && bank.recentErrors.length > 0 && (
                <div className="border-t border-white/5 p-4 bg-white/[0.01]">
                  <h4 className="text-sm font-semibold text-zinc-400 mb-3">Recent Errors</h4>
                  <div className="space-y-2">
                    {bank.recentErrors.map((error) => (
                      <div
                        key={error.id}
                        className={cn(
                          'p-3 rounded-lg border transition-colors',
                          error.resolved
                            ? 'bg-white/[0.01] border-white/5'
                            : 'bg-red-500/5 border-red-500/20',
                        )}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            {getErrorTypeBadge(error.errorType)}
                            {error.resolved && <Badge variant="success">Resolved</Badge>}
                          </div>
                          <span className="text-xs text-zinc-500">
                            {formatTime(error.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-300 mb-1">{error.filename}</p>
                        <p className="text-xs text-zinc-500 mb-3">{error.errorMessage}</p>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => onViewError?.(error)}>
                            View Details
                          </Button>
                          {!error.resolved && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={retryingId === error.statementId}
                              onClick={() => handleRetry(error.statementId)}
                            >
                              {retryingId === error.statementId ? (
                                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4 mr-1" />
                              )}
                              Retry
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {expandedBank === bank.bankId && bank.recentErrors.length === 0 && (
                <div className="border-t border-white/5 p-6 bg-white/[0.01] text-center">
                  <FileCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-zinc-400">No recent errors for this bank</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ParserHealthSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="neu-raised rounded-2xl p-4 border border-white/5">
            <Skeleton className="w-20 h-3 rounded mb-2" />
            <Skeleton className="w-16 h-8 rounded" />
          </div>
        ))}
      </div>
      <div className="neu-raised rounded-[2rem] p-6 border border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-11 h-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="w-40 h-5 rounded" />
            <Skeleton className="w-32 h-3 rounded" />
          </div>
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="w-full h-20 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
