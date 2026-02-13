import { useState, useEffect } from 'react';
import { GitCompareArrows, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { reconApi } from '@/api';
import { cn } from '@/lib/utils';

interface ReconSummaryCardProps {
  onNavigate?: () => void;
}

interface SessionSummary {
  id: string;
  status: string;
  matchedCount: number;
  unmatchedCount: number;
  createdAt: string;
  completedAt?: string;
  differenceAmount?: number;
}

export function ReconSummaryCard({ onNavigate }: ReconSummaryCardProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await reconApi.listSessions();
      setSessions(Array.isArray(data) ? data : (data.sessions ?? []));
    } catch {
      // Silently handle — summary card is non-critical
    } finally {
      setLoading(false);
    }
  };

  const openSessions = sessions.filter((s) => s.status !== 'completed');
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  const totalMatched = sessions.reduce((sum, s) => sum + (s.matchedCount ?? 0), 0);
  const totalAll = sessions.reduce(
    (sum, s) => sum + (s.matchedCount ?? 0) + (s.unmatchedCount ?? 0),
    0,
  );
  const matchPercent = totalAll > 0 ? Math.round((totalMatched / totalAll) * 100) : 0;

  const totalDiscrepancy = sessions.reduce((sum, s) => sum + Math.abs(s.differenceAmount ?? 0), 0);

  const lastCompletedDate = completedSessions
    .map((s) => s.completedAt ?? s.createdAt)
    .sort()
    .pop();

  const hasStaleSession = openSessions.some((s) => {
    const created = new Date(s.createdAt);
    const daysSince = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 7;
  });

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

  if (loading) {
    return (
      <div className="neu-raised rounded-2xl p-5 animate-pulse border border-white/5">
        <div className="h-4 w-32 bg-zinc-800 rounded mb-4" />
        <div className="h-8 w-24 bg-zinc-800 rounded mb-2" />
        <div className="h-3 w-40 bg-zinc-800 rounded" />
      </div>
    );
  }

  return (
    <div
      className="neu-raised rounded-2xl p-5 border border-white/5 group relative overflow-hidden cursor-pointer hover:border-[#FFCC00]/20 transition-colors"
      onClick={onNavigate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onNavigate?.()}
    >
      {/* Glow on hover */}
      <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[60px] bg-[#FFCC00] opacity-0 group-hover:opacity-20 transition-opacity duration-500" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="neu-inset p-2 rounded-xl">
              <GitCompareArrows className="h-4 w-4 text-[#FFCC00]" />
            </div>
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">
              Bank Reconciliation
            </span>
          </div>
          {hasStaleSession && (
            <div className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold">Stale</span>
            </div>
          )}
        </div>

        {/* Match percentage */}
        <div className="mb-3">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-2xl font-black text-gradient-gold">{matchPercent}%</span>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Matched
            </span>
          </div>
          {/* Mini progress bar */}
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                matchPercent >= 90
                  ? 'bg-emerald-500'
                  : matchPercent >= 70
                    ? 'bg-[#FFCC00]'
                    : 'bg-amber-500',
              )}
              style={{ width: `${matchPercent}%` }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-zinc-400 mb-1">
              <Clock className="h-3 w-3" />
            </div>
            <p className="text-sm font-bold text-zinc-200">{openSessions.length}</p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold">Open</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-emerald-400 mb-1">
              <CheckCircle2 className="h-3 w-3" />
            </div>
            <p className="text-sm font-bold text-zinc-200">{completedSessions.length}</p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold">Done</p>
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-200 mt-4">
              {totalDiscrepancy > 0 ? formatCurrency(totalDiscrepancy) : '$0.00'}
            </p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold">Diff</p>
          </div>
        </div>

        {/* Last reconciled */}
        {lastCompletedDate && (
          <p className="text-[10px] text-zinc-600 mt-3 text-center">
            Last reconciled: {new Date(lastCompletedDate).toLocaleDateString('en-AU')}
          </p>
        )}
      </div>
    </div>
  );
}
