import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { knowledgeApi } from '../../../api';

interface FeedbackPanelProps {
  userId: string;
}

interface FeedbackStats {
  totalCount: number;
  accuracyRate: number;
  trend: 'up' | 'down' | 'stable';
  byType: Record<string, number>;
  recent: Array<{
    id: string;
    entityId: string;
    entityType: string;
    feedbackType: string;
    details: string;
    createdAt: string;
  }>;
}

const FEEDBACK_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  positive: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  negative: { bg: 'bg-red-500/10', text: 'text-red-400' },
  correction: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  suggestion: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
};

export function FeedbackPanel({ userId }: FeedbackPanelProps) {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memifying, setMemifying] = useState(false);
  const [memifyResult, setMemifyResult] = useState<string | null>(null);

  const loadStats = () => {
    setLoading(true);
    setError(null);
    knowledgeApi
      .feedbackStats(userId)
      .then(setStats)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStats();
  }, [userId]);

  const handleMemify = async () => {
    setMemifying(true);
    setMemifyResult(null);
    try {
      const result = await knowledgeApi.triggerMemify(userId, {
        minFeedbackCount: 3,
        forceRun: false,
      });
      setMemifyResult(result.message || 'Memify triggered successfully');
      loadStats();
    } catch (e: any) {
      setMemifyResult(`Error: ${e.message}`);
    } finally {
      setMemifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="neu-inset rounded-xl p-6 text-center">
        <p className="text-sm text-red-400">Failed to load feedback: {error}</p>
        <button
          type="button"
          onClick={loadStats}
          className="mt-3 text-xs text-[#FFCC00] hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const TrendIcon =
    stats?.trend === 'up' ? TrendingUp : stats?.trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    stats?.trend === 'up'
      ? 'text-emerald-400'
      : stats?.trend === 'down'
        ? 'text-red-400'
        : 'text-zinc-400';

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="neu-raised rounded-xl p-4 text-center">
          <MessageSquare className="w-5 h-5 mx-auto mb-2 text-[#FFCC00]" />
          <p className="text-2xl font-bold text-zinc-100">{stats?.totalCount ?? 0}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Total Feedback
          </p>
        </div>
        <div className="neu-raised rounded-xl p-4 text-center">
          <div className="w-5 h-5 mx-auto mb-2 text-emerald-400 font-bold text-lg">%</div>
          <p className="text-2xl font-bold text-zinc-100">
            {((stats?.accuracyRate ?? 0) * 100).toFixed(1)}%
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Accuracy Rate
          </p>
        </div>
        <div className="neu-raised rounded-xl p-4 text-center">
          <TrendIcon className={`w-5 h-5 mx-auto mb-2 ${trendColor}`} />
          <p className={`text-2xl font-bold ${trendColor}`}>{stats?.trend ?? 'N/A'}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Trend</p>
        </div>
      </div>

      {/* Memify Action */}
      <div className="neu-raised rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#FFCC00]" /> Trigger Memify
            </h4>
            <p className="text-xs text-zinc-500 mt-1">
              Consolidate feedback into knowledge graph improvements
            </p>
          </div>
          <button
            type="button"
            onClick={handleMemify}
            disabled={memifying}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFCC00]/90 disabled:opacity-50 transition-colors"
          >
            {memifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {memifying ? 'Processing...' : 'Run Memify'}
          </button>
        </div>
        {memifyResult && (
          <p
            className={`mt-3 text-xs ${memifyResult.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}
          >
            {memifyResult}
          </p>
        )}
      </div>

      {/* Feedback by Type */}
      {stats?.byType && Object.keys(stats.byType).length > 0 && (
        <div className="neu-raised rounded-xl p-4">
          <h4 className="text-sm font-bold text-zinc-200 mb-3">By Type</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(stats.byType).map(([type, count]) => {
              const colors = FEEDBACK_TYPE_COLORS[type] ?? {
                bg: 'bg-white/5',
                text: 'text-zinc-400',
              };
              return (
                <div key={type} className={`${colors.bg} rounded-lg p-3 text-center`}>
                  <p className={`text-lg font-bold ${colors.text}`}>{count}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {type}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Feedback */}
      <div className="neu-raised rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-zinc-200">Recent Feedback</h4>
          <button
            type="button"
            onClick={loadStats}
            className="text-zinc-400 hover:text-[#FFCC00] transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {(stats?.recent ?? []).length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-4">No feedback yet</p>
          ) : (
            stats!.recent.map((item) => {
              const colors = FEEDBACK_TYPE_COLORS[item.feedbackType] ?? {
                bg: 'bg-white/5',
                text: 'text-zinc-400',
              };
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0"
                >
                  <span
                    className={`shrink-0 mt-0.5 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${colors.bg} ${colors.text}`}
                  >
                    {item.feedbackType}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-300 truncate">
                      {item.details || `Feedback on ${item.entityType}`}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
