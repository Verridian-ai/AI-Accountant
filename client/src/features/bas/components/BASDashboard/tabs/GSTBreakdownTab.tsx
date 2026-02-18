import { BarChart3, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import type { BASCalculation } from '@/types/tax';
import { GSTBar } from '../components/GSTBar.js';

interface GSTBreakdownTabProps {
  basData: BASCalculation | null;
  isRefund: boolean;
  netAmount: number;
}

export function GSTBreakdownTab({ basData, isRefund, netAmount }: GSTBreakdownTabProps) {
  if (!basData) {
    return (
      <div className="neu-raised rounded-2xl border border-white/5 p-12 text-center">
        <BarChart3 className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">
          Calculate a BAS period first to see the GST breakdown.
        </p>
      </div>
    );
  }

  const maxTotal = Math.max(basData.g1_total_sales, basData.g12_g10_plus_g11, 1);

  return (
    <div className="space-y-5">
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
            total={maxTotal}
            color="#FFCC00"
          />
          <GSTBar
            label="G2 - Export Sales"
            amount={basData.g2_export_sales}
            total={maxTotal}
            color="#60A5FA"
          />
          <GSTBar
            label="G3 - GST-Free Sales"
            amount={basData.g3_gst_free_sales}
            total={maxTotal}
            color="#34D399"
          />
          <GSTBar
            label="G10 - Capital Purchases"
            amount={basData.g10_capital_purchases}
            total={maxTotal}
            color="#F472B6"
          />
          <GSTBar
            label="G11 - Non-Capital Purchases"
            amount={basData.g11_non_capital_purchases}
            total={maxTotal}
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
          <p className="text-[10px] text-zinc-600">GST collected on taxable sales (G1 / 11)</p>
          <div className="mt-4 w-full h-2 rounded-full bg-[#1a1a2e]">
            <div
              className="h-2 rounded-full bg-[#FFCC00] transition-all duration-500"
              style={{
                width: `${
                  basData.g1_total_sales > 0
                    ? Math.min((basData.g9_gst_on_sales / basData.g1_total_sales) * 100 * 11, 100)
                    : 0
                }%`,
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
          <p className="text-[10px] text-zinc-600">GST credits on eligible business purchases</p>
          <div className="mt-4 w-full h-2 rounded-full bg-[#1a1a2e]">
            <div
              className="h-2 rounded-full bg-emerald-400 transition-all duration-500"
              style={{
                width: `${
                  basData.g12_g10_plus_g11 > 0
                    ? Math.min((basData.g19_gst_credits / basData.g12_g10_plus_g11) * 100 * 11, 100)
                    : 0
                }%`,
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
          <span className="text-[9px] text-zinc-600">Ready for lodgement review</span>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {[
            { label: '1A — GST on sales', value: basData.g9_gst_on_sales },
            { label: '1B — GST on purchases', value: basData.g19_gst_credits },
            { label: 'W2 — PAYG withheld', value: basData.w2_amounts_withheld },
            { label: '5A — PAYG instalment', value: basData.payg_instalment_5a },
            { label: '7C — Fuel tax credits', value: basData.fuel_tax_credits_7c },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5"
            >
              <span className="text-[11px] font-bold text-zinc-400">{label}</span>
              <span className="text-[11px] font-black text-zinc-200 tabular-nums">
                {formatCurrency(value)}
              </span>
            </div>
          ))}
          <div
            className={cn(
              'flex justify-between p-2.5 rounded-xl border',
              isRefund
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-red-500/5 border-red-500/20',
            )}
          >
            <span
              className={cn(
                'text-[11px] font-black',
                isRefund ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              Net {isRefund ? 'Refund' : 'Payable'}
            </span>
            <span
              className={cn(
                'text-[11px] font-black tabular-nums',
                isRefund ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              {formatCurrency(netAmount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
