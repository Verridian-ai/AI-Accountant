import { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { budgetsApi } from '../../../api';
import type { BudgetVariance, VarianceSummary } from '../../../api';

interface VarianceViewProps {
    budgetId: string;
    onBack: () => void;
}

export function VarianceView({ budgetId, onBack }: VarianceViewProps) {
    const [loading, setLoading] = useState(true);
    const [variance, setVariance] = useState<BudgetVariance[]>([]);
    const [summary, setSummary] = useState<VarianceSummary | null>(null);

    useEffect(() => {
        loadData();
    }, [budgetId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [vData, sData] = await Promise.all([
                budgetsApi.getVariance(budgetId),
                budgetsApi.getVarianceSummary(budgetId),
            ]);
            setVariance(Array.isArray(vData) ? vData : vData.variances ?? []);
            setSummary(sData);
        } catch (e) {
            console.error('Failed to load variance data', e);
        } finally {
            setLoading(false);
        }
    };

    const fmt = (cents: number) =>
        '$' + (cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 });

    const healthConfig: Record<string, { label: string; color: string; icon: typeof Target }> = {
        on_track: { label: 'On Track', color: 'text-emerald-400 bg-emerald-500/20', icon: Target },
        over_budget: { label: 'Over Budget', color: 'text-red-400 bg-red-500/20', icon: TrendingUp },
        under_budget: { label: 'Under Budget', color: 'text-blue-400 bg-blue-500/20', icon: TrendingDown },
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-[#FFCC00] transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Budgets
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="neu-raised rounded-2xl p-6 animate-pulse">
                            <div className="h-4 bg-zinc-800 rounded w-1/2 mb-3" />
                            <div className="h-6 bg-zinc-800 rounded w-2/3" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const health = summary ? healthConfig[summary.health] ?? healthConfig.on_track : healthConfig.on_track;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="neu-raised-sm p-2 rounded-xl text-zinc-400 hover:text-[#FFCC00] transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-gradient-gold">Budget vs Actual</h2>
                    <p className="text-sm text-zinc-500">Variance analysis for budget</p>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="neu-raised rounded-2xl p-5">
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Total Budgeted</p>
                        <p className="text-xl font-bold text-zinc-200 font-mono">{fmt(summary.totalBudgeted)}</p>
                    </div>
                    <div className="neu-raised rounded-2xl p-5">
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Total Actual</p>
                        <p className="text-xl font-bold text-zinc-200 font-mono">{fmt(summary.totalActual)}</p>
                    </div>
                    <div className="neu-raised rounded-2xl p-5">
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Total Variance</p>
                        <p className={`text-xl font-bold font-mono ${summary.totalVariance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmt(summary.totalVariance)}
                        </p>
                    </div>
                    <div className="neu-raised rounded-2xl p-5">
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Health</p>
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${health.color}`}>
                            <health.icon className="w-4 h-4" />
                            {health.label}
                        </span>
                    </div>
                </div>
            )}

            {/* Top Variances Alert */}
            {summary && summary.topVariances.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {summary.topVariances.slice(0, 5).map((tv, i) => (
                        <div key={i} className="neu-inset rounded-xl p-3 flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${tv.variance < 0 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-300 truncate">{tv.category}</p>
                                <p className="text-xs text-zinc-500">
                                    Budget: {fmt(tv.budgeted)} &middot; Actual: {fmt(tv.actual)}
                                </p>
                            </div>
                            <p className={`text-sm font-bold font-mono ${tv.variance < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                                {fmt(tv.variance)}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Variance Table */}
            <div className="neu-raised rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Category</th>
                                <th className="text-left px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Period</th>
                                <th className="text-right px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Budgeted</th>
                                <th className="text-right px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Actual</th>
                                <th className="text-right px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Variance $</th>
                                <th className="text-right px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Variance %</th>
                                <th className="px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider w-40">Progress</th>
                            </tr>
                        </thead>
                        <tbody>
                            {variance.map((v, i) => {
                                const ratio = v.budgetedAmount > 0 ? (v.actualAmount / v.budgetedAmount) * 100 : 0;
                                const isOver = ratio > 100;
                                const isSignificantlyUnder = ratio < 50;

                                return (
                                    <tr
                                        key={i}
                                        className={`border-b border-white/5 transition-colors ${
                                            isOver ? 'bg-red-500/5' : isSignificantlyUnder ? 'bg-amber-500/5' : 'hover:bg-white/[0.02]'
                                        }`}
                                    >
                                        <td className="px-4 py-3 text-zinc-200 font-medium">{v.category}</td>
                                        <td className="px-4 py-3 text-zinc-400">{v.period}</td>
                                        <td className="px-4 py-3 text-right text-zinc-300 font-mono">{fmt(v.budgetedAmount)}</td>
                                        <td className="px-4 py-3 text-right text-zinc-300 font-mono">{fmt(v.actualAmount)}</td>
                                        <td className={`px-4 py-3 text-right font-mono font-medium ${v.varianceAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {fmt(v.varianceAmount)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono ${v.variancePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {v.variancePercent >= 0 ? '+' : ''}{v.variancePercent.toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${
                                                        isOver ? 'bg-red-500' : ratio > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                                                    }`}
                                                    style={{ width: `${Math.min(ratio, 100)}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-zinc-600 mt-1 text-center">{ratio.toFixed(0)}%</p>
                                        </td>
                                    </tr>
                                );
                            })}
                            {variance.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-600">
                                        No variance data available. Ensure budget lines are created and transactions exist for the period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
