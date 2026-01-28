import { useMemo, useRef, useLayoutEffect } from 'react';
import type { Transaction } from '@/api';
import { Activity, Zap, BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import './MonthlyTrendChart.css';

interface MonthlyTrendChartProps {
    transactions: Transaction[];
    title?: string;
    loading?: boolean;
}

const TrendBar = ({ height }: { height: number }) => {
    const barRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (barRef.current) {
            barRef.current.style.setProperty('--bar-height', `${height}%`);
        }
    }, [height]);

    return (
        <div ref={barRef} className="monthly-trend-bar">
            <div className="monthly-trend-bar-overlay" />
        </div>
    );
};

export function MonthlyTrendChart({ transactions, title = 'Temporal Pulse', loading = false }: MonthlyTrendChartProps) {
    const monthlyData = useMemo(() => {
        const groups: Record<string, number> = {};

        // Filter for expenses and group by month
        transactions
            .filter(t => t.amount < 0)
            .forEach(t => {
                const month = t.date.substring(0, 7); // YYYY-MM
                groups[month] = (groups[month] || 0) + Math.abs(t.amount);
            });

        return Object.entries(groups)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, amount]) => ({
                month,
                amount,
                label: new Date(month + '-01').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
            }));
    }, [transactions]);

    const maxAmount = useMemo(() => {
        return Math.max(...monthlyData.map(d => d.amount), 1);
    }, [monthlyData]);

    const skeletonHeights = useMemo(() => {
        return [45, 72, 30, 85, 55, 60];
    }, []);

    const formatAmount = (cents: number) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            maximumFractionDigits: 0,
        }).format(cents / 100);
    };

    if (loading) {
        return (
            <div className="neu-raised rounded-3xl p-6 border border-white/5 flex flex-col group">
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-11 w-11 rounded-2xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                    </div>
                    <Skeleton className="h-8 w-24 rounded-full" />
                </div>

                <div className="flex items-end justify-between gap-3 h-40 px-2">
                    {skeletonHeights.map((height, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-3">
                            <Skeleton
                                className="w-full rounded-xl"
                                style={{ height: `${height}%` }}
                            />
                            <Skeleton className="h-3 w-8" />
                        </div>
                    ))}
                </div>

                <div className="mt-8 pt-5 border-t border-white/5 flex items-center justify-between px-1">
                    <div className="space-y-2">
                        <Skeleton className="h-2 w-16" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-2 w-12" />
                        <Skeleton className="h-4 w-10" />
                    </div>
                </div>
            </div>
        );
    }

    if (monthlyData.length === 0) {
        return (
            <div className="neu-raised rounded-3xl p-8 border border-white/5 group">
                <div className="flex items-center gap-4 mb-6">
                    <div className="neu-inset p-3 rounded-xl text-zinc-700">
                        <BarChart3 className="h-5 w-5" />
                    </div>
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">{title}</h3>
                </div>
                <div className="py-12 text-center">
                    <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">No oscillation data detected</p>
                </div>
            </div>
        );
    }

    return (
        <div className="neu-raised rounded-3xl p-6 border border-white/5 flex flex-col group">
            <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                    <div className="neu-inset p-3 rounded-2xl text-red-400 group-hover:glow-danger transition-all duration-500">
                        <Activity className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-zinc-100 uppercase tracking-[0.2em] leading-none">{title}</h3>
                        <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                            <Zap className="w-2.5 h-2.5 text-red-500" /> Flux Gradient
                        </p>
                    </div>
                </div>
                <div className="neu-inset px-3 py-1.5 rounded-full flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">Monitoring</span>
                </div>
            </div>

            <div className="flex items-end justify-between gap-3 h-40 px-2">
                {monthlyData.map((d) => {
                    const height = (d.amount / maxAmount) * 100;
                    return (
                        <div key={d.month} className="flex-1 flex flex-col items-center gap-3 group/bar relative">
                            {/* Augmented Tooltip */}
                            <div className="absolute bottom-full mb-4 opacity-0 group-hover/bar:opacity-100 transition-all duration-300 pointer-events-none transform translate-y-2 group-hover/bar:translate-y-0 z-20">
                                <div className="neu-raised-sm bg-[#12121a] border border-white/10 p-3 rounded-2xl shadow-2xl">
                                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">{d.label} Data</p>
                                    <p className="text-sm font-black text-red-400 tracking-tighter">{formatAmount(d.amount)}</p>
                                </div>
                                <div className="w-3 h-3 bg-[#12121a] rotate-45 border-r border-b border-white/10 mx-auto -mt-1.5" />
                            </div>

                            <div className="w-full neu-inset rounded-xl flex items-end h-full p-1 overflow-hidden group-hover/bar:border-red-500/20 transition-all">
                                <TrendBar height={height} />
                            </div>
                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest transition-colors group-hover/bar:text-zinc-300">
                                {d.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 pt-5 border-t border-white/5 flex items-center justify-between px-1">
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Peak Amplitude</span>
                    <span className="text-xs font-bold text-zinc-400 tracking-tight">{formatAmount(maxAmount)}</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Intervals</span>
                        <span className="text-xs font-bold text-zinc-400 tracking-tight">{monthlyData.length} MO</span>
                    </div>
                </div>
            </div>
        </div>
    );
}