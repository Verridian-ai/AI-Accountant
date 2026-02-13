import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/api';

interface AuditEntry {
  id: string;
  mutation_id: string | null;
  session_id: string | null;
  agent_type: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  before_state: string | null;
  after_state: string | null;
  metadata: string | null;
  user_id: string | null;
  created_at: string;
}

interface AuditTrailViewerProps {
  mutationId?: string;
  agentType?: string;
}

const ACTION_COLORS: Record<string, string> = {
  mutation_proposed: 'text-yellow-400 bg-yellow-400/10',
  mutation_confirmed: 'text-emerald-400 bg-emerald-400/10',
  mutation_rejected: 'text-red-400 bg-red-400/10',
  mutation_executed: 'text-emerald-400 bg-emerald-400/10',
  mutation_failed: 'text-red-400 bg-red-400/10',
  mutation_expired: 'text-zinc-500 bg-zinc-500/10',
  query_executed: 'text-blue-400 bg-blue-400/10',
  tool_called: 'text-violet-400 bg-violet-400/10',
  error_occurred: 'text-red-400 bg-red-400/10',
};

const ACTION_OPTIONS = [
  'mutation_proposed',
  'mutation_confirmed',
  'mutation_rejected',
  'mutation_executed',
  'mutation_failed',
  'mutation_expired',
  'query_executed',
  'tool_called',
  'error_occurred',
];

/**
 * Agent audit log viewer with filtering by agent, action, date range.
 * Expandable rows show before/after JSON state for mutations.
 */
export function AuditTrailViewer({ mutationId, agentType: propAgentType }: AuditTrailViewerProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Filters
  const [filterAgentType, setFilterAgentType] = useState(propAgentType ?? '');
  const [filterAction, setFilterAction] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [limit] = useState(50);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const opts: Parameters<typeof api.fetchAuditLog>[0] = { limit };
      if (filterAgentType) opts!.agentType = filterAgentType;
      if (filterAction) opts!.action = filterAction;
      if (filterFrom) opts!.from = filterFrom;
      if (filterTo) opts!.to = filterTo;

      const result = await api.fetchAuditLog(opts);
      setEntries(result.entries as AuditEntry[]);
      setTotal(result.total);
    } catch (err) {
      console.error('[AuditTrailViewer] Failed to fetch entries:', err);
    } finally {
      setLoading(false);
    }
  }, [filterAgentType, filterAction, filterFrom, filterTo, limit]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setFilterAgentType(propAgentType ?? '');
    setFilterAction('');
    setFilterFrom('');
    setFilterTo('');
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  };

  const hasActiveFilters = filterAgentType || filterAction || filterFrom || filterTo;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-zinc-300 uppercase tracking-widest">
          {mutationId ? 'Mutation Audit Trail' : 'Agent Audit Log'}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'neu-raised-sm p-1.5 rounded-lg transition-colors',
              showFilters ? 'text-[#FFCC00]' : 'text-zinc-500 hover:text-zinc-300',
            )}
            aria-label="Toggle filters"
          >
            <Filter className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={fetchEntries}
            disabled={loading}
            className="neu-raised-sm p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-30"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="neu-inset rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[7px] font-black text-zinc-500 uppercase tracking-wider block mb-1">
                Agent Type
              </label>
              <input
                className="w-full neu-inset rounded-lg px-2 py-1.5 text-[9px] text-zinc-300 placeholder-zinc-700 font-bold bg-transparent outline-none focus-gold"
                placeholder="e.g. transaction_categorizer"
                value={filterAgentType}
                onChange={(e) => setFilterAgentType(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[7px] font-black text-zinc-500 uppercase tracking-wider block mb-1">
                Action
              </label>
              <select
                className="w-full neu-inset rounded-lg px-2 py-1.5 text-[9px] text-zinc-300 font-bold bg-transparent outline-none"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
              >
                <option value="">All actions</option>
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[7px] font-black text-zinc-500 uppercase tracking-wider block mb-1">
                From
              </label>
              <input
                type="date"
                className="w-full neu-inset rounded-lg px-2 py-1.5 text-[9px] text-zinc-300 font-bold bg-transparent outline-none"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[7px] font-black text-zinc-500 uppercase tracking-wider block mb-1">
                To
              </label>
              <input
                type="date"
                className="w-full neu-inset rounded-lg px-2 py-1.5 text-[9px] text-zinc-300 font-bold bg-transparent outline-none"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[8px] font-bold text-[#FFCC00]/70 hover:text-[#FFCC00] transition-colors uppercase tracking-wider"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && entries.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 text-[#FFCC00] animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="neu-inset rounded-xl p-6 text-center">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            No audit entries found
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 text-[9px] font-bold text-[#FFCC00]/70 hover:text-[#FFCC00] transition-colors uppercase tracking-wider"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Entries table */}
      {entries.length > 0 && (
        <div className="space-y-1">
          {/* Table header */}
          <div className="neu-inset rounded-lg px-3 py-2 grid grid-cols-[80px_90px_100px_80px_1fr] gap-2 text-[7px] font-black text-zinc-500 uppercase tracking-wider">
            <span>Time</span>
            <span>Agent</span>
            <span>Action</span>
            <span>Table</span>
            <span>Details</span>
          </div>

          {/* Rows */}
          {entries.map((entry) => {
            const isExpanded = expandedIds.has(entry.id);
            const actionStyle = ACTION_COLORS[entry.action] ?? 'text-zinc-400 bg-zinc-400/10';
            const meta = entry.metadata ? safeParseJSON(entry.metadata) : null;

            return (
              <div key={entry.id} className="neu-raised rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpanded(entry.id)}
                  className="w-full px-3 py-2 grid grid-cols-[80px_90px_100px_80px_1fr] gap-2 items-center text-left hover:bg-white/2 transition-colors"
                >
                  <span className="text-[8px] font-bold text-zinc-500 truncate">
                    {formatTimestamp(entry.created_at)}
                  </span>
                  <span className="text-[8px] font-bold text-[#FFCC00]/70 truncate">
                    {entry.agent_type.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={cn(
                      'text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md inline-block truncate',
                      actionStyle,
                    )}
                  >
                    {entry.action.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[8px] font-bold text-zinc-500 truncate">
                    {entry.target_table ?? '—'}
                  </span>
                  <div className="flex items-center gap-1">
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-zinc-500 shrink-0" />
                    )}
                    <span className="text-[8px] font-medium text-zinc-400 truncate">
                      {(meta?.description ?? entry.target_id ?? 'View details') as React.ReactNode}
                    </span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-white/5">
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {entry.before_state && (
                        <div>
                          <span className="text-[7px] font-black text-zinc-500 uppercase tracking-wider block mb-1">
                            Before
                          </span>
                          <pre className="neu-inset rounded-lg p-2 text-[8px] text-red-400/70 font-mono overflow-x-auto max-h-32 overflow-y-auto">
                            {formatJSON(entry.before_state)}
                          </pre>
                        </div>
                      )}
                      {entry.after_state && (
                        <div>
                          <span className="text-[7px] font-black text-zinc-500 uppercase tracking-wider block mb-1">
                            After
                          </span>
                          <pre className="neu-inset rounded-lg p-2 text-[8px] text-emerald-400/70 font-mono overflow-x-auto max-h-32 overflow-y-auto">
                            {formatJSON(entry.after_state)}
                          </pre>
                        </div>
                      )}
                    </div>
                    {meta && (
                      <div>
                        <span className="text-[7px] font-black text-zinc-500 uppercase tracking-wider block mb-1">
                          Metadata
                        </span>
                        <pre className="neu-inset rounded-lg p-2 text-[8px] text-zinc-400 font-mono overflow-x-auto max-h-24 overflow-y-auto">
                          {JSON.stringify(meta, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[7px] text-zinc-600">
                      <span>ID: {entry.id.slice(0, 8)}...</span>
                      {entry.session_id && <span>Session: {entry.session_id.slice(0, 8)}...</span>}
                      {entry.mutation_id && (
                        <span>Mutation: {entry.mutation_id.slice(0, 8)}...</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Load more / total */}
          <div className="flex items-center justify-between px-2 pt-1">
            <span className="text-[7px] font-black text-zinc-600 uppercase tracking-wider">
              Showing {entries.length} of {total}
            </span>
            {entries.length < total && (
              <button
                type="button"
                onClick={fetchEntries}
                className="text-[8px] font-bold text-[#FFCC00]/70 hover:text-[#FFCC00] transition-colors uppercase tracking-wider"
              >
                Load more
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function safeParseJSON(str: string): Record<string, unknown> | null {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function formatJSON(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
