import { useState } from 'react';
import { Zap, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { matchesApi } from '@/api';
import type { AutoMatchResult } from '@/api';

export function AutoMatchView() {
  const [autoConfirmThreshold, setAutoConfirmThreshold] = useState(0.85);
  const [suggestThreshold, setSuggestThreshold] = useState(0.6);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AutoMatchResult | null>(null);
  const [lastRunTime, setLastRunTime] = useState<Date | null>(null);

  const runAutoMatch = async () => {
    setRunning(true);
    try {
      const data = await matchesApi.autoMatch({
        autoMatchThreshold: autoConfirmThreshold,
        suggestThreshold: suggestThreshold,
      });
      setResult(data);
      setLastRunTime(new Date());
    } catch (e) {
      console.error('Auto-match failed', e);
    } finally {
      setRunning(false);
    }
  };

  const handleConfirm = async (matchId: string) => {
    try {
      await matchesApi.confirm(matchId);
      if (result) {
        setResult({
          ...result,
          details: result.details.map(
            (d: { matchId?: string; documentId: string; status: string; topScore?: number }) =>
              d.matchId === matchId ? { ...d, status: 'matched' } : d,
          ),
          matched: result.matched + 1,
          suggested: result.suggested - 1,
        });
      }
    } catch (e) {
      console.error('Failed to confirm match', e);
    }
  };

  const handleReject = async (matchId: string) => {
    try {
      await matchesApi.reject(matchId);
      if (result) {
        setResult({
          ...result,
          details: result.details.map(
            (d: { matchId?: string; documentId: string; status: string; topScore?: number }) =>
              d.matchId === matchId ? { ...d, status: 'unmatched' } : d,
          ),
          suggested: result.suggested - 1,
          unmatched: result.unmatched + 1,
        });
      }
    } catch (e) {
      console.error('Failed to reject match', e);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-400 text-[10px] font-bold">
            <CheckCircle2 className="h-3 w-3" />
            Matched
          </span>
        );
      case 'suggested':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 text-[10px] font-bold">
            <AlertCircle className="h-3 w-3" />
            Suggested
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-600/30 text-zinc-400 text-[10px] font-bold">
            <XCircle className="h-3 w-3" />
            Unmatched
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="neu-raised rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-6">
          {/* Threshold Sliders */}
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="amv-auto-confirm-threshold" className="text-xs text-zinc-400">
                  Auto-Confirm Threshold
                </label>
                <span className="text-xs font-mono text-[#FFCC00]">
                  {(autoConfirmThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <input
                id="amv-auto-confirm-threshold"
                type="range"
                min="0.50"
                max="1.00"
                step="0.01"
                value={autoConfirmThreshold}
                onChange={(e) => setAutoConfirmThreshold(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-[#FFCC00]"
              />
              <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="amv-suggest-threshold" className="text-xs text-zinc-400">
                  Suggest Threshold
                </label>
                <span className="text-xs font-mono text-amber-400">
                  {(suggestThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <input
                id="amv-suggest-threshold"
                type="range"
                min="0.30"
                max="0.95"
                step="0.01"
                value={suggestThreshold}
                onChange={(e) => setSuggestThreshold(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-amber-400"
              />
              <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
                <span>30%</span>
                <span>95%</span>
              </div>
            </div>
          </div>

          {/* Run Button */}
          <div className="shrink-0">
            <button
              onClick={runAutoMatch}
              disabled={running}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FFCC00] text-[#0a0a0f] font-bold text-sm hover:bg-[#FFD633] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_0_20px_rgba(255,204,0,0.2)]"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Matching...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Run Auto-Match
                </>
              )}
            </button>
            {lastRunTime && (
              <p className="text-[10px] text-zinc-500 mt-2 text-right">
                Last run: {lastRunTime.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Running Indicator */}
      {running && (
        <div className="neu-raised rounded-xl p-6 text-center">
          <Loader2 className="h-8 w-8 text-[#FFCC00] animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-300">Matching documents against transactions...</p>
          <p className="text-xs text-zinc-500 mt-1">This may take a moment</p>
        </div>
      )}

      {/* Results */}
      {result && !running && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="neu-raised rounded-xl p-5 text-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-emerald-400">{result.matched}</p>
              <p className="text-xs text-zinc-400">Matched</p>
            </div>
            <div className="neu-raised rounded-xl p-5 text-center">
              <AlertCircle className="h-6 w-6 text-amber-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-amber-400">{result.suggested}</p>
              <p className="text-xs text-zinc-400">Suggested</p>
            </div>
            <div className="neu-raised rounded-xl p-5 text-center">
              <XCircle className="h-6 w-6 text-zinc-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-zinc-400">{result.unmatched}</p>
              <p className="text-xs text-zinc-400">Unmatched</p>
            </div>
          </div>

          {/* Results Table */}
          {result.details.length > 0 && (
            <div className="neu-raised rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-5 py-3 text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                        Document
                      </th>
                      <th className="text-center px-5 py-3 text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                        Status
                      </th>
                      <th className="text-right px-5 py-3 text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                        Score
                      </th>
                      <th className="text-right px-5 py-3 text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {result.details.map(
                      (detail: {
                        matchId?: string;
                        documentId: string;
                        status: string;
                        topScore?: number;
                      }) => (
                        <tr key={detail.documentId} className="hover:bg-white/5">
                          <td className="px-5 py-3">
                            <span className="text-zinc-200 font-mono text-xs">
                              {detail.documentId.slice(0, 12)}...
                            </span>
                          </td>
                          <td className="px-5 py-3 text-center">{getStatusBadge(detail.status)}</td>
                          <td className="px-5 py-3 text-right">
                            {detail.topScore != null ? (
                              <span
                                className={`font-mono text-xs ${detail.topScore > 0.85 ? 'text-emerald-400' : detail.topScore > 0.6 ? 'text-amber-400' : 'text-zinc-400'}`}
                              >
                                {(detail.topScore * 100).toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-zinc-600 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {detail.status === 'suggested' && detail.matchId && (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleConfirm(detail.matchId!)}
                                  className="p-1.5 rounded-lg text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                                  title="Confirm match"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleReject(detail.matchId!)}
                                  className="p-1.5 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                  title="Reject match"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!result && !running && (
        <div className="neu-raised rounded-xl p-8 text-center">
          <Zap className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">Run auto-match to pair documents with transactions</p>
          <p className="text-xs text-zinc-500 mt-1">
            Adjust thresholds above to control match sensitivity
          </p>
        </div>
      )}
    </div>
  );
}
