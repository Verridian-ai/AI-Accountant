import { useState } from 'react';
import { api, type DebtRecommendations, type DebtStrategy } from '@/api';
import { TrendingDown, DollarSign, Calendar, Loader2, AlertCircle, ChevronDown, Sparkles, Target, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function DebtReductionPlanner() {
    const [monthlyBudget, setMonthlyBudget] = useState<string>('500');
    const [recommendations, setRecommendations] = useState<DebtRecommendations | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);

    const handleAnalyze = async () => {
        const budget = parseFloat(monthlyBudget);
        if (isNaN(budget) || budget <= 0) {
            setError('Please enter a valid monthly budget');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const result = await api.fetchDebtRecommendations(budget);
            setRecommendations(result);
        } catch {
            setError('Failed to analyze debt. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
    };

    const renderStrategy = (strategy: DebtStrategy | null, iconColor: string, borderColor: string, gradientFrom: string) => {
        if (!strategy) return null;
        const isExpanded = expandedStrategy === strategy.name;
        return (
            <div className={cn(
                "neu-raised-sm rounded-3xl overflow-hidden border transition-all duration-500",
                isExpanded ? "border-white/10 scale-[1.02] shadow-2xl" : borderColor,
                "hover:neu-float"
            )}>
                <button
                    type="button"
                    onClick={() => setExpandedStrategy(isExpanded ? null : strategy.name)}
                    className="w-full p-5 flex items-center justify-between text-left group"
                >
                    <div className="flex items-center gap-4">
                        <div className={cn("p-2.5 neu-inset rounded-xl", iconColor)}>
                            <Target className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className={cn("font-black uppercase tracking-widest text-sm", iconColor)}>{strategy.name}</h4>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight mt-0.5">{strategy.description}</p>
                        </div>
                    </div>
                    <div className={cn(
                        "p-2 rounded-xl neu-inset transition-transform duration-300",
                        isExpanded ? "rotate-180" : ""
                    )}>
                        <ChevronDown className="w-4 h-4 text-zinc-600" />
                    </div>
                </button>

                <div className="px-5 pb-5 grid grid-cols-3 gap-3">
                    <div className="text-center neu-inset rounded-2xl p-3 border border-white/5">
                        <Calendar className={cn("w-4 h-4 mx-auto mb-2 opacity-50", iconColor)} />
                        <p className="text-sm font-black text-zinc-100 tracking-tight">{strategy.totalMonths}</p>
                        <p className="text-[8px] text-zinc-600 uppercase tracking-[0.2em] font-black mt-1">Months</p>
                    </div>
                    <div className="text-center neu-inset rounded-2xl p-3 border border-white/5">
                        <DollarSign className={cn("w-4 h-4 mx-auto mb-2 opacity-50", iconColor)} />
                        <p className="text-sm font-black text-zinc-100 tracking-tight">{formatCurrency(strategy.monthlyPayment).split('.')[0]}</p>
                        <p className="text-[8px] text-zinc-600 uppercase tracking-[0.2em] font-black mt-1">Monthly</p>
                    </div>
                    <div className="text-center neu-inset rounded-2xl p-3 border border-white/5">
                        <TrendingDown className={cn("w-4 h-4 mx-auto mb-2 opacity-50", iconColor)} />
                        <p className="text-sm font-black text-zinc-100 tracking-tight">{formatCurrency(strategy.totalInterestPaid).split('.')[0]}</p>
                        <p className="text-[8px] text-zinc-600 uppercase tracking-[0.2em] font-black mt-1">Interest</p>
                    </div>
                </div>

                {isExpanded && strategy.payoffOrder.length > 0 && (
                    <div className="px-5 pb-5 pt-2 border-t border-white/5 bg-black/20 animate-in slide-in-from-top-2">
                        <h5 className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4 text-center">Liquidation Sequence</h5>
                        <div className="space-y-2">
                            {strategy.payoffOrder.map((account, idx) => (
                                <div key={account.accountId} className="flex items-center justify-between text-xs neu-inset rounded-xl p-3 border border-white/5 hover:bg-white/2 transition-colors">
                                    <span className="flex items-center gap-3 text-zinc-200 font-bold uppercase tracking-tight">
                                        <span className={cn(
                                            "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-[#0a0a0f] shadow-lg",
                                            "bg-linear-to-br",
                                            gradientFrom
                                        )}>
                                            {idx + 1}
                                        </span>
                                        {account.accountName}
                                    </span>
                                    <span className="text-zinc-500 font-black font-mono text-[10px]">{account.monthsToPayoff} MO</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="neu-raised rounded-[2.5rem] p-6 border border-white/5 flex flex-col group">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="neu-inset p-3 rounded-2xl text-emerald-400 group-hover:glow-success transition-all duration-500">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-zinc-100 uppercase tracking-[0.2em] leading-none">Strategic Planner</h3>
                        <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-[#FFCC00]" /> Debt Neutralization AI
                        </p>
                    </div>
                </div>
                <div className="neu-inset px-3 py-1.5 rounded-full flex items-center gap-2">
                    <Zap className="w-2.5 h-2.5 text-[#FFCC00] animate-pulse" />
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest italic">Optimizing</span>
                </div>
            </div>

            <div className="space-y-6">
                <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase text-zinc-600 tracking-[0.25em] ml-1">Quantum Allocation Budget ($)</label>
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-black text-xs">$</span>
                            <input
                                type="number"
                                value={monthlyBudget}
                                onChange={(e) => setMonthlyBudget(e.target.value)}
                                className="w-full pl-8 pr-4 py-4 neu-inset rounded-2xl focus-gold outline-none text-[#FFCC00] font-black text-sm transition-all"
                                placeholder="500"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleAnalyze}
                            disabled={loading}
                            className="px-6 py-4 cba-gold-gradient text-[#0a0a0f] font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl btn-press disabled:opacity-50 shadow-lg cba-gold-glow flex items-center justify-center min-w-[120px]"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Run Analysis'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-3 text-red-400 p-4 neu-inset rounded-2xl border border-red-500/20 animate-in slide-in-from-left-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{error}</span>
                    </div>
                )}

                {loading && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="p-5 rounded-3xl neu-raised-sm border border-white/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Skeleton className="h-10 w-10 rounded-xl" />
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-3 w-48" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-8 w-8 rounded-xl" />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <Skeleton className="h-16 rounded-2xl" />
                                    <Skeleton className="h-16 rounded-2xl" />
                                    <Skeleton className="h-16 rounded-2xl" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!loading && recommendations?.message && !recommendations.aggressive && (
                    <div className="text-center py-12 neu-inset rounded-3xl border border-white/5">
                        <div className="w-16 h-16 neu-inset rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <TrendingDown className="w-8 h-8 text-zinc-800" />
                        </div>
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-tight max-w-[200px] mx-auto leading-relaxed">
                            {recommendations.message}
                        </p>
                    </div>
                )}

                {!loading && recommendations && (recommendations.aggressive || recommendations.moderate || recommendations.minimum) && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        {renderStrategy(recommendations.aggressive, 'text-red-400', 'border-red-500/10', 'from-red-600 to-red-400')}
                        {renderStrategy(recommendations.moderate, 'text-amber-400', 'border-amber-500/10', 'from-amber-600 to-amber-400')}
                        {renderStrategy(recommendations.minimum, 'text-blue-400', 'border-blue-500/10', 'from-blue-600 to-blue-400')}
                    </div>
                )}
            </div>

            {/* Footer metadata */}
            <div className="mt-auto pt-6 flex items-center justify-between px-1">
                <span className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.3em]">Module: Debt_Redux_v4.2</span>
                <div className="flex -space-x-1.5">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full border border-zinc-900 bg-zinc-800" />
                    ))}
                </div>
            </div>
        </div>
    );
}