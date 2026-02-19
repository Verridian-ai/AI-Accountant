/**
 * MigrationDashboard — Admin dashboard for Vercel AI SDK migration progress
 *
 * Shows migration phase per agent, performance comparisons, and rollback controls.
 */

import { useState, useEffect, useCallback } from 'react';
import { BASE_URL, getAuthHeaders } from '../../../api';
import {
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Shield,
} from 'lucide-react';

const API_URL = `${BASE_URL}/api`;

interface MigrationRecord {
  agent_type: string;
  legacy_class: string;
  vercel_class: string | null;
  migration_phase: string;
  legacy_invocations: number;
  vercel_invocations: number;
  error_rate_legacy: number;
  error_rate_vercel: number;
  avg_latency_legacy_ms: number | null;
  avg_latency_vercel_ms: number | null;
  rollback_count: number;
}

interface BenchmarkAgent {
  agentType: string;
  legacy: { avgLatencyMs: number; errorRate: number; invocations: number };
  vercel: { avgLatencyMs: number; errorRate: number; invocations: number };
  improvement: { latencyPct: number; errorRatePct: number };
}

const PHASE_COLORS: Record<string, string> = {
  legacy: 'bg-zinc-500/10 text-secondary',
  pilot: 'bg-cba-gold/10 text-cba-gold',
  parallel: 'bg-blue-500/10 text-blue-400',
  migrated: 'bg-emerald-500/10 text-emerald-400',
  deprecated: 'bg-red-500/10 text-red-400',
};

export function MigrationDashboard() {
  const [statuses, setStatuses] = useState<MigrationRecord[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, benchRes] = await Promise.all([
        fetch(`${API_URL}/migration/status`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/migration/benchmarks`, { headers: getAuthHeaders() }),
      ]);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatuses(Array.isArray(data) ? data : (data.statuses ?? []));
      }
      if (benchRes.ok) {
        const data = await benchRes.json();
        setBenchmarks(Array.isArray(data) ? data : (data.agents ?? []));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load migration data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRollback = async (agentType: string) => {
    setRollingBack(agentType);
    try {
      await fetch(`${API_URL}/migration/rollback/${agentType}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      await fetchData();
    } catch {
      // Silent fail
    } finally {
      setRollingBack(null);
    }
  };

  const totalAgents = statuses.length || 5;
  const migratedCount = statuses.filter((s) =>
    ['pilot', 'parallel', 'migrated'].includes(s.migration_phase),
  ).length;

  const formatAgent = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading migration data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-zinc-100">Vercel AI SDK Migration</h3>
          <p className="text-xs text-muted mt-1">
            {migratedCount} of {totalAgents} agents migrated
          </p>
        </div>
        <button
          onClick={fetchData}
          className="neu-raised-sm p-2 rounded-lg text-secondary hover:text-cba-gold"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 neu-inset rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#FFCC00] to-emerald-400 rounded-full transition-all duration-500"
          style={{ width: `${(migratedCount / totalAgents) * 100}%` }}
        />
      </div>

      {error && (
        <div className="neu-inset rounded-xl p-3 border border-red-500/20 flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Agent cards */}
      <div className="space-y-3">
        {statuses.map((agent) => {
          const bench = benchmarks.find((b) => b.agentType === agent.agent_type);
          return (
            <div key={agent.agent_type} className="neu-inset rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-cba-gold" />
                  <span className="text-sm font-medium text-primary">
                    {formatAgent(agent.agent_type)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${PHASE_COLORS[agent.migration_phase] ?? PHASE_COLORS.legacy}`}
                  >
                    {agent.migration_phase}
                  </span>
                </div>
                {agent.migration_phase !== 'legacy' && (
                  <button
                    onClick={() => handleRollback(agent.agent_type)}
                    disabled={rollingBack === agent.agent_type}
                    className="flex items-center gap-1 text-xs text-muted hover:text-red-400 transition-colors"
                  >
                    <RotateCcw
                      className={`w-3 h-3 ${rollingBack === agent.agent_type ? 'animate-spin' : ''}`}
                    />
                    Rollback
                  </button>
                )}
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted">Legacy calls</span>
                  <p className="text-primary font-medium">{agent.legacy_invocations}</p>
                </div>
                <div>
                  <span className="text-muted">Vercel calls</span>
                  <p className="text-primary font-medium">{agent.vercel_invocations}</p>
                </div>
                <div>
                  <span className="text-muted">Rollbacks</span>
                  <p className="text-primary font-medium">{agent.rollback_count}</p>
                </div>
                <div>
                  <span className="text-muted">Vercel class</span>
                  <p className="text-primary font-medium truncate">{agent.vercel_class ?? '—'}</p>
                </div>
              </div>

              {/* Performance comparison */}
              {bench && (
                <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-muted" />
                    <span className="text-muted">Latency:</span>
                    {bench.improvement.latencyPct < 0 ? (
                      <span className="text-emerald-400 flex items-center gap-0.5">
                        <ArrowDownRight className="w-3 h-3" />
                        {Math.abs(bench.improvement.latencyPct).toFixed(1)}% faster
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-0.5">
                        <ArrowUpRight className="w-3 h-3" />
                        {bench.improvement.latencyPct.toFixed(1)}% slower
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-muted" />
                    <span className="text-muted">Error rate:</span>
                    {bench.improvement.errorRatePct <= 0 ? (
                      <span className="text-emerald-400 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        {Math.abs(bench.improvement.errorRatePct).toFixed(1)}% lower
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-0.5">
                        <AlertCircle className="w-3 h-3" />
                        {bench.improvement.errorRatePct.toFixed(1)}% higher
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
