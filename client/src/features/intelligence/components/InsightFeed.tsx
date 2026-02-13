import { useState, useEffect } from 'react';
import { Lightbulb, Zap, AlertCircle, Brain, Eye, CheckCircle, X, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { intelligenceApi } from '../../../api';
import { cn } from '../../../lib/utils';

interface InsightFeedProps {
  userId: string;
  dateRange?: { start: string; end: string };
}

interface Insight {
  id: string;
  type: string;
  severity: 'info' | 'suggestion' | 'warning' | 'critical';
  title: string;
  description: string;
  sourceModules: string[];
  confidence: number;
  status: 'new' | 'viewed' | 'acted_on' | 'dismissed';
  createdAt: string;
}

const severityConfig = {
  info: { icon: Lightbulb, color: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  suggestion: { icon: Zap, color: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  warning: { icon: AlertCircle, color: 'border-yellow-500', bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  critical: { icon: Brain, color: 'border-red-500', bg: 'bg-red-500/10', text: 'text-red-400' },
};

const statusStyles: Record<string, string> = {
  new: 'bg-[#FFCC00]/20 text-[#FFCC00] animate-pulse',
  viewed: 'bg-zinc-700/50 text-zinc-400',
  acted_on: 'bg-emerald-500/20 text-emerald-400',
  dismissed: 'bg-zinc-800/50 text-zinc-600 line-through',
};

export function InsightFeed({ userId, dateRange }: InsightFeedProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    severity: '' as string,
    status: '' as string,
    minConfidence: 0,
  });

  useEffect(() => {
    loadInsights();
  }, [userId, dateRange, filters]);

  const loadInsights = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (dateRange?.start) params.startDate = dateRange.start;
      if (dateRange?.end) params.endDate = dateRange.end;
      if (filters.severity) params.severity = filters.severity;
      if (filters.status) params.status = filters.status;
      if (filters.minConfidence > 0) params.minConfidence = String(filters.minConfidence);
      const data = await intelligenceApi.listInsights(userId, params);
      setInsights(Array.isArray(data) ? data : data.insights ?? []);
      setError(null);
    } catch (e) {
      setError('Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (insightId: string, status: string) => {
    try {
      await intelligenceApi.updateInsightStatus(insightId, status);
      setInsights(prev => prev.map(i => i.id === insightId ? { ...i, status: status as Insight['status'] } : i));
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-[#FFCC00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="neu-raised p-4 rounded-lg text-red-400 text-center">{error}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters Toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-[#FFCC00] transition-colors"
      >
        <Filter className="w-4 h-4" />
        Filters
        {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showFilters && (
        <div className="neu-inset p-4 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={filters.severity}
            onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
          >
            <option value="">All Severities</option>
            <option value="info">Info</option>
            <option value="suggestion">Suggestion</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="viewed">Viewed</option>
            <option value="acted_on">Acted On</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Min Confidence:</span>
            <input
              type="range"
              min={0}
              max={100}
              value={filters.minConfidence}
              onChange={e => setFilters(f => ({ ...f, minConfidence: Number(e.target.value) }))}
              className="flex-1 accent-[#FFCC00]"
            />
            <span className="text-xs text-zinc-400 w-8">{filters.minConfidence}%</span>
          </div>
        </div>
      )}

      {/* Insight Cards */}
      {insights.length === 0 ? (
        <div className="neu-raised p-8 rounded-lg text-center text-zinc-500">
          <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No insights found. Run a scan to discover new insights.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map(insight => {
            const config = severityConfig[insight.severity] || severityConfig.info;
            const Icon = config.icon;
            const isExpanded = expandedId === insight.id;

            return (
              <div
                key={insight.id}
                className={cn(
                  'neu-raised rounded-lg overflow-hidden border-l-4 transition-all',
                  config.color
                )}
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : insight.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('p-2 rounded-lg shrink-0', config.bg)}>
                      <Icon className={cn('w-5 h-5', config.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-zinc-100 truncate">{insight.title}</h4>
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', statusStyles[insight.status])}>
                          {insight.status.replace('_', ' ')}
                        </span>
                      </div>
                      {/* Source modules */}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {insight.sourceModules?.map(mod => (
                          <span key={mod} className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700">
                            {mod}
                          </span>
                        ))}
                      </div>
                      {/* Confidence bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#FFCC00] rounded-full transition-all"
                            style={{ width: `${insight.confidence}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">{insight.confidence}%</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/5">
                    <p className="text-sm text-zinc-400 mt-3 leading-relaxed">{insight.description}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => updateStatus(insight.id, 'viewed')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Mark Viewed
                      </button>
                      <button
                        onClick={() => updateStatus(insight.id, 'acted_on')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Act On
                      </button>
                      <button
                        onClick={() => updateStatus(insight.id, 'dismissed')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
