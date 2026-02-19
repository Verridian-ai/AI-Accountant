/**
 * SessionHistory — Past streaming sessions list
 *
 * Fetches from GET /api/stream/history and displays sessions
 * with agent type, timestamp, duration, token count, and status.
 */

import { useState, useEffect, useCallback } from 'react';
import { BASE_URL, getAuthHeaders } from '../../../api';
import { Clock, Hash, Zap, AlertCircle, RefreshCw } from 'lucide-react';

const API_URL = `${BASE_URL}/api`;

interface StreamSessionRecord {
  id: string;
  agent_type: string;
  session_status: string;
  token_usage?: { totalTokens?: number };
  latency_ms?: number;
  created_at: string;
  model_id?: string;
}

export function SessionHistory() {
  const [sessions, setSessions] = useState<StreamSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/stream/history?userId=default&limit=50`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : (data.sessions ?? []));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const filtered = filter === 'all' ? sessions : sessions.filter((s) => s.agent_type === filter);

  const agentTypes = [...new Set(sessions.map((s) => s.agent_type))];

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-emerald-500/10 text-emerald-400',
      streaming: 'bg-cba-gold/10 text-cba-gold',
      errored: 'bg-red-500/10 text-red-400',
      pending: 'bg-zinc-500/10 text-secondary',
      cancelled: 'bg-orange-500/10 text-orange-400',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${colors[status] ?? colors.pending}`}
      >
        {status}
      </span>
    );
  };

  const formatAgent = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading sessions...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-zinc-100">Stream Sessions</h3>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="neu-inset rounded-lg px-3 py-1.5 text-xs text-primary bg-transparent border border-border"
          >
            <option value="all">All agents</option>
            {agentTypes.map((t) => (
              <option key={t} value={t}>
                {formatAgent(t)}
              </option>
            ))}
          </select>
          <button
            onClick={fetchSessions}
            className="neu-raised-sm p-2 rounded-lg text-secondary hover:text-cba-gold"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="neu-inset rounded-xl p-3 border border-red-500/20 flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Session list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted text-sm">No streaming sessions found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((session) => (
            <div
              key={session.id}
              className="neu-inset rounded-xl p-4 hover:border-cba-gold/10 border border-transparent transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cba-gold" />
                  <span className="text-sm font-medium text-primary">
                    {formatAgent(session.agent_type)}
                  </span>
                </div>
                {statusBadge(session.session_status)}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(session.created_at).toLocaleString()}
                </span>
                {session.latency_ms != null && (
                  <span>{(session.latency_ms / 1000).toFixed(1)}s</span>
                )}
                {session.token_usage?.totalTokens != null && (
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {session.token_usage.totalTokens} tokens
                  </span>
                )}
                {session.model_id && <span className="text-zinc-600">{session.model_id}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
