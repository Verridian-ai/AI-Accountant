import { useState, useEffect } from 'react';
import { Users, Wallet, FileText, Brain, HardDrive, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tenantApi } from '@/api';

interface UsageMetric {
  key: string;
  label: string;
  icon: typeof Users;
  current: number;
  limit: number;
  unit?: string;
}

export function UsageDashboard() {
  const [metrics, setMetrics] = useState<UsageMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const tenantId = localStorage.getItem('tenantId');

  useEffect(() => {
    if (!tenantId) return;
    tenantApi
      .getSubscription(tenantId)
      .then((data: Record<string, unknown>) => {
        const usage = data.usage ?? {};
        const limits = data.limits ?? {};
        setMetrics([
          {
            key: 'members',
            label: 'Members',
            icon: Users,
            current: usage.members ?? 0,
            limit: limits.members ?? 1,
          },
          {
            key: 'accounts',
            label: 'Accounts',
            icon: Wallet,
            current: usage.accounts ?? 0,
            limit: limits.accounts ?? 2,
          },
          {
            key: 'transactions',
            label: 'Transactions',
            icon: FileText,
            current: usage.transactions ?? 0,
            limit: limits.transactionsPerMonth ?? 100,
            unit: 'this month',
          },
          {
            key: 'aiQueries',
            label: 'AI Queries',
            icon: Brain,
            current: usage.aiQueries ?? 0,
            limit: limits.aiQueries ?? 10,
            unit: 'this month',
          },
          {
            key: 'storage',
            label: 'Storage',
            icon: HardDrive,
            current: usage.storageMB ?? 0,
            limit: limits.storageMB ?? 50,
            unit: 'MB',
          },
        ]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tenantId]);

  const getPercent = (current: number, limit: number) => {
    if (limit <= 0) return 0;
    return Math.min(100, Math.round((current / limit) * 100));
  };

  const getBarColor = (percent: number) => {
    if (percent >= 80) return 'bg-red-400';
    if (percent >= 60) return 'bg-[#FFCC00]';
    return 'bg-emerald-400';
  };

  const getGlowColor = (percent: number) => {
    if (percent >= 80) return 'shadow-[0_0_12px_rgba(248,113,113,0.2)]';
    if (percent >= 60) return 'shadow-[0_0_12px_rgba(255,204,0,0.15)]';
    return '';
  };

  const warningMetrics = metrics.filter((m) => getPercent(m.current, m.limit) >= 90);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Usage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={`sk-${i}`} className="neu-inset rounded-2xl p-5 animate-pulse h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Usage</h2>
        <p className="text-sm text-zinc-500">Monitor your workspace resource consumption</p>
      </div>

      {/* Warning Banner */}
      {warningMetrics.length > 0 && (
        <div className="neu-raised rounded-2xl border border-[#FFCC00]/20 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#FFCC00] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-[#FFCC00]">Approaching Limits</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              You're close to your {warningMetrics.map((m) => m.label.toLowerCase()).join(', ')}{' '}
              limit{warningMetrics.length > 1 ? 's' : ''}. Upgrade your plan for more capacity.
            </p>
          </div>
        </div>
      )}

      {/* Usage Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => {
          const percent = getPercent(metric.current, metric.limit);
          const barColor = getBarColor(percent);
          const glowColor = getGlowColor(percent);
          const Icon = metric.icon;
          const limitDisplay = metric.limit <= 0 ? 'Unlimited' : metric.limit.toLocaleString();

          return (
            <div key={metric.key} className={cn('neu-inset rounded-2xl p-5 space-y-3', glowColor)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    {metric.label}
                  </span>
                </div>
                <span className="text-xs font-bold text-zinc-500">{percent}%</span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-zinc-100 tabular-nums">
                  {metric.current.toLocaleString()}
                </span>
                <span className="text-sm text-zinc-500">of {limitDisplay}</span>
                {metric.unit && <span className="text-xs text-zinc-600">{metric.unit}</span>}
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-zinc-800/50 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', barColor)}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
