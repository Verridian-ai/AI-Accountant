import {
  Loader2,
  Calculator,
  FileText,
  DollarSign,
  ArrowRight,
  RefreshCw,
  Save,
  Trash2,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import type { BASCalculation } from '@/types/tax';
import { Sparkline, CHART_COLORS } from '@/components/charts';
import { BASRow } from '../components/BASRow.js';

import { SummaryCell } from '../components/SummaryCell.js';
import { formatCurrencyShort } from '../utils.js';
import type { QuarterOption } from '../hooks/useBASDashboard.js';

interface CalculateTabProps {
  calculating: boolean;
  loading: boolean;
  selectedQuarter: string;
  setSelectedQuarter: (q: string) => void;
  method: 'accrual' | 'cash';
  setMethod: (m: 'accrual' | 'cash') => void;
  basData: BASCalculation | null;
  setBASData: (data: BASCalculation | null) => void;
  error: string | null;
  barChartData: { sales: number; purchases: number; max: number } | null;
  isRefund: boolean;
  netAmount: number;
  onCalculate: () => void;
  onSave: () => void;
  availableQuarters: QuarterOption[];
}

export function CalculateTab({
  calculating,
  loading,
  selectedQuarter,
  setSelectedQuarter,
  method,
  setMethod,
  basData,
  setBASData,
  error,
  barChartData,
  isRefund,
  netAmount,
  onCalculate,
  onSave,
  availableQuarters,
}: CalculateTabProps) {
  return (
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
                  'px-3 py-2 min-h-[44px] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                  method === m
                    ? 'bg-[#FFCC00] text-[#0a0a0f]'
                    : 'text-zinc-500 hover:text-zinc-300',
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
              {availableQuarters.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedQuarter(opt.value)}
                  className={cn(
                    'px-3 py-2 min-h-[44px] rounded-xl text-[10px] font-bold transition-all border',
                    selectedQuarter === opt.value
                      ? 'bg-[#FFCC00]/10 border-[#FFCC00]/30 text-[#FFCC00]'
                      : 'border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10',
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
            onClick={onCalculate}
            disabled={calculating || !selectedQuarter}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all',
              'bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFD633]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'shadow-lg shadow-[#FFCC00]/10',
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
              'neu-raised rounded-2xl border-2 p-4 sm:p-6',
              isRefund ? 'border-emerald-500/30' : 'border-red-500/30',
            )}
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center',
                    isRefund
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'bg-red-500/10 border border-red-500/20',
                  )}
                >
                  <DollarSign
                    className={cn('w-7 h-7', isRefund ? 'text-emerald-400' : 'text-red-400')}
                  />
                </div>
                <div>
                  <span
                    className={cn(
                      'text-[10px] font-black uppercase tracking-[0.2em]',
                      isRefund ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {isRefund ? 'Refund Due' : 'Amount Payable'}
                  </span>
                  <div
                    className={cn(
                      'text-2xl sm:text-3xl font-black tracking-tight',
                      isRefund ? 'text-emerald-400' : 'text-red-400',
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
                      'text-lg font-black tabular-nums',
                      isRefund ? 'text-emerald-400' : 'text-red-400',
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
                <Sparkline
                  data={[820, 950, 870, 1100, 1050, 1200]}
                  width={80}
                  height={24}
                  color={CHART_COLORS.primary}
                  trend="up"
                />
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
                <Sparkline
                  data={[600, 550, 700, 620, 680, 750]}
                  width={80}
                  height={24}
                  color={CHART_COLORS.axis}
                  trend="up"
                />
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
                  'text-2xl font-black tabular-nums',
                  isRefund ? 'text-emerald-400' : 'text-red-400',
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
                <text
                  x="10"
                  y="35"
                  fill="#71717a"
                  className="text-[9px] font-bold"
                  dominantBaseline="middle"
                >
                  G1 Sales
                </text>
                <text
                  x="10"
                  y="85"
                  fill="#71717a"
                  className="text-[9px] font-bold"
                  dominantBaseline="middle"
                >
                  G10+G11
                </text>
                <rect x="80" y="20" width="280" height="28" rx="6" fill="rgba(255,255,255,0.03)" />
                <rect x="80" y="70" width="280" height="28" rx="6" fill="rgba(255,255,255,0.03)" />
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
                <BASRow label="G9 - GST on Sales" value={basData.g9_gst_on_sales} highlight />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FFCC00]" />
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                    Purchases
                  </span>
                </div>
                <BASRow label="G10 - Capital Purchases" value={basData.g10_capital_purchases} />
                <BASRow
                  label="G11 - Non-Capital Purchases"
                  value={basData.g11_non_capital_purchases}
                />
                <BASRow label="G12 - Total Purchases" value={basData.g12_g10_plus_g11} />
                <BASRow label="G19 - GST Credits" value={basData.g19_gst_credits} highlight />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FFCC00]" />
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                    PAYG Withholding
                  </span>
                </div>
                <BASRow label="W1 - Gross Wages" value={basData.w1_gross_wages} />
                <BASRow label="W2 - Amounts Withheld" value={basData.w2_amounts_withheld} />
                <BASRow label="5A - PAYG Instalment" value={basData.payg_instalment_5a} />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FFCC00]" />
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                    Other
                  </span>
                </div>
                <BASRow label="7C - Fuel Tax Credits" value={basData.fuel_tax_credits_7c} />
                <BASRow label="7D - Wine Equalisation" value={basData.wine_equalisation_7d} />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-sm font-black text-zinc-300 uppercase tracking-wider">
                  Net Amount {isRefund ? 'Refundable' : 'Payable'}
                </span>
                <span
                  className={cn(
                    'text-xl font-black tabular-nums',
                    isRefund ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {formatCurrency(netAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* BAS Summary Grid */}
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
              <SummaryCell label="1A" title="GST on Sales" value={basData.g9_gst_on_sales} />
              <SummaryCell label="1B" title="GST Credits" value={basData.g19_gst_credits} />
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
              onClick={onSave}
              disabled={loading}
              className={cn(
                'flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-[10px] font-black uppercase tracking-wider transition-all',
                'bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFD633]',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'shadow-lg shadow-[#FFCC00]/10',
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
  );
}
