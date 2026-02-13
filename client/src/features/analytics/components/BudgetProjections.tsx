import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { analyticsApi } from '@/api';
import type { ProjectionResult } from '@/api';

const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function BudgetProjections() {
    const [loading, setLoading] = useState(false);
    const [revenue, setRevenue] = useState<ProjectionResult | null>(null);
    const [expenses, setExpenses] = useState<ProjectionResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        Promise.all([
            analyticsApi.projectRevenue('sole_trader', 6),
            analyticsApi.projectExpenses('sole_trader', 6),
        ])
            .then(([rev, exp]) => {
                setRevenue(rev);
                setExpenses(exp);
            })
            .catch(err => setError(err instanceof Error ? err.message : 'Failed to load projections'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
                <span className="ml-2 text-zinc-400">Generating projections...</span>
            </div>
        );
    }

    if (error) {
        return (
            <Card className="border-red-500/20">
                <CardContent className="pt-6"><p className="text-red-400">{error}</p></CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-2">
                {revenue && (
                    <Card className="neu-raised border-white/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                Revenue Trend
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-400">
                                {formatCurrency(revenue.averageMonthly)}<span className="text-sm text-zinc-500">/mo</span>
                            </div>
                            <Badge variant="outline" className={`mt-2 ${revenue.growthRate >= 0 ? 'text-emerald-400 border-emerald-500/20' : 'text-red-400 border-red-500/20'}`}>
                                {revenue.growthRate >= 0 ? '+' : ''}{formatPercent(revenue.growthRate)} monthly
                            </Badge>
                        </CardContent>
                    </Card>
                )}
                {expenses && (
                    <Card className="neu-raised border-white/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                <TrendingDown className="w-4 h-4 text-red-400" />
                                Expense Trend
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-400">
                                {formatCurrency(expenses.averageMonthly)}<span className="text-sm text-zinc-500">/mo</span>
                            </div>
                            <Badge variant="outline" className={`mt-2 ${expenses.growthRate >= 0 ? 'text-red-400 border-red-500/20' : 'text-emerald-400 border-emerald-500/20'}`}>
                                {expenses.growthRate >= 0 ? '+' : ''}{formatPercent(expenses.growthRate)} monthly
                            </Badge>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Revenue Projections */}
            {revenue && revenue.projections.length > 0 && (
                <Card className="neu-raised border-white/5">
                    <CardHeader>
                        <CardTitle className="text-gradient-gold">Revenue Projections</CardTitle>
                        <CardDescription>{revenue.monthsProjected}-month forecast with confidence bands</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="grid grid-cols-4 text-xs font-bold text-zinc-500 uppercase pb-2 border-b border-white/5">
                                <span>Month</span>
                                <span className="text-right">Lower</span>
                                <span className="text-right">Projected</span>
                                <span className="text-right">Upper</span>
                            </div>
                            {revenue.projections.map(p => (
                                <div key={p.month} className="grid grid-cols-4 text-sm py-1.5 border-b border-white/5 last:border-0">
                                    <span className="text-zinc-400">{p.month}</span>
                                    <span className="text-right text-zinc-500">{formatCurrency(p.lowerBound)}</span>
                                    <span className="text-right font-medium text-emerald-400">{formatCurrency(p.projected)}</span>
                                    <span className="text-right text-zinc-500">{formatCurrency(p.upperBound)}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Expense Projections */}
            {expenses && expenses.projections.length > 0 && (
                <Card className="neu-raised border-white/5">
                    <CardHeader>
                        <CardTitle>Expense Projections</CardTitle>
                        <CardDescription>{expenses.monthsProjected}-month forecast with confidence bands</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="grid grid-cols-4 text-xs font-bold text-zinc-500 uppercase pb-2 border-b border-white/5">
                                <span>Month</span>
                                <span className="text-right">Lower</span>
                                <span className="text-right">Projected</span>
                                <span className="text-right">Upper</span>
                            </div>
                            {expenses.projections.map(p => (
                                <div key={p.month} className="grid grid-cols-4 text-sm py-1.5 border-b border-white/5 last:border-0">
                                    <span className="text-zinc-400">{p.month}</span>
                                    <span className="text-right text-zinc-500">{formatCurrency(p.lowerBound)}</span>
                                    <span className="text-right font-medium text-red-400">{formatCurrency(p.projected)}</span>
                                    <span className="text-right text-zinc-500">{formatCurrency(p.upperBound)}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
