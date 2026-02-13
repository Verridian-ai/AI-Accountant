import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { reportsApi } from '@/api';
import type { ProfitAndLossReport, CategoryGroup } from '@/api';

const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

interface Props {
    periodStart: string;
    periodEnd: string;
    accountId?: string;
}

function CategoryTable({ title, items, total, colorClass }: {
    title: string;
    items: CategoryGroup[];
    total: number;
    colorClass: string;
}) {
    return (
        <div className="neu-raised rounded-2xl p-5">
            <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${colorClass}`}>{title}</h3>
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-zinc-500 border-b border-white/5">
                        <th className="text-left pb-2 font-medium">Category</th>
                        <th className="text-right pb-2 font-medium">Amount</th>
                        <th className="text-right pb-2 font-medium">Txns</th>
                        <th className="text-right pb-2 font-medium">%</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr key={item.category} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-2 text-zinc-200">{item.category}</td>
                            <td className={`py-2 text-right font-mono ${colorClass}`}>{formatCurrency(item.amount)}</td>
                            <td className="py-2 text-right text-zinc-400">{item.transactionCount}</td>
                            <td className="py-2 text-right text-zinc-400">
                                {total > 0 ? ((item.amount / total) * 100).toFixed(1) : '0.0'}%
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="border-t border-[#FFCC00]/20">
                        <td className="pt-3 font-bold text-zinc-100">Total</td>
                        <td className={`pt-3 text-right font-bold font-mono ${colorClass}`}>{formatCurrency(total)}</td>
                        <td className="pt-3 text-right text-zinc-400">{items.reduce((s, i) => s + i.transactionCount, 0)}</td>
                        <td className="pt-3 text-right text-zinc-400">100%</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

export function ProfitAndLoss({ periodStart, periodEnd, accountId }: Props) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ProfitAndLossReport | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!periodStart || !periodEnd) return;
        setLoading(true);
        setError(null);
        reportsApi.fetchPnL(periodStart, periodEnd, accountId)
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [periodStart, periodEnd, accountId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[#FFCC00]" />
                <span className="ml-3 text-zinc-400">Generating P&L report...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="neu-inset rounded-2xl p-6 text-center">
                <p className="text-red-400">{error}</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="neu-inset rounded-2xl p-6 text-center text-zinc-500">
                Select a date range to generate the Profit & Loss statement.
            </div>
        );
    }

    const isProfit = data.netProfitOrLoss >= 0;

    return (
        <div className="space-y-6">
            {/* Summary Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Gross Revenue', value: data.grossRevenue, icon: TrendingUp, color: 'text-emerald-400' },
                    { label: 'Total Expenses', value: data.totalExpenses, icon: TrendingDown, color: 'text-red-400' },
                    { label: 'Net Profit/Loss', value: data.netProfitOrLoss, icon: DollarSign, color: isProfit ? 'text-emerald-400' : 'text-red-400' },
                    { label: 'Gross Margin', value: null, icon: DollarSign, color: 'text-[#FFCC00]' },
                ].map((item) => (
                    <div key={item.label} className="neu-raised rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="neu-inset p-1.5 rounded-lg">
                                <item.icon className={`h-4 w-4 ${item.color}`} />
                            </div>
                            <span className="text-xs text-zinc-500 font-medium uppercase tracking-wide">{item.label}</span>
                        </div>
                        <p className={`text-xl font-bold font-mono ${item.color}`}>
                            {item.value !== null ? formatCurrency(item.value) : `${(data.grossMargin * 100).toFixed(1)}%`}
                        </p>
                    </div>
                ))}
            </div>

            {/* Revenue & Expense Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CategoryTable
                    title="Revenue"
                    items={data.revenue}
                    total={data.grossRevenue}
                    colorClass="text-emerald-400"
                />
                <CategoryTable
                    title="Expenses"
                    items={data.expenses}
                    total={data.totalExpenses}
                    colorClass="text-red-400"
                />
            </div>

            {/* Net Result Banner */}
            <div className={`neu-raised rounded-2xl p-5 border ${isProfit ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
                <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-zinc-100">
                        {isProfit ? 'Net Profit' : 'Net Loss'}
                    </span>
                    <span className={`text-2xl font-bold font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(Math.abs(data.netProfitOrLoss))}
                    </span>
                </div>
            </div>
        </div>
    );
}
