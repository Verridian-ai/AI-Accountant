import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Briefcase, Heart, AlertTriangle } from 'lucide-react';
import { taxApi } from '@/api';
import type { TaxReturnResult } from '@/api';
import { TaxReturnSummaryCard } from './TaxReturnSummaryCard';

const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function PersonalReturn({ year }: { year: string }) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<TaxReturnResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        taxApi.fetchPersonalReturn(year)
            .then(setData)
            .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
            .finally(() => setLoading(false));
    }, [year]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
                <span className="ml-2 text-zinc-400">Calculating personal return...</span>
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

    if (!data) return null;

    const refundOrOwing = data.netTaxPayableCents;
    const isRefund = refundOrOwing < 0;

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <TaxReturnSummaryCard
                    title="Salary & Wages"
                    value={formatCurrency(data.grossIncomeCents)}
                    icon={Briefcase}
                    variant="positive"
                />
                <TaxReturnSummaryCard
                    title="Deductions"
                    value={`-${formatCurrency(data.totalDeductionsCents)}`}
                    icon={User}
                />
                <TaxReturnSummaryCard
                    title="Medicare Levy"
                    value={formatCurrency(data.medicareLevyCents)}
                    icon={Heart}
                    variant="warning"
                />
                <TaxReturnSummaryCard
                    title={isRefund ? 'Estimated Refund' : 'Tax Payable'}
                    value={formatCurrency(Math.abs(refundOrOwing))}
                    subtitle={`Effective rate: ${formatPercent(data.effectiveRate)}`}
                    variant={isRefund ? 'positive' : 'negative'}
                />
            </div>

            {/* Income & Deductions Breakdown */}
            <Card className="neu-raised border-white/5">
                <CardHeader>
                    <CardTitle className="text-gradient-gold">Income & Deductions</CardTitle>
                    <CardDescription>Personal Tax Return — FY {year}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {Object.entries(data.breakdown).map(([key, value]) => (
                            <div key={key} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                                <span className="text-zinc-400 capitalize">{key.replace(/_/g, ' ')}</span>
                                <span className={`font-medium ${value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {formatCurrency(Math.abs(value))}
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Tax Calculation */}
            <Card className="neu-raised border-white/5">
                <CardHeader>
                    <CardTitle>Tax Payable / Refund</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-zinc-400">Income Tax on Taxable Income</span>
                            <span className="font-medium">{formatCurrency(data.incomeTaxCents)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-400">Medicare Levy</span>
                            <span className="font-medium">{formatCurrency(data.medicareLevyCents)}</span>
                        </div>
                        {data.taxOffsetsCents > 0 && (
                            <div className="flex justify-between text-emerald-400">
                                <span>Tax Offsets (LITO)</span>
                                <span className="font-medium">-{formatCurrency(data.taxOffsetsCents)}</span>
                            </div>
                        )}
                        <div className="border-t border-white/10 pt-3 flex justify-between font-bold text-lg">
                            <span>{isRefund ? 'Estimated Refund' : 'Amount Owing'}</span>
                            <span className={isRefund ? 'text-emerald-400' : 'text-red-400'}>
                                {formatCurrency(Math.abs(refundOrOwing))}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {data.warnings.length > 0 && (
                <Card className="border-amber-500/20 neu-raised">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-400">
                            <AlertTriangle className="w-5 h-5" />
                            Notices
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2">
                            {data.warnings.map((w, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                                    <Badge variant="outline" className="shrink-0 mt-0.5 border-amber-500/30 text-amber-400">!</Badge>
                                    {w}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
