import { useState, useEffect } from 'react';
import { fetchActivityLog, fetchActivitySummary } from '../../../api';
import { ScrollText, Filter, RefreshCw, BarChart3 } from 'lucide-react';

interface ActivityEntry {
  id: string;
  userId?: string;
  username?: string;
  action: string;
  resource: string;
  resourceId?: string;
  status: string;
  ipAddress?: string;
  timestamp: string;
  details?: string;
}

interface ActivitySummaryData {
  totalActions: number;
  uniqueUsers: number;
  actionBreakdown: Record<string, number>;
  dailyCounts: Array<{ date: string; count: number }>;
}

export function ActivityLog() {
  const [logs, setLogs] = useState<ActivityEntry[]>([]);
  const [summary, setSummary] = useState<ActivitySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ action: '', status: '' });
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '30', offset: '0' };
      if (filters.action) params.action = filters.action;
      if (filters.status) params.status = filters.status;
      const res = await fetchActivityLog(params);
      setLogs(Array.isArray(res) ? res : res?.logs || []);
      setPage(0);
    } catch {
      /* */
    }
    setLoading(false);
  };

  const loadSummary = async () => {
    try {
      const res = await fetchActivitySummary(undefined, 30);
      setSummary(res);
      setShowSummary(true);
    } catch {
      /* */
    }
  };

  const loadMore = async () => {
    const nextPage = page + 1;
    try {
      const params: Record<string, string> = { limit: '30', offset: String(nextPage * 30) };
      if (filters.action) params.action = filters.action;
      if (filters.status) params.status = filters.status;
      const res = await fetchActivityLog(params);
      const list = Array.isArray(res) ? res : res?.logs || [];
      setLogs((prev) => [...prev, ...list]);
      setPage(nextPage);
    } catch {
      /* */
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'success':
        return 'bg-emerald-500/10 text-emerald-400';
      case 'error':
      case 'failed':
        return 'bg-red-500/10 text-red-400';
      case 'warning':
        return 'bg-yellow-500/10 text-yellow-400';
      default:
        return 'bg-zinc-500/10 text-zinc-400';
    }
  };

  const maxDailyCount = summary?.dailyCounts?.reduce((m, d) => Math.max(m, d.count), 0) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Activity Log</h2>
          <p className="text-sm text-zinc-500">Admin and system activity audit trail</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSummary}
            className="px-3 py-2 rounded-lg bg-[#16213e] text-zinc-400 hover:text-[#FFCC00] text-sm flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" /> Summary
          </button>
          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl bg-[#16213e] text-zinc-400 hover:text-[#FFCC00]"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-zinc-500" />
        <select
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          className="px-3 py-1.5 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFCC00]/50"
        >
          <option value="">All Actions</option>
          <option value="login">Login</option>
          <option value="logout">Logout</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="px-3 py-1.5 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFCC00]/50"
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
        </select>
        <button
          type="button"
          onClick={loadData}
          className="px-3 py-1.5 bg-[#FFCC00] text-[#1a1a2e] rounded-lg text-xs font-bold"
        >
          Apply
        </button>
      </div>

      {/* Summary Panel */}
      {showSummary && summary && (
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">30-Day Summary</h3>
            <button
              type="button"
              onClick={() => setShowSummary(false)}
              className="text-xs text-zinc-500 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#1a1a2e] p-3 text-center">
              <p className="text-2xl font-bold text-white">{summary.totalActions}</p>
              <p className="text-[10px] text-zinc-500">Total Actions</p>
            </div>
            <div className="rounded-xl bg-[#1a1a2e] p-3 text-center">
              <p className="text-2xl font-bold text-white">{summary.uniqueUsers}</p>
              <p className="text-[10px] text-zinc-500">Unique Users</p>
            </div>
          </div>
          {summary.dailyCounts && summary.dailyCounts.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 mb-2">Daily Activity</p>
              <div className="flex items-end gap-px h-20">
                {summary.dailyCounts.map((d, i) => (
                  <div key={i} className="flex-1 group relative">
                    <div
                      className="w-full bg-[#FFCC00]/60 hover:bg-[#FFCC00] rounded-t transition-all"
                      style={{ height: `${Math.max((d.count / maxDailyCount) * 100, 2)}%` }}
                    />
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#0a0a1a] text-xs text-white px-1.5 py-0.5 rounded z-10 whitespace-nowrap">
                      {d.date?.slice(5)}: {d.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity Table */}
      <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
        {loading ? (
          <div className="animate-pulse h-32 rounded-xl bg-[#1a1a2e]" />
        ) : (
          <div className="space-y-2">
            {logs.map((entry, i) => (
              <div
                key={entry.id || i}
                className="flex items-center justify-between py-3 px-4 rounded-xl bg-[#1a1a2e]/50 hover:bg-[#1a1a2e] transition-colors text-xs"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <ScrollText className="w-4 h-4 text-zinc-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-300 truncate">{entry.action}</p>
                    <p className="text-zinc-500 truncate">
                      {entry.resource}
                      {entry.resourceId ? ` #${entry.resourceId}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  {entry.username && <span className="text-zinc-400">{entry.username}</span>}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusColor(entry.status)}`}
                  >
                    {entry.status}
                  </span>
                  <span className="text-zinc-600 w-32 text-right">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-8">No activity found</p>
            )}
          </div>
        )}
        {logs.length >= 30 && (
          <button
            type="button"
            onClick={loadMore}
            className="mt-4 w-full py-2 text-sm text-[#FFCC00] hover:bg-[#FFCC00]/5 rounded-lg"
          >
            Load More
          </button>
        )}
      </div>
    </div>
  );
}
