import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { gstApi } from '@/api';
import type { BASComparisonData } from '@/features/gst/types';

const BAS_LABELS: Record<string, string> = {
    G1: 'Total Sales',
    G2: 'Export Sales',
    G3: 'GST-Free Sales',
    G4: 'Input Taxed Sales',
    G9: 'GST on Sales',
    G10: 'Capital Purchases',
    G11: 'Non-Capital Purchases',
    G19: 'GST Credits',
    G20: 'Net GST',
    '1A': 'GST on Sales',
    '1B': 'GST on Purchases',
    W1: 'Gross Wages',
    W2: 'Amounts Withheld',
};

const generateQuarters = (): { value: string; label: string }[] => {
    const options = [];
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= currentYear - 2; year--) {
        for (let q = 4; q >= 1; q--) {
            options.push({
                value: `${year}-Q${q}`,
                label: `Q${q} FY ${year}-${(year + 1).toString().slice(2)}`,
            });
        }
    }
    return options;
};

function VarianceCell({ change, variance }: { change: number; variance: number }) {
    const absVariance = Math.abs(variance);
    let color = 'text-zinc-300';
    if (absVariance > 50) color = 'text-red-400';
    else if (absVariance > 20) color = 'text-amber-400';

    return (
        <div className="flex items-center gap-1.5 justify-end">
            {change > 0 ? (
                <TrendingUp className={`w-3 h-3 ${color}`} />
            ) : change < 0 ? (
                <TrendingDown className={`w-3 h-3 ${color}`} />
            ) : (
                <Minus className="w-3 h-3 text-zinc-600" />
            )}
            <span className={`text-xs font-medium ${color}`}>
                {variance === 0 ? '-' : `${variance > 0 ? '+' : ''}${variance.toFixed(1)}%`}
            </span>
        </div>
    );
}

export function BASComparison() {
    const [quarterA, setQuarterA] = useState('');
    const [quarterB, setQuarterB] = useState('');
    const [data, setData] = useState<BASComparisonData | null>(null);
    const [loading, setLoading] = useState(false);
    const quarters = generateQuarters();

    useEffect(() => {
        const first = quarters[0];
        const second = quarters[1];
        if (first && second) {
            setQuarterA(first.value);
            setQuarterB(second.value);
        }
    }, []);

    useEffect(() => {
        if (quarterA && quarterB && quarterA !== quarterB) {
            loadComparison();
        }
    }, [quarterA, quarterB]);

    const loadComparison = async () => {
        setLoading(true);
        try {
            const result = await gstApi.fetchBASComparison(quarterA, quarterB);
            setData(result);
        } catch (err) {
            console.error('Failed to load comparison:', err);
        } finally {
            setLoading(false);
        }
    };

    const getVariance = (a: number, b: number): { change: number; variance: number } => {
        const change = a - b;
        const variance = b === 0 ? (a === 0 ? 0 : 100) : ((a - b) / Math.abs(b)) * 100;
        return { change, variance };
    };

    const allLabels = data
        ? Array.from(new Set([
            ...Object.keys(data.periodA.labels),
            ...Object.keys(data.periodB.labels),
        ])).sort()
        : [];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">BAS Comparison</h3>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
                <Select value={quarterA} onValueChange={setQuarterA}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Period A" />
                    </SelectTrigger>
                    <SelectContent>
                        {quarters.map(q => (
                            <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <span className="text-zinc-500 text-sm">vs</span>

                <Select value={quarterB} onValueChange={setQuarterB}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Period B" />
                    </SelectTrigger>
                    <SelectContent>
                        {quarters.map(q => (
                            <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <Card className="neu-raised rounded-xl">
                    <CardContent className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
                    </CardContent>
                </Card>
            ) : data ? (
                <Card className="neu-raised rounded-xl">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Label Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-0.5">
                            {/* Header */}
                            <div className="grid grid-cols-5 gap-2 text-xs text-zinc-500 pb-2 border-b border-white/5">
                                <span>Label</span>
                                <span className="text-right">{data.periodA.quarter}</span>
                                <span className="text-right">{data.periodB.quarter}</span>
                                <span className="text-right">Change</span>
                                <span className="text-right">Variance</span>
                            </div>

                            {allLabels.map(label => {
                                const valA = data.periodA.labels[label] || 0;
                                const valB = data.periodB.labels[label] || 0;
                                const { change, variance } = getVariance(valA, valB);
                                const absVariance = Math.abs(variance);

                                return (
                                    <div
                                        key={label}
                                        className={`grid grid-cols-5 gap-2 py-2 px-2 rounded-lg text-sm items-center ${
                                            absVariance > 50 ? 'bg-red-500/5' : absVariance > 20 ? 'bg-amber-500/5' : ''
                                        }`}
                                    >
                                        <div>
                                            <span className="font-mono text-xs text-[#FFCC00] mr-2">{label}</span>
                                            <span className="text-xs text-zinc-500">{BAS_LABELS[label] || ''}</span>
                                        </div>
                                        <span className="text-right font-medium">{formatCurrency(valA)}</span>
                                        <span className="text-right font-medium">{formatCurrency(valB)}</span>
                                        <span className={`text-right text-xs ${change > 0 ? 'text-emerald-400' : change < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                                            {change === 0 ? '-' : formatCurrency(change)}
                                        </span>
                                        <VarianceCell change={change} variance={variance} />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-4 text-[10px] text-zinc-600">
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500/30" /> &gt;20% variance
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-500/30" /> &gt;50% variance
                            </span>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="neu-raised rounded-xl">
                    <CardContent className="text-center py-12 text-zinc-500">
                        Select two periods to compare
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
