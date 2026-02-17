import { useState, useEffect } from 'react';
import { FileText, Target, ShieldCheck, Clock, RefreshCw } from 'lucide-react';
import { matchesApi } from '@/api';
import type { MatchStats } from '@/api';

export function MatchStatistics() {
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await matchesApi.getStats();
      setStats(data);
    } catch (e) {
      console.error('Failed to load match statistics', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="neu-raised rounded-xl p-5 animate-pulse">
              <div className="h-4 w-24 bg-zinc-700 rounded mb-3" />
              <div className="h-8 w-16 bg-zinc-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="neu-raised rounded-xl p-8 text-center">
        <p className="text-zinc-400">No statistics available</p>
        <button
          onClick={loadStats}
          className="mt-4 px-4 py-2 neu-raised rounded-lg text-[#FFCC00] hover:bg-white/5 text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  const matchRateColor =
    stats.matchRate > 80
      ? 'text-emerald-400'
      : stats.matchRate < 50
        ? 'text-red-400'
        : 'text-amber-400';
  const maxVendorCount =
    stats.topVendors.length > 0 ? Math.max(...stats.topVendors.map((v: { name: string; count: number }) => v.count)) : 1;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="neu-raised rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="neu-inset p-2 rounded-lg">
              <FileText className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Total Documents
            </span>
          </div>
          <p className="text-2xl font-bold text-zinc-100">{stats.totalDocuments}</p>
          <p className="text-xs text-zinc-500 mt-1">{stats.matched} matched</p>
        </div>

        <div className="neu-raised rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="neu-inset p-2 rounded-lg">
              <Target className={`h-4 w-4 ${matchRateColor}`} />
            </div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Match Rate
            </span>
          </div>
          <p className={`text-2xl font-bold ${matchRateColor}`}>{stats.matchRate.toFixed(1)}%</p>
          <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${stats.matchRate > 80 ? 'bg-emerald-400' : stats.matchRate < 50 ? 'bg-red-400' : 'bg-amber-400'}`}
              style={{ width: `${Math.min(stats.matchRate, 100)}%` }}
            />
          </div>
        </div>

        <div className="neu-raised rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="neu-inset p-2 rounded-lg">
              <ShieldCheck className="h-4 w-4 text-[#FFCC00]" />
            </div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Avg Confidence
            </span>
          </div>
          <p className="text-2xl font-bold text-zinc-100">
            {(stats.averageConfidence * 100).toFixed(0)}%
          </p>
          <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[#FFCC00] transition-all duration-500"
              style={{ width: `${Math.min(stats.averageConfidence * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="neu-raised rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="neu-inset p-2 rounded-lg">
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Pending Review
            </span>
          </div>
          <p className="text-2xl font-bold text-zinc-100">{stats.pending}</p>
          <p className="text-xs text-zinc-500 mt-1">{stats.failed} failed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Vendors */}
        <div className="neu-raised rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#FFCC00] uppercase tracking-wider">
              Top Vendors
            </h3>
            <button
              onClick={loadStats}
              className="p-1.5 neu-raised-sm rounded-lg text-zinc-400 hover:text-zinc-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          {stats.topVendors.length === 0 ? (
            <p className="text-zinc-500 text-sm">No vendor data yet</p>
          ) : (
            <div className="space-y-3">
              {stats.topVendors.slice(0, 10).map((vendor: { name: string; count: number }, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-5 text-right">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-zinc-200 truncate">{vendor.name}</span>
                      <span className="text-xs text-zinc-400 font-mono ml-2">{vendor.count}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#FFCC00]/60 to-[#FFCC00] transition-all duration-500"
                        style={{ width: `${(vendor.count / maxVendorCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rule Effectiveness */}
        <div className="neu-raised rounded-xl p-6">
          <h3 className="text-sm font-semibold text-[#FFCC00] uppercase tracking-wider mb-4">
            Rule Effectiveness
          </h3>
          {stats.ruleEffectiveness.length === 0 ? (
            <p className="text-zinc-500 text-sm">No rules configured yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-400 text-xs uppercase tracking-wider">
                    <th className="text-left pb-3 font-semibold">Rule</th>
                    <th className="text-right pb-3 font-semibold">Matches</th>
                    <th className="text-right pb-3 font-semibold">Last Match</th>
                    <th className="text-center pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {stats.ruleEffectiveness
                    .sort((a: { matchCount: number }, b: { matchCount: number }) => b.matchCount - a.matchCount)
                    .map((rule: { ruleId: string; name: string; matchCount: number; lastMatched?: string }) => {
                      const isRecent =
                        rule.lastMatched &&
                        Date.now() - new Date(rule.lastMatched).getTime() < 7 * 24 * 60 * 60 * 1000;
                      return (
                        <tr key={rule.ruleId} className="hover:bg-white/5">
                          <td className="py-2.5 text-zinc-200">{rule.name}</td>
                          <td className="py-2.5 text-right font-mono text-zinc-300">
                            {rule.matchCount}
                          </td>
                          <td className="py-2.5 text-right text-zinc-400 text-xs">
                            {rule.lastMatched
                              ? new Date(rule.lastMatched).toLocaleDateString()
                              : 'Never'}
                          </td>
                          <td className="py-2.5 text-center">
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${isRecent ? 'bg-emerald-400' : 'bg-zinc-600'}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Match Method Distribution */}
      <div className="neu-raised rounded-xl p-6">
        <h3 className="text-sm font-semibold text-[#FFCC00] uppercase tracking-wider mb-4">
          Match Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Matched', value: stats.matched, color: 'bg-emerald-400' },
            { label: 'Pending', value: stats.pending, color: 'bg-amber-400' },
            { label: 'Failed', value: stats.failed, color: 'bg-red-400' },
            { label: 'Total', value: stats.totalDocuments, color: 'bg-[#FFCC00]' },
          ].map((item) => (
            <div key={item.label} className="neu-inset rounded-lg p-4 text-center">
              <div className={`w-3 h-3 rounded-full ${item.color} mx-auto mb-2`} />
              <p className="text-lg font-bold text-zinc-100">{item.value}</p>
              <p className="text-xs text-zinc-500">{item.label}</p>
            </div>
          ))}
        </div>
        {stats.totalDocuments > 0 && (
          <div className="mt-4 h-3 bg-zinc-800 rounded-full overflow-hidden flex">
            {stats.matched > 0 && (
              <div
                className="h-full bg-emerald-400 transition-all"
                style={{ width: `${(stats.matched / stats.totalDocuments) * 100}%` }}
                title={`Matched: ${stats.matched}`}
              />
            )}
            {stats.pending > 0 && (
              <div
                className="h-full bg-amber-400 transition-all"
                style={{ width: `${(stats.pending / stats.totalDocuments) * 100}%` }}
                title={`Pending: ${stats.pending}`}
              />
            )}
            {stats.failed > 0 && (
              <div
                className="h-full bg-red-400 transition-all"
                style={{ width: `${(stats.failed / stats.totalDocuments) * 100}%` }}
                title={`Failed: ${stats.failed}`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
