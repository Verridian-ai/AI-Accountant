import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, ShieldAlert, AlertTriangle, Info, X, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { analyticsApi } from '@/api';
import type { Anomaly } from '../types';

const TYPE_LABELS: Record<string, string> = {
  amount: 'Unusual Amount',
  frequency: 'Frequency Anomaly',
  duplicate: 'Possible Duplicate',
  new_merchant: 'New Merchant',
  round_number: 'Round Number',
  time: 'Unusual Timing',
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  amount: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  frequency: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  duplicate: { bg: 'bg-red-500/10', text: 'text-red-400' },
  new_merchant: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  round_number: { bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  time: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
};

const SEVERITY_ORDER = ['critical', 'warning', 'info'] as const;
const SEVERITY_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  critical: { icon: ShieldAlert, color: 'text-red-400', label: 'Critical' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', label: 'Warning' },
  info: { icon: Info, color: 'text-blue-400', label: 'Info' },
};

export function AnomalyDetection() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [filterType] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);

  useEffect(() => {
    loadAnomalies();
  }, []);

  const loadAnomalies = async () => {
    try {
      const data = await analyticsApi.fetchAnomalies();
      setAnomalies(data.filter((a) => !a.isDismissed));
    } catch (err) {
      console.error('Failed to fetch anomalies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id: string) => {
    setDismissingId(id);
    try {
      await analyticsApi.dismissAnomaly(id);
      setAnomalies((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Failed to dismiss anomaly:', err);
    } finally {
      setDismissingId(null);
    }
  };

  const filtered = useMemo(() => {
    return anomalies.filter((a) => {
      if (filterType && a.type !== filterType) return false;
      if (filterSeverity && a.severity !== filterSeverity) return false;
      return true;
    });
  }, [anomalies, filterType, filterSeverity]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Anomaly[]>();
    SEVERITY_ORDER.forEach((s) => groups.set(s, []));
    filtered.forEach((a) => {
      const list = groups.get(a.severity);
      if (list) list.push(a);
    });
    return groups;
  }, [filtered]);

  const counts = useMemo(
    () => ({
      critical: anomalies.filter((a) => a.severity === 'critical').length,
      warning: anomalies.filter((a) => a.severity === 'warning').length,
      info: anomalies.filter((a) => a.severity === 'info').length,
    }),
    [anomalies],
  );

  if (loading) {
    return (
      <div className="neu-raised rounded-3xl p-8 border border-white/5 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 text-[#FFCC00] animate-spin" />
      </div>
    );
  }

  if (anomalies.length === 0) {
    return (
      <div className="neu-raised rounded-3xl p-10 text-center border border-white/5">
        <div className="neu-inset w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center">
          <ShieldAlert className="w-10 h-10 text-zinc-800" />
        </div>
        <h3 className="font-black text-zinc-200 uppercase tracking-widest text-sm">No Anomalies</h3>
        <p className="text-xs text-zinc-600 mt-2 font-bold uppercase tracking-tight">
          All transactions look normal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with counts */}
      <div className="neu-raised rounded-2xl p-4 border border-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#FFCC00]" />
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
              Anomaly Detection
            </span>
          </div>
          <div className="flex gap-2">
            {counts.critical > 0 && <Badge variant="destructive">{counts.critical} critical</Badge>}
            {counts.warning > 0 && <Badge variant="warning">{counts.warning} warning</Badge>}
            {counts.info > 0 && <Badge variant="secondary">{counts.info} info</Badge>}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => setFilterSeverity(null)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border',
              !filterSeverity
                ? 'border-[#FFCC00]/30 text-[#FFCC00]'
                : 'border-transparent text-zinc-600 hover:text-zinc-400',
            )}
          >
            All
          </button>
          {SEVERITY_ORDER.map((s) => {
            const cfg = SEVERITY_CONFIG[s];
            if (!cfg) return null;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFilterSeverity(filterSeverity === s ? null : s)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border',
                  filterSeverity === s
                    ? `border-white/20 ${cfg.color}`
                    : 'border-transparent text-zinc-600 hover:text-zinc-400',
                )}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grouped anomalies */}
      {SEVERITY_ORDER.map((severity) => {
        const items = grouped.get(severity) || [];
        if (items.length === 0) return null;
        const sevConfig = SEVERITY_CONFIG[severity];
        if (!sevConfig) return null;
        const SevIcon = sevConfig.icon;

        return (
          <div key={severity}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <SevIcon className={cn('w-3.5 h-3.5', sevConfig.color)} />
              <span
                className={cn('text-[9px] font-black uppercase tracking-[0.2em]', sevConfig.color)}
              >
                {sevConfig.label} ({items.length})
              </span>
            </div>

            <div className="space-y-2">
              {items.map((anomaly) => {
                const typeConfig = TYPE_COLORS[anomaly.type] ?? {
                  bg: 'bg-amber-500/10',
                  text: 'text-amber-400',
                };
                const isDismissing = dismissingId === anomaly.id;

                return (
                  <div
                    key={anomaly.id}
                    className="neu-raised rounded-2xl border border-white/5 p-4 group hover:border-white/10 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <Badge
                        className={cn('text-[8px] shrink-0', typeConfig.bg, typeConfig.text)}
                        variant="outline"
                      >
                        {TYPE_LABELS[anomaly.type] || anomaly.type}
                      </Badge>
                      <p className="text-xs text-zinc-300 flex-1 leading-relaxed">
                        {anomaly.description}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDismiss(anomaly.id)}
                        disabled={isDismissing}
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                        title="Dismiss"
                      >
                        {isDismissing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tight">
                        {new Date(anomaly.createdAt).toLocaleDateString('en-AU')}
                      </span>
                      {anomaly.transactionId && (
                        <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tight">
                          <MessageSquare className="w-2.5 h-2.5 inline mr-0.5" />
                          Txn #{anomaly.transactionId}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
