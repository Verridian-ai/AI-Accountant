import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
    Loader2,
    Calculator,
    FileText,
    History,
    DollarSign,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    RefreshCw,
    Save,
    Trash2,
    ChevronRight,
    BarChart3,
    ShieldCheck,
    AlertTriangle,
} from 'lucide-react';
import { basApi } from '@/api';
import type { BASCalculation, BASQuarter } from '@/types/tax';
import { Sparkline, CHART_COLORS } from '../../../components/charts';

const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
    }).format(cents / 100);
};

const formatCurrencyShort = (cents: number) => {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        maximumFractionDigits: 0,
    }).format(cents / 100);
};

const getCurrentQuarter = () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    // Australian financial year quarters
    if (month >= 6 && month <= 8) return { year, quarter: 1 }; // Jul-Sep
    if (month >= 9 && month <= 11) return { year, quarter: 2 }; // Oct-Dec
    if (month >= 0 && month <= 2) return { year: year - 1, quarter: 3 }; // Jan-Mar
    return { year: year - 1, quarter: 4 }; // Apr-Jun
};

export function BASDashboard() {
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [selectedQuarter, setSelectedQuarter] = useState<string>('');
    const [method, setMethod] = useState<'accrual' | 'cash'>('accrual');
    const [basData, setBASData] = useState<BASCalculation | null>(null);
    const [history, setHistory] = useState<BASQuarter[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'calculate' | 'breakdown' | 'history'>('calculate');

    useEffect(() => {
        loadHistory();
        // Set default quarter
        const { year, quarter } = getCurrentQuarter();
        setSelectedQuarter(`${year}-Q${quarter}`);
    }, []);

    // Auto-calculate when quarter changes
    useEffect(() => {
        if (selectedQuarter) {
            autoCalculate();
        }
    }, [selectedQuarter, method]);

    const autoCalculate = async () => {
        if (!selectedQuarter) return;
        setCalculating(true);
        setError(null);
        try {
            const data = await basApi.calculateBAS(selectedQuarter, method);
            setBASData(data);
        } catch (err) {
            // Silently fail on auto-calculate -- user can retry manually
            console.error('Auto-calculate BAS failed:', err);
        } finally {
            setCalculating(false);
        }
    };

    const loadHistory = async () => {
        try {
            const data = await basApi.fetchHistory();
            setHistory(data);
        } catch (err) {
            console.error('Failed to load BAS history:', err);
        }
    };

    const calculateBAS = async () => {
        if (!selectedQuarter) return;

        setCalculating(true);
        setError(null);

        try {
            const data = await basApi.calculateBAS(selectedQuarter, method);
            setBASData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to calculate BAS');
        } finally {
            setCalculating(false);
        }
    };

    const saveBAS = async () => {
        if (!selectedQuarter || !basData) return;

        setLoading(true);
        try {
            await basApi.saveBAS(selectedQuarter, basData);
            await loadHistory();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save BAS');
        } finally {
            setLoading(false);
        }
    };

    const generateQuarterOptions = () => {
        const options = [];
        const currentYear = new Date().getFullYear();

        for (let year = currentYear; year >= currentYear - 2; year--) {
            for (let q = 4; q >= 1; q--) {
                options.push({
                    value: `${year}-Q${q}`,
                    label: `Q${q} ${year}-${(year + 1).toString().slice(2)}`,
                    sublabel: getQuarterDates(year, q as 1 | 2 | 3 | 4),
                });
            }
        }

        return options;
    };

    const getQuarterDates = (year: number, quarter: 1 | 2 | 3 | 4) => {
        const periods = {
            1: `Jul-Sep ${year}`,
            2: `Oct-Dec ${year}`,
            3: `Jan-Mar ${year + 1}`,
            4: `Apr-Jun ${year + 1}`,
        };
        return periods[quarter];
    };

    // SVG bar chart data
    const barChartData = useMemo(() => {
        if (!basData) return null;
        const sales = basData.g1_total_sales;
        const purchases = basData.g12_g10_plus_g11;
        const max = Math.max(sales, purchases, 1);
        return { sales, purchases, max };
    }, [basData]);

    const isRefund = basData ? basData.net_amount_payable <= 0 : false;
    const netAmount = basData ? Math.abs(basData.net_amount_payable || basData.net_refund) : 0;

    return (
        <div className="space-y-4 sm:space-y-5">
            {/* Page Header */}
            <div className="flex flex-col gap-1">
                <h2 className="text-lg sm:text-xl font-black text-gradient-gold tracking-tight">
                    Business Activity Statement
                </h2>
                <p className="text-[10px] sm:text-[11px] text-zinc-500">
                    Calculate and manage your quarterly BAS returns for the ATO
                </p>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-1 neu-inset rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
                <button
                    type="button"
                    onClick={() => setActiveTab('calculate')}
                    className={cn(
                        "flex items-center gap-1.5 px-3 sm:px-4 py-2 min-h-[44px] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                        activeTab === 'calculate'
                            ? "bg-[#FFCC00] text-[#0a0a0f]"
                            : "text-zinc-500 hover:text-zinc-300"
                    )}
                >
                    <Calculator className="w-3.5 h-3.5" />
                    Calculate
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('breakdown')}
                    className={cn(
                        "flex items-center gap-1.5 px-3 sm:px-4 py-2 min-h-[44px] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                        activeTab === 'breakdown'
                            ? "bg-[#FFCC00] text-[#0a0a0f]"
                            : "text-zinc-500 hover:text-zinc-300"
                    )}
                >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">GST Breakdown</span>
                    <span className="sm:hidden">GST</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className={cn(
                        "flex items-center gap-1.5 px-3 sm:px-4 py-2 min-h-[44px] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                        activeTab === 'history'
                            ? "bg-[#FFCC00] text-[#0a0a0f]"
                            : "text-zinc-500 hover:text-zinc-300"
                    )}
                >
                    <History className="w-3.5 h-3.5" />
                    History
                </button>
            </div>

            {/* Calculate Tab */}
            {activeTab === 'calculate' && (
                <div className="space-y-5">
                    {/* Controls Row */}
                    <div className="neu-raised rounded-2xl border border-white/5 p-3 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-2">
                                <Calculator className="w-4 h-4 text-[#FFCC00]" />
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                                    BAS Period
                                </span>
                            </div>
                            <div className="flex gap-1 neu-inset rounded-xl p-1">
                                {(['accrual', 'cash'] as const).map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setMethod(m)}
                                        className={cn(
                                            "px-3 py-2 min-h-[44px] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                            method === m
                                                ? "bg-[#FFCC00] text-[#0a0a0f]"
                                                : "text-zinc-500 hover:text-zinc-300"
                                        )}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* Quarter Selector as pill buttons */}
                            <div className="flex-1 min-w-[200px]">
                                <div className="flex flex-wrap gap-1.5">
                                    {generateQuarterOptions().slice(0, 8).map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setSelectedQuarter(opt.value)}
                                            className={cn(
                                                "px-3 py-2 min-h-[44px] rounded-xl text-[10px] font-bold transition-all border",
                                                selectedQuarter === opt.value
                                                    ? "bg-[#FFCC00]/10 border-[#FFCC00]/30 text-[#FFCC00]"
                                                    : "border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10"
                                            )}
                                        >
                                            <span className="font-black">{opt.label}</span>
                                            <span className="ml-1 text-[8px] opacity-70">{opt.sublabel}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Calculate Button */}
                            <button
                                type="button"
                                onClick={calculateBAS}
                                disabled={calculating || !selectedQuarter}
                                className={cn(
                                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all",
                                    "bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFD633]",
                                    "disabled:opacity-40 disabled:cursor-not-allowed",
                                    "shadow-lg shadow-[#FFCC00]/10"
                                )}
                            >
                                {calculating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4" />
                                )}
                                Calculate
                            </button>
                        </div>
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div className="neu-raised rounded-2xl border border-red-500/20 p-4 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Loading State */}
                    {calculating && !basData && (
                        <div className="neu-raised rounded-2xl border border-white/5 p-12 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-[#FFCC00] animate-spin" />
                        </div>
                    )}

                    {basData && (
                        <>
                            {/* Net GST Position - Hero Card */}
                            <div
                                className={cn(
                                    "neu-raised rounded-2xl border-2 p-4 sm:p-6",
                                    isRefund ? "border-emerald-500/30" : "border-red-500/30"
                                )}
                            >
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={cn(
                                                "w-14 h-14 rounded-2xl flex items-center justify-center",
                                                isRefund
                                                    ? "bg-emerald-500/10 border border-emerald-500/20"
                                                    : "bg-red-500/10 border border-red-500/20"
                                            )}
                                        >
                                            <DollarSign
                                                className={cn(
                                                    "w-7 h-7",
                                                    isRefund ? "text-emerald-400" : "text-red-400"
                                                )}
                                            />
                                        </div>
                                        <div>
                                            <span
                                                className={cn(
                                                    "text-[10px] font-black uppercase tracking-[0.2em]",
                                                    isRefund ? "text-emerald-400" : "text-red-400"
                                                )}
                                            >
                                                {isRefund ? 'Refund Due' : 'Amount Payable'}
                                            </span>
                                            <div
                                                className={cn(
                                                    "text-2xl sm:text-3xl font-black tracking-tight",
                                                    isRefund ? "text-emerald-400" : "text-red-400"
                                                )}
                                            >
                                                {formatCurrency(netAmount)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* G9 vs G19 inline comparison */}
                                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center sm:justify-start">
                                        <div className="text-center">
                                            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">
                                                G9 Sales GST
                                            </p>
                                            <p className="text-lg font-black text-zinc-200 tabular-nums">
                                                {formatCurrencyShort(basData.g9_gst_on_sales)}
                                            </p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-zinc-600" />
                                        <div className="text-center">
                                            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">
                                                G19 Credits
                                            </p>
                                            <p className="text-lg font-black text-zinc-200 tabular-nums">
                                                {formatCurrencyShort(basData.g19_gst_credits)}
                                            </p>
                                        </div>
                                        <div className="w-px h-10 bg-white/5 mx-1" />
                                        <div className="text-center">
                                            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">
                                                G20 Net GST
                                            </p>
                                            <p
                                                className={cn(
                                                    "text-lg font-black tabular-nums",
                                                    isRefund ? "text-emerald-400" : "text-red-400"
                                                )}
                                            >
                                                {formatCurrencyShort(basData.g20_net_gst)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Cards - G9, G19, Net -- with inline sparklines */}
                            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-3">
                                <div className="neu-raised rounded-2xl border border-white/5 p-3 sm:p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                            GST on Sales (G9)
                                        </span>
                                        <Sparkline data={[820, 950, 870, 1100, 1050, 1200]} width={80} height={24} color={CHART_COLORS.primary} trend="up" />
                                    </div>
                                    <div className="text-2xl font-black text-zinc-200 tabular-nums">
                                        {formatCurrency(basData.g9_gst_on_sales)}
                                    </div>
                                    <p className="text-[10px] text-zinc-600 mt-1">
                                        Total taxable sales: {formatCurrencyShort(basData.g1_total_sales)}
                                    </p>
                                </div>

                                <div className="neu-raised rounded-2xl border border-white/5 p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                            GST Credits (G19)
                                        </span>
                                        <Sparkline data={[600, 550, 700, 620, 680, 750]} width={80} height={24} color={CHART_COLORS.axis} trend="up" />
                                    </div>
                                    <div className="text-2xl font-black text-zinc-200 tabular-nums">
                                        {formatCurrency(basData.g19_gst_credits)}
                                    </div>
                                    <p className="text-[10px] text-zinc-600 mt-1">
                                        Total purchases: {formatCurrencyShort(basData.g12_g10_plus_g11)}
                                    </p>
                                </div>

                                <div className="neu-raised rounded-2xl border border-white/5 p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                            {isRefund ? 'Refund Due' : 'Amount Payable'}
                                        </span>
                                        <Sparkline
                                            data={[220, 400, 170, 480, 370, 450]}
                                            width={80}
                                            height={24}
                                            color={isRefund ? CHART_COLORS.revenue : CHART_COLORS.expense}
                                            trend={isRefund ? 'down' : 'up'}
                                        />
                                    </div>
                                    <div
                                        className={cn(
                                            "text-2xl font-black tabular-nums",
                                            isRefund ? "text-emerald-400" : "text-red-400"
                                        )}
                                    >
                                        {formatCurrency(netAmount)}
                                    </div>
                                    <p className="text-[10px] text-zinc-600 mt-1">
                                        Net GST (G20): {formatCurrencyShort(basData.g20_net_gst)}
                                    </p>
                                </div>
                            </div>

                            {/* Sales vs Purchases Bar Chart */}
                            {barChartData && (
                                <div className="neu-raised rounded-2xl border border-white/5 p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <BarChart3 className="w-4 h-4 text-[#FFCC00]" />
                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                                            Sales vs Purchases
                                        </span>
                                    </div>
                                    <svg viewBox="0 0 400 120" className="w-full h-auto" style={{ maxHeight: 140 }}>
                                        {/* Labels */}
                                        <text x="10" y="35" fill="#71717a" className="text-[9px] font-bold" dominantBaseline="middle">
                                            G1 Sales
                                        </text>
                                        <text x="10" y="85" fill="#71717a" className="text-[9px] font-bold" dominantBaseline="middle">
                                            G10+G11
                                        </text>

                                        {/* Background tracks */}
                                        <rect x="80" y="20" width="280" height="28" rx="6" fill="rgba(255,255,255,0.03)" />
                                        <rect x="80" y="70" width="280" height="28" rx="6" fill="rgba(255,255,255,0.03)" />

                                        {/* Sales bar */}
                                        <rect
                                            x="80"
                                            y="20"
                                            width={Math.max((barChartData.sales / barChartData.max) * 280, 4)}
                                            height="28"
                                            rx="6"
                                            fill="#FFCC00"
                                            opacity={0.85}
                                        />
                                        <text
                                            x={Math.max((barChartData.sales / barChartData.max) * 280, 4) + 86}
                                            y="35"
                                            fill="#e4e4e7"
                                            className="text-[9px] font-black"
                                            dominantBaseline="middle"
                                        >
                                            {formatCurrencyShort(barChartData.sales)}
                                        </text>

                                        {/* Purchases bar */}
                                        <rect
                                            x="80"
                                            y="70"
                                            width={Math.max((barChartData.purchases / barChartData.max) * 280, 4)}
                                            height="28"
                                            rx="6"
                                            fill="#FFCC00"
                                            opacity={0.5}
                                        />
                                        <text
                                            x={Math.max((barChartData.purchases / barChartData.max) * 280, 4) + 86}
                                            y="85"
                                            fill="#e4e4e7"
                                            className="text-[9px] font-black"
                                            dominantBaseline="middle"
                                        >
                                            {formatCurrencyShort(barChartData.purchases)}
                                        </text>
                                    </svg>
                                </div>
                            )}

                            {/* GST Calculation Details */}
                            <div className="neu-raised rounded-2xl border border-white/5 p-5">
                                <div className="flex items-center gap-2 mb-5">
                                    <ShieldCheck className="w-4 h-4 text-[#FFCC00]" />
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                                        GST Calculation Details
                                    </span>
                                </div>

                                <div className="grid gap-6 md:grid-cols-2">
                                    {/* Sales Section */}
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#FFCC00]" />
                                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                                Sales
                                            </span>
                                        </div>
                                        <BASRow label="G1 - Total Sales" value={basData.g1_total_sales} />
                                        <BASRow label="G2 - Export Sales" value={basData.g2_export_sales} />
                                        <BASRow label="G3 - GST-Free Sales" value={basData.g3_gst_free_sales} />
                                        <BASRow label="G4 - Input Taxed Sales" value={basData.g4_input_taxed_sales} />
                                        <BASRow
                                            label="G9 - GST on Sales"
                                            value={basData.g9_gst_on_sales}
                                            highlight
                                        />
                                    </div>

                                    {/* Purchases Section */}
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#FFCC00]" />
                                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                                Purchases
                                            </span>
                                        </div>
                                        <BASRow
                                            label="G10 - Capital Purchases"
                                            value={basData.g10_capital_purchases}
                                        />
                                        <BASRow
                                            label="G11 - Non-Capital Purchases"
                                            value={basData.g11_non_capital_purchases}
                                        />
                                        <BASRow
                                            label="G12 - Total Purchases"
                                            value={basData.g12_g10_plus_g11}
                                        />
                                        <BASRow
                                            label="G19 - GST Credits"
                                            value={basData.g19_gst_credits}
                                            highlight
                                        />
                                    </div>

                                    {/* PAYG Section */}
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#FFCC00]" />
                                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                                PAYG Withholding
                                            </span>
                                        </div>
                                        <BASRow label="W1 - Gross Wages" value={basData.w1_gross_wages} />
                                        <BASRow
                                            label="W2 - Amounts Withheld"
                                            value={basData.w2_amounts_withheld}
                                        />
                                        <BASRow
                                            label="5A - PAYG Instalment"
                                            value={basData.payg_instalment_5a}
                                        />
                                    </div>

                                    {/* Other Section */}
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#FFCC00]" />
                                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                                Other
                                            </span>
                                        </div>
                                        <BASRow
                                            label="7C - Fuel Tax Credits"
                                            value={basData.fuel_tax_credits_7c}
                                        />
                                        <BASRow
                                            label="7D - Wine Equalisation"
                                            value={basData.wine_equalisation_7d}
                                        />
                                    </div>
                                </div>

                                {/* Net Summary Footer */}
                                <div className="mt-6 pt-4 border-t border-white/5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-black text-zinc-300 uppercase tracking-wider">
                                            Net Amount {isRefund ? 'Refundable' : 'Payable'}
                                        </span>
                                        <span
                                            className={cn(
                                                "text-xl font-black tabular-nums",
                                                isRefund ? "text-emerald-400" : "text-red-400"
                                            )}
                                        >
                                            {formatCurrency(netAmount)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* BAS Summary Grid (G1, G10, G11, 1A/1B) */}
                            <div className="neu-raised rounded-2xl border border-white/5 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <FileText className="w-4 h-4 text-[#FFCC00]" />
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                                        BAS Summary Labels
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                    <SummaryCell label="G1" title="Total Sales" value={basData.g1_total_sales} />
                                    <SummaryCell
                                        label="G10"
                                        title="Capital Purchases"
                                        value={basData.g10_capital_purchases}
                                    />
                                    <SummaryCell
                                        label="G11"
                                        title="Non-Capital"
                                        value={basData.g11_non_capital_purchases}
                                    />
                                    <SummaryCell
                                        label="1A"
                                        title="GST on Sales"
                                        value={basData.g9_gst_on_sales}
                                    />
                                    <SummaryCell
                                        label="1B"
                                        title="GST Credits"
                                        value={basData.g19_gst_credits}
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                                <button
                                    type="button"
                                    onClick={() => setBASData(null)}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-zinc-300 border border-white/5 hover:border-white/10 transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Clear
                                </button>
                                <button
                                    type="button"
                                    onClick={saveBAS}
                                    disabled={loading}
                                    className={cn(
                                        "flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                                        "bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFD633]",
                                        "disabled:opacity-40 disabled:cursor-not-allowed",
                                        "shadow-lg shadow-[#FFCC00]/10"
                                    )}
                                >
                                    {loading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Save className="w-3.5 h-3.5" />
                                    )}
                                    Save Draft
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* GST Breakdown Tab */}
            {activeTab === 'breakdown' && (
                <div className="space-y-5">
                    {!basData ? (
                        <div className="neu-raised rounded-2xl border border-white/5 p-12 text-center">
                            <BarChart3 className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                            <p className="text-sm text-zinc-500">
                                Calculate a BAS period first to see the GST breakdown.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* GST by BAS Category Bars */}
                            <div className="neu-raised rounded-2xl border border-white/5 p-5">
                                <div className="flex items-center gap-2 mb-5">
                                    <BarChart3 className="w-4 h-4 text-[#FFCC00]" />
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                                        GST by BAS Category
                                    </span>
                                </div>
                                <div className="space-y-4">
                                    <GSTBar
                                        label="G1 - Taxable Sales"
                                        amount={basData.g1_total_sales}
                                        total={Math.max(basData.g1_total_sales, basData.g12_g10_plus_g11, 1)}
                                        color="#FFCC00"
                                    />
                                    <GSTBar
                                        label="G2 - Export Sales"
                                        amount={basData.g2_export_sales}
                                        total={Math.max(basData.g1_total_sales, basData.g12_g10_plus_g11, 1)}
                                        color="#60A5FA"
                                    />
                                    <GSTBar
                                        label="G3 - GST-Free Sales"
                                        amount={basData.g3_gst_free_sales}
                                        total={Math.max(basData.g1_total_sales, basData.g12_g10_plus_g11, 1)}
                                        color="#34D399"
                                    />
                                    <GSTBar
                                        label="G10 - Capital Purchases"
                                        amount={basData.g10_capital_purchases}
                                        total={Math.max(basData.g1_total_sales, basData.g12_g10_plus_g11, 1)}
                                        color="#F472B6"
                                    />
                                    <GSTBar
                                        label="G11 - Non-Capital Purchases"
                                        amount={basData.g11_non_capital_purchases}
                                        total={Math.max(basData.g1_total_sales, basData.g12_g10_plus_g11, 1)}
                                        color="#A78BFA"
                                    />
                                </div>
                            </div>

                            {/* 1A vs 1B Comparison */}
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="neu-raised rounded-2xl border border-white/5 p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                            1A — GST Collected
                                        </span>
                                        <TrendingUp className="w-4 h-4 text-[#FFCC00]/40" />
                                    </div>
                                    <div className="text-3xl font-black text-[#FFCC00] tabular-nums mb-2">
                                        {formatCurrency(basData.g9_gst_on_sales)}
                                    </div>
                                    <p className="text-[10px] text-zinc-600">
                                        GST collected on taxable sales (G1 / 11)
                                    </p>
                                    <div className="mt-4 w-full h-2 rounded-full bg-[#1a1a2e]">
                                        <div
                                            className="h-2 rounded-full bg-[#FFCC00] transition-all duration-500"
                                            style={{
                                                width: `${basData.g1_total_sales > 0
                                                    ? Math.min((basData.g9_gst_on_sales / basData.g1_total_sales) * 100 * 11, 100)
                                                    : 0}%`,
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="neu-raised rounded-2xl border border-white/5 p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                            1B — Input Tax Credits
                                        </span>
                                        <TrendingDown className="w-4 h-4 text-emerald-500/40" />
                                    </div>
                                    <div className="text-3xl font-black text-emerald-400 tabular-nums mb-2">
                                        {formatCurrency(basData.g19_gst_credits)}
                                    </div>
                                    <p className="text-[10px] text-zinc-600">
                                        GST credits on eligible business purchases
                                    </p>
                                    <div className="mt-4 w-full h-2 rounded-full bg-[#1a1a2e]">
                                        <div
                                            className="h-2 rounded-full bg-emerald-400 transition-all duration-500"
                                            style={{
                                                width: `${basData.g12_g10_plus_g11 > 0
                                                    ? Math.min((basData.g19_gst_credits / basData.g12_g10_plus_g11) * 100 * 11, 100)
                                                    : 0}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* BAS Pre-Fill Summary */}
                            <div className="neu-raised rounded-2xl border border-[#FFCC00]/10 p-5">
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-[#FFCC00]" />
                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                                            BAS Pre-Fill Summary
                                        </span>
                                    </div>
                                    <span className="text-[9px] text-zinc-600">
                                        Ready for lodgement review
                                    </span>
                                </div>

                                <div className="grid gap-2 md:grid-cols-2">
                                    <div className="flex justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                                        <span className="text-[11px] font-bold text-zinc-400">1A — GST on sales</span>
                                        <span className="text-[11px] font-black text-zinc-200 tabular-nums">
                                            {formatCurrency(basData.g9_gst_on_sales)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                                        <span className="text-[11px] font-bold text-zinc-400">1B — GST on purchases</span>
                                        <span className="text-[11px] font-black text-zinc-200 tabular-nums">
                                            {formatCurrency(basData.g19_gst_credits)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                                        <span className="text-[11px] font-bold text-zinc-400">W2 — PAYG withheld</span>
                                        <span className="text-[11px] font-black text-zinc-200 tabular-nums">
                                            {formatCurrency(basData.w2_amounts_withheld)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                                        <span className="text-[11px] font-bold text-zinc-400">5A — PAYG instalment</span>
                                        <span className="text-[11px] font-black text-zinc-200 tabular-nums">
                                            {formatCurrency(basData.payg_instalment_5a)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                                        <span className="text-[11px] font-bold text-zinc-400">7C — Fuel tax credits</span>
                                        <span className="text-[11px] font-black text-zinc-200 tabular-nums">
                                            {formatCurrency(basData.fuel_tax_credits_7c)}
                                        </span>
                                    </div>
                                    <div className={cn(
                                        "flex justify-between p-2.5 rounded-xl border",
                                        isRefund
                                            ? "bg-emerald-500/5 border-emerald-500/20"
                                            : "bg-red-500/5 border-red-500/20"
                                    )}>
                                        <span className={cn(
                                            "text-[11px] font-black",
                                            isRefund ? "text-emerald-400" : "text-red-400"
                                        )}>
                                            Net {isRefund ? 'Refund' : 'Payable'}
                                        </span>
                                        <span className={cn(
                                            "text-[11px] font-black tabular-nums",
                                            isRefund ? "text-emerald-400" : "text-red-400"
                                        )}>
                                            {formatCurrency(netAmount)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <History className="w-4 h-4 text-[#FFCC00]" />
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                            BAS History
                        </span>
                    </div>

                    {history.length === 0 ? (
                        <div className="neu-raised rounded-2xl border border-white/5 p-12 text-center">
                            <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                            <p className="text-sm text-zinc-500">
                                No BAS history found. Calculate your first BAS to get started.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {history.map((item) => (
                                <div
                                    key={item.id}
                                    className="neu-raised rounded-2xl border border-white/5 p-4 flex items-center justify-between group hover:border-[#FFCC00]/10 transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center">
                                            <span className="text-[11px] font-black text-[#FFCC00]">
                                                Q{item.quarter}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-zinc-200">
                                                Q{item.quarter} {item.year}-
                                                {(item.year + 1).toString().slice(2)}
                                            </p>
                                            <p className="text-[10px] text-zinc-600">
                                                {item.startDate} - {item.endDate}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-[9px] font-black uppercase tracking-wider border",
                                                item.status === 'lodged'
                                                    ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                                                    : item.status === 'draft'
                                                    ? "border-[#FFCC00]/30 text-[#FFCC00] bg-[#FFCC00]/5"
                                                    : "border-white/10 text-zinc-500"
                                            )}
                                        >
                                            {item.status}
                                        </Badge>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedQuarter(
                                                    `${item.year}-Q${item.quarter}`
                                                );
                                                setActiveTab('calculate');
                                                calculateBAS();
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-[10px] font-bold text-zinc-500 hover:text-[#FFCC00] transition-all"
                                        >
                                            <FileText className="w-3.5 h-3.5" />
                                            View
                                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* -------- Sub-components -------- */

function BASRow({
    label,
    value,
    highlight = false,
}: {
    label: string;
    value: number;
    highlight?: boolean;
}) {
    return (
        <div
            className={cn(
                "flex justify-between items-center py-2 px-3 rounded-lg text-sm transition-colors",
                highlight
                    ? "bg-[#FFCC00]/5 border border-[#FFCC00]/10"
                    : "hover:bg-white/[0.02]"
            )}
        >
            <span className={cn("text-[11px]", highlight ? "font-black text-zinc-200" : "text-zinc-500")}>
                {label}
            </span>
            <span
                className={cn(
                    "tabular-nums",
                    highlight ? "text-sm font-black text-[#FFCC00]" : "text-sm font-bold text-zinc-300"
                )}
            >
                {formatCurrency(value)}
            </span>
        </div>
    );
}

function GSTBar({
    label,
    amount,
    total,
    color,
}: {
    label: string;
    amount: number;
    total: number;
    color: string;
}) {
    const percent = total > 0 ? (Math.abs(amount) / total) * 100 : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
                <span className="text-zinc-500">{label}</span>
                <span className="font-black text-zinc-300 tabular-nums">
                    {formatCurrency(amount)}
                </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#1a1a2e]">
                <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                        width: `${Math.min(percent, 100)}%`,
                        backgroundColor: color,
                    }}
                />
            </div>
        </div>
    );
}

function SummaryCell({
    label,
    title,
    value,
}: {
    label: string;
    title: string;
    value: number;
}) {
    return (
        <div className="neu-inset rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black text-[#FFCC00] uppercase">{label}</span>
                <span className="text-[8px] text-zinc-600 truncate">{title}</span>
            </div>
            <p className="text-sm font-black text-zinc-200 tabular-nums">
                {formatCurrencyShort(value)}
            </p>
        </div>
    );
}
