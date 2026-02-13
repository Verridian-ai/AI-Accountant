import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, ArrowRight, Loader2, GitCompareArrows, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { analyticsApi } from '@/api';
import type { TransferMatch } from '../types';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(
    Math.abs(cents) / 100,
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return 'bg-emerald-500';
  if (c >= 0.5) return 'bg-amber-500';
  return 'bg-red-500';
}

function confidenceTextColor(c: number): string {
  if (c >= 0.8) return 'text-emerald-400';
  if (c >= 0.5) return 'text-amber-400';
  return 'text-red-400';
}

export function TransferConfirmation() {
  const [matches, setMatches] = useState<TransferMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      const data = await analyticsApi.fetchTransferMatches();
      setMatches(data);
    } catch (err) {
      console.error('Failed to fetch transfer matches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id: string) => {
    setProcessing((prev) => new Set(prev).add(id));
    try {
      await analyticsApi.confirmTransfer(id);
      setMatches((prev) => prev.map((m) => (m.id === id ? { ...m, isConfirmed: true } : m)));
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    } catch (err) {
      console.error('Failed to confirm transfer:', err);
    } finally {
      setProcessing((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  };

  const handleReject = async (id: string) => {
    setProcessing((prev) => new Set(prev).add(id));
    try {
      await analyticsApi.rejectTransfer(id);
      setMatches((prev) => prev.filter((m) => m.id !== id));
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    } catch (err) {
      console.error('Failed to reject transfer:', err);
    } finally {
      setProcessing((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  };

  const handleBatchConfirm = async () => {
    const ids = Array.from(selected);
    for (const id of ids) {
      await handleConfirm(id);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const pending = matches.filter((m) => !m.isConfirmed);
  const confirmed = matches.filter((m) => m.isConfirmed);

  if (loading) {
    return (
      <div className="neu-raised rounded-3xl p-8 border border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#FFCC00] animate-pulse" />
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
            Scanning transfers...
          </span>
        </div>
        <div className="space-y-3 mt-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 neu-inset rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="neu-raised rounded-3xl p-10 text-center border border-white/5">
        <div className="neu-inset w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center">
          <GitCompareArrows className="w-10 h-10 text-zinc-800" />
        </div>
        <h3 className="font-black text-zinc-200 uppercase tracking-widest text-sm">
          No Transfer Matches
        </h3>
        <p className="text-xs text-zinc-600 mt-2 font-bold uppercase tracking-tight">
          Auto-detect will find transfers between your accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="neu-raised rounded-2xl p-4 border border-white/5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="w-4 h-4 text-[#FFCC00]" />
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">
            Transfer Matches
          </span>
        </div>
        <div className="flex flex-wrap gap-2 ml-auto">
          <Badge variant="secondary">{matches.length} detected</Badge>
          <Badge variant="success">{confirmed.length} confirmed</Badge>
          <Badge variant="warning">{pending.length} pending</Badge>
        </div>
      </div>

      {/* Batch Actions */}
      {selected.size > 0 && (
        <div className="neu-raised rounded-2xl p-3 border border-[#FFCC00]/20 flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-300">{selected.size} selected</span>
          <button
            type="button"
            onClick={handleBatchConfirm}
            className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-black uppercase tracking-wider hover:bg-emerald-500/20 transition-colors"
          >
            Confirm All Selected
          </button>
        </div>
      )}

      {/* Match Cards */}
      <div className="space-y-3">
        {pending.map((match) => {
          const isProcessing = processing.has(match.id);
          const isSelected = selected.has(match.id);

          return (
            <div
              key={match.id}
              className={cn(
                'neu-raised rounded-2xl border transition-all',
                isSelected ? 'border-[#FFCC00]/30' : 'border-white/5',
              )}
            >
              <div className="p-4">
                {/* Select + Confidence header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelect(match.id)}
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                        isSelected
                          ? 'border-[#FFCC00] bg-[#FFCC00]'
                          : 'border-zinc-600 hover:border-zinc-400',
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3 text-[#0a0a0f]" />}
                    </button>
                    <span
                      className={cn(
                        'text-[10px] font-black uppercase tracking-widest',
                        confidenceTextColor(match.confidence),
                      )}
                    >
                      {Math.round(match.confidence * 100)}% match
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          confidenceColor(match.confidence),
                        )}
                        style={{ width: `${match.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Source → Target layout */}
                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                  {/* Source */}
                  <div className="flex-1 neu-inset rounded-xl p-3 border border-white/5">
                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1">
                      Source
                    </p>
                    <p className="text-xs font-bold text-zinc-200 truncate">
                      {match.sourceDescription}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[9px] font-bold text-zinc-500">
                        {match.sourceAccountName}
                      </span>
                      <span className="text-sm font-black text-red-400">
                        -{formatCurrency(match.sourceAmount)}
                      </span>
                    </div>
                    <p className="text-[8px] text-zinc-600 mt-1">{formatDate(match.sourceDate)}</p>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center justify-center">
                    <div className="neu-inset p-2 rounded-xl">
                      <ArrowRight className="w-4 h-4 text-[#FFCC00] sm:rotate-0 rotate-90" />
                    </div>
                  </div>

                  {/* Target */}
                  <div className="flex-1 neu-inset rounded-xl p-3 border border-white/5">
                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1">
                      Target
                    </p>
                    <p className="text-xs font-bold text-zinc-200 truncate">
                      {match.targetDescription}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[9px] font-bold text-zinc-500">
                        {match.targetAccountName}
                      </span>
                      <span className="text-sm font-black text-emerald-400">
                        +{formatCurrency(match.targetAmount)}
                      </span>
                    </div>
                    <p className="text-[8px] text-zinc-600 mt-1">{formatDate(match.targetDate)}</p>
                  </div>
                </div>

                {/* Match Reasons */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {match.matchReasons.map((reason, i) => (
                    <Badge key={i} variant="outline" className="text-[8px]">
                      <Filter className="w-2.5 h-2.5 mr-1" />
                      {reason}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Action Footer */}
              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/5 bg-black/20 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => handleReject(match.id)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-wider hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <X className="w-3 h-3 inline mr-1" />
                      Reject
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirm(match.id)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-wider hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-3 h-3 inline mr-1" />
                      Confirm
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
