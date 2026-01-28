import { cn } from '@/lib/utils';
import { getCategoryColor } from '@/utils/categoryColors';
import { PieChart, TrendingUp, Zap, ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import './CategoryChart.css';

interface CategoryChartProps {
    data: Record<string, number>;
    title?: string;
    loading?: boolean;
}



export function CategoryChart({ data, title = 'Allocation Matrix', loading = false }: CategoryChartProps) {
    const entries = Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    const barRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        if (!loading) {
            entries.forEach(([, amount], index) => {
                const percentage = total > 0 ? (amount / total) * 100 : 0;
                const barElement = barRefs.current[index];
                if (barElement) {
                    barElement.style.setProperty('--bar-width', `${percentage}%`);
                }
            });
        }
    }, [entries, total, loading]);

    if (loading) {
        return (
            <div className="neu-raised rounded-3xl p-6 border border-white/5 flex flex-col group">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-11 w-11 rounded-2xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                    </div>
                    <Skeleton className="h-8 w-16 rounded-full" />
                </div>

                <div className="space-y-5">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-1.5 w-1.5 rounded-full" />
                                    <Skeleton className="h-3 w-24 rounded" />
                                </div>
                                <Skeleton className="h-3 w-16 rounded" />
                            </div>
                            <Skeleton className="h-3 w-full rounded-full" />
                        </div>
                    ))}
                </div>

                <div className="mt-8 pt-5 border-t border-white/5 flex items-center justify-between px-1">
                    <div className="space-y-2">
                        <Skeleton className="h-2 w-16" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-xl" />
                </div>
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="neu-raised rounded-3xl p-8 border border-white/5">
                <div className="flex items-center gap-3 mb-6">
                    <div className="neu-inset p-3 rounded-xl">
                        <PieChart className="h-5 w-5 text-zinc-700" />
                    </div>
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">{title}</h3>
                </div>
                <div className="py-12 text-center">
                    <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">No telemetry data active</p>
                </div>
            </div>
        );
    }

    const formatAmount = (cents: number) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
        }).format(Math.abs(cents) / 100);
    };

    return (
        <div className="neu-raised rounded-3xl p-6 border border-white/5 flex flex-col group">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="neu-inset p-3 rounded-2xl text-[#FFCC00] group-hover:glow-success transition-all duration-500">
                        <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-zinc-100 uppercase tracking-[0.2em] leading-none">{title}</h3>
                        <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                            <Zap className="w-2.5 h-2.5" /> Sector Analysis
                        </p>
                    </div>
                </div>
                <div className="neu-inset px-3 py-1.5 rounded-full">
                    <span className="text-[10px] font-black text-[#FFCC00] uppercase tracking-widest italic">Live</span>
                </div>
            </div>

            <div className="space-y-5">
                {entries.map(([category, amount]) => {
                    const color = getCategoryColor(category) ?? { gradient: 'from-zinc-500 to-zinc-400', dot: 'bg-zinc-500' };
                    return (
                        <div key={category} className="space-y-2.5 group/item">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-zinc-400 font-bold text-[11px] uppercase tracking-tight truncate max-w-[60%] flex items-center gap-2 group-hover/item:text-zinc-100 transition-colors">
                                    <span className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]", color.dot)} />
                                    {category}
                                </span>
                                <span className="text-zinc-500 font-black font-mono text-[10px] tracking-tighter group-hover/item:text-[#FFCC00] transition-colors">
                                    {formatAmount(amount)}
                                </span>
                            </div>
                            <div className="h-3 neu-inset rounded-full p-0.5 overflow-hidden border border-white/2">
                                <div
                                    ref={(el) => { barRefs.current[entries.findIndex(([c]) => c === category)] = el; }}
                                    className={cn(
                                        "h-full rounded-full transition-all duration-1000 ease-out bg-linear-to-r relative category-bar",
                                        color.gradient
                                    )}
                                >
                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 pt-5 border-t border-white/5 flex items-center justify-between px-1">
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Gross Flux</span>
                    <span className="text-sm font-black text-[#FFCC00] tracking-tighter">{formatAmount(total)}</span>
                </div>
                <button
                    type="button"
                    aria-label="View details"
                    className="p-2 neu-raised-sm rounded-xl text-zinc-500 hover:text-[#FFCC00] btn-press border border-white/5"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}