import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, RotateCcw, ChevronDown, ChevronUp, AlertCircle, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { analyticsApi } from '@/api';
import type { RecurringPayment } from '../types';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

const FREQUENCY_ORDER = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'annual'] as const;

type SortBy = 'amount' | 'frequency' | 'nextDue';

export function RecurringPayments() {
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortBy>('amount');

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      const data = await analyticsApi.fetchRecurringPayments();
      setPayments(data);
    } catch (err) {
      console.error('Failed to fetch recurring payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, RecurringPayment[]>();
    FREQUENCY_ORDER.forEach((freq) => groups.set(freq, []));

    const sorted = [...payments].sort((a, b) => {
      if (sortBy === 'amount') return b.typicalAmount - a.typicalAmount;
      if (sortBy === 'nextDue')
        return new Date(a.nextExpected).getTime() - new Date(b.nextExpected).getTime();
      return 0;
    });

    sorted.forEach((p) => {
      const list = groups.get(p.frequency);
      if (list) list.push(p);
    });

    return groups;
  }, [payments, sortBy]);

  const totalMonthly = useMemo(() => {
    return payments.reduce((sum, p) => {
      switch (p.frequency) {
        case 'weekly':
          return sum + p.typicalAmount * 4.33;
        case 'fortnightly':
          return sum + p.typicalAmount * 2.17;
        case 'monthly':
          return sum + p.typicalAmount;
        case 'quarterly':
          return sum + p.typicalAmount / 3;
        case 'annual':
          return sum + p.typicalAmount / 12;
        default:
          return sum;
      }
    }, 0);
  }, [payments]);

  const totalAnnual = totalMonthly * 12;

  const toggleCollapse = (freq: string) => {
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(freq)) n.delete(freq);
      else n.add(freq);
      return n;
    });
  };

  if (loading) {
    return (
      <div className="neu-raised rounded-3xl p-8 border border-border/50 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 text-cba-gold animate-spin" />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="neu-raised rounded-3xl p-10 text-center border border-border/50">
        <div className="neu-inset w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center">
          <RotateCcw className="w-10 h-10 text-zinc-800" />
        </div>
        <h3 className="font-black text-primary uppercase tracking-widest text-sm">
          No Recurring Payments
        </h3>
        <p className="text-xs text-zinc-600 mt-2 font-bold uppercase tracking-tight">
          Patterns will be detected as more data accumulates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Totals */}
      <div className="neu-raised rounded-2xl p-4 border border-border/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-cba-gold" />
            <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">
              Recurring Payments
            </span>
          </div>
          <div className="flex gap-3">
            <div className="text-right">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                Monthly
              </p>
              <p className="text-sm font-black text-red-400">{formatCurrency(totalMonthly)}</p>
            </div>
            <div className="w-px bg-overlay-hover" />
            <div className="text-right">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                Annual
              </p>
              <p className="text-sm font-black text-red-400">{formatCurrency(totalAnnual)}</p>
            </div>
          </div>
        </div>

        {/* Sort controls */}
        <div className="flex gap-1 mt-3 neu-inset rounded-xl p-1 w-fit">
          {(['amount', 'frequency', 'nextDue'] as SortBy[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSortBy(s)}
              className={cn(
                'px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all',
                sortBy === s ? 'bg-cba-gold text-base' : 'text-muted hover:text-primary',
              )}
            >
              {s === 'nextDue' ? 'Next Due' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Frequency Groups */}
      {FREQUENCY_ORDER.map((freq) => {
        const items = grouped.get(freq) || [];
        if (items.length === 0) return null;
        const isCollapsed = collapsed.has(freq);

        return (
          <div key={freq} className="neu-raised rounded-2xl border border-border/50 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCollapse(freq)}
              className="w-full px-5 py-4 flex items-center justify-between border-b border-border/50 bg-white/[0.01] hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                  {FREQUENCY_LABELS[freq]}
                </span>
                <Badge variant="secondary" className="text-[8px]">
                  {items.length}
                </Badge>
              </div>
              {isCollapsed ? (
                <ChevronDown className="w-4 h-4 text-zinc-600" />
              ) : (
                <ChevronUp className="w-4 h-4 text-zinc-600" />
              )}
            </button>

            {!isCollapsed && (
              <div className="divide-y divide-white/5">
                {items.map((payment) => (
                  <div
                    key={payment.id}
                    className="px-5 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-primary truncate">
                          {payment.merchantPattern}
                        </p>
                        {payment.isMissed && (
                          <Badge variant="destructive" className="text-[7px] px-1.5 py-0">
                            <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                            MISSED
                          </Badge>
                        )}
                        {payment.amountChanged && (
                          <Badge variant="warning" className="text-[7px] px-1.5 py-0">
                            <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                            CHANGED
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {payment.category && (
                          <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tight">
                            {payment.category}
                          </span>
                        )}
                        <span className="text-[8px] text-zinc-600">
                          Next: {formatDate(payment.nextExpected)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-red-400 tabular-nums">
                        {formatCurrency(payment.typicalAmount)}
                      </p>
                      <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-tight mt-0.5">
                        {formatCurrency(payment.annualCost)}/yr
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
