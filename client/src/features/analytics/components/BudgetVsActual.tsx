import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Target, Pencil, Check, X, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { analyticsApi } from '@/api';
import type { Budget } from '../types';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

function utilizationColor(pct: number): string {
  if (pct >= 100) return 'bg-red-500';
  if (pct >= 80) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function utilizationTextColor(pct: number): string {
  if (pct >= 100) return 'text-red-400';
  if (pct >= 80) return 'text-amber-400';
  return 'text-emerald-400';
}

export function BudgetVsActual() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly'>('monthly');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const loadBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await analyticsApi.fetchBudgetVsActual(periodType);
      setBudgets(data);
    } catch (err) {
      console.error('Failed to fetch budgets:', err);
    } finally {
      setLoading(false);
    }
  }, [periodType]);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  const startEdit = (budget: Budget) => {
    setEditingId(budget.id);
    setEditAmount((budget.amountCents / 100).toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditAmount('');
  };

  const saveEdit = async (budget: Budget) => {
    setSaving(true);
    try {
      const amountCents = Math.round(parseFloat(editAmount) * 100);
      await analyticsApi.saveBudget({ ...budget, amountCents });
      setBudgets((prev) =>
        prev.map((b) => {
          if (b.id !== budget.id) return b;
          const variance = amountCents - b.actualCents;
          const utilization = amountCents > 0 ? (b.actualCents / amountCents) * 100 : 0;
          return { ...b, amountCents, variance, utilizationPercent: utilization };
        }),
      );
      setEditingId(null);
    } catch (err) {
      console.error('Failed to save budget:', err);
    } finally {
      setSaving(false);
    }
  };

  const totalBudget = budgets.reduce((s, b) => s + b.amountCents, 0);
  const totalActual = budgets.reduce((s, b) => s + b.actualCents, 0);
  const totalVariance = totalBudget - totalActual;
  const totalUtilization = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  if (loading) {
    return (
      <div className="neu-raised rounded-3xl p-8 border border-border/50 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 text-cba-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-cba-gold" />
          <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">
            Budget vs Actual
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 neu-inset rounded-xl p-1">
            {(['monthly', 'quarterly'] as const).map((pt) => (
              <button
                key={pt}
                type="button"
                onClick={() => setPeriodType(pt)}
                className={cn(
                  'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                  periodType === pt ? 'bg-cba-gold text-base' : 'text-muted hover:text-primary',
                )}
              >
                {pt}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={loadBudgets}
            className="p-2 rounded-xl text-zinc-600 hover:text-cba-gold hover:bg-overlay transition-all"
            title="Copy from last period"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="neu-raised rounded-2xl border border-border/50 overflow-hidden">
        {/* Desktop table header */}
        <div className="hidden sm:grid grid-cols-[1fr_100px_100px_100px_140px_60px] gap-3 px-5 py-3 border-b border-border/50 bg-white/[0.01]">
          <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">
            Category
          </span>
          <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] text-right">
            Budget
          </span>
          <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] text-right">
            Actual
          </span>
          <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] text-right">
            Variance
          </span>
          <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">
            Status
          </span>
          <span />
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/5">
          {budgets.map((budget) => {
            const isEditing = editingId === budget.id;
            const overBudget = budget.utilizationPercent >= 100;
            const warning = budget.utilizationPercent >= 80 && !overBudget;

            return (
              <div key={budget.id} className="group">
                {/* Desktop layout */}
                <div className="hidden sm:grid grid-cols-[1fr_100px_100px_100px_140px_60px] gap-3 px-5 py-3 items-center hover:bg-white/[0.02] transition-colors">
                  <span className="text-xs font-bold text-primary truncate">{budget.category}</span>

                  {isEditing ? (
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="bg-overlay border border-cba-gold/30 rounded-lg px-2 py-1 text-xs text-primary text-right outline-none w-full"
                    />
                  ) : (
                    <span className="text-xs font-black text-secondary text-right tabular-nums">
                      {formatCurrency(budget.amountCents)}
                    </span>
                  )}

                  <span className="text-xs font-black text-primary text-right tabular-nums">
                    {formatCurrency(budget.actualCents)}
                  </span>

                  <span
                    className={cn(
                      'text-xs font-black text-right tabular-nums',
                      budget.variance >= 0 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {budget.variance >= 0 ? '+' : ''}
                    {formatCurrency(budget.variance)}
                  </span>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-overlay overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          utilizationColor(budget.utilizationPercent),
                        )}
                        style={{ width: `${Math.min(budget.utilizationPercent, 100)}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        'text-[9px] font-black tabular-nums w-10 text-right',
                        utilizationTextColor(budget.utilizationPercent),
                      )}
                    >
                      {budget.utilizationPercent.toFixed(0)}%
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => saveEdit(budget)}
                        disabled={saving}
                        className="p-1 rounded bg-emerald-500/10 text-emerald-400"
                      >
                        {saving ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="p-1 rounded bg-red-500/10 text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(budget)}
                      className="p-1 rounded text-zinc-700 hover:text-cba-gold transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Mobile layout */}
                <div className="sm:hidden px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">{budget.category}</span>
                    {(overBudget || warning) && (
                      <Badge
                        variant={overBudget ? 'destructive' : 'warning'}
                        className="text-[7px]"
                      >
                        {budget.utilizationPercent.toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                  <div className="h-2 rounded-full bg-overlay overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        utilizationColor(budget.utilizationPercent),
                      )}
                      style={{ width: `${Math.min(budget.utilizationPercent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-muted">
                    <span>Budget: {formatCurrency(budget.amountCents)}</span>
                    <span>Actual: {formatCurrency(budget.actualCents)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total Row */}
        <div className="px-5 py-4 border-t border-border bg-white/[0.02]">
          <div className="hidden sm:grid grid-cols-[1fr_100px_100px_100px_140px_60px] gap-3 items-center">
            <span className="text-xs font-black text-cba-gold uppercase tracking-wider">Total</span>
            <span className="text-xs font-black text-primary text-right tabular-nums">
              {formatCurrency(totalBudget)}
            </span>
            <span className="text-xs font-black text-zinc-100 text-right tabular-nums">
              {formatCurrency(totalActual)}
            </span>
            <span
              className={cn(
                'text-xs font-black text-right tabular-nums',
                totalVariance >= 0 ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              {totalVariance >= 0 ? '+' : ''}
              {formatCurrency(totalVariance)}
            </span>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-overlay overflow-hidden">
                <div
                  className={cn('h-full rounded-full', utilizationColor(totalUtilization))}
                  style={{ width: `${Math.min(totalUtilization, 100)}%` }}
                />
              </div>
              <span
                className={cn(
                  'text-[9px] font-black tabular-nums w-10 text-right',
                  utilizationTextColor(totalUtilization),
                )}
              >
                {totalUtilization.toFixed(0)}%
              </span>
            </div>
            <span />
          </div>
          <div className="sm:hidden flex justify-between items-center">
            <span className="text-xs font-black text-cba-gold uppercase">Total</span>
            <span className="text-sm font-black text-zinc-100">
              {formatCurrency(totalActual)} / {formatCurrency(totalBudget)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
