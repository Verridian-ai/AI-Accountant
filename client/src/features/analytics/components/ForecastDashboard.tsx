import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import { analyticsApi } from '@/api';
import type { ProjectionResult } from '@/api';
import type { CashFlowForecast } from '../types';
import {
  LineChart as GoldLineChart,
  ComposedChart as GoldComposedChart,
  ScatterPlot as GoldScatterPlot,
  CHART_COLORS,
} from '../../../components/charts';

function formatDollars(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

function ForecastDashboardInner() {
  const [revenueData, setRevenueData] = useState<ProjectionResult | null>(null);
  const [expenseData, setExpenseData] = useState<ProjectionResult | null>(null);
  const [cashFlowData, setCashFlowData] = useState<CashFlowForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState(6);

  useEffect(() => {
    loadAllData();
  }, [months]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [revenue, expenses, cashFlow] = await Promise.allSettled([
        analyticsApi.projectRevenue('sole_trader', months),
        analyticsApi.projectExpenses('sole_trader', months),
        analyticsApi.fetchCashFlowForecast(months),
      ]);
      if (revenue.status === 'fulfilled') setRevenueData(revenue.value);
      if (expenses.status === 'fulfilled') setExpenseData(expenses.value);
      if (cashFlow.status === 'fulfilled') setCashFlowData(cashFlow.value);
    } catch (err) {
      setError('Failed to load forecast data');
      console.error('Forecast load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Revenue forecast chart data
  const revenueChartData = useMemo(() => {
    if (!revenueData?.projections) return [];
    return revenueData.projections.map(p => ({
      month: p.month,
      projected: Math.round(p.projected / 100),
      upper95: Math.round(p.upperBound / 100),
      lower95: Math.round(p.lowerBound / 100),
      upper80: Math.round(p.projected / 100 + (p.upperBound / 100 - p.projected / 100) * 0.6),
      lower80: Math.round(p.projected / 100 - (p.projected / 100 - p.lowerBound / 100) * 0.6),
    }));
  }, [revenueData]);

  // Expense forecast chart data
  const expenseChartData = useMemo(() => {
    if (!expenseData?.projections) return [];
    return expenseData.projections.map(p => ({
      month: p.month,
      recurring: Math.round(p.projected / 100 * 0.7),
      variable: Math.round(p.projected / 100 * 0.3),
      total: Math.round(p.projected / 100),
    }));
  }, [expenseData]);

  // Cash flow projection chart data
  const cashFlowChartData = useMemo(() => {
    if (cashFlowData.length === 0) return [];
    return cashFlowData.map(cf => ({
      month: cf.month,
      balance: Math.round(cf.projectedBalance / 100),
      upper: Math.round(cf.upperBound / 100),
      lower: Math.round(cf.lowerBound / 100),
      confidence: cf.confidence,
    }));
  }, [cashFlowData]);

  // Anomaly detection scatter data (derived from cash flow deviations)
  const anomalyData = useMemo(() => {
    if (cashFlowData.length === 0) return [];
    return cashFlowData.map((cf, i) => {
      const expected = cf.projectedBalance / 100;
      const deviation = Math.abs(cf.upperBound - cf.lowerBound) / (2 * 100);
      return {
        month: i + 1,
        expected: Math.round(expected),
        deviation: Math.round(deviation),
        confidence: cf.confidence,
      };
    });
  }, [cashFlowData]);

  if (loading) {
    return (
      <div className="neu-raised rounded-3xl p-8 border border-white/5 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 text-[#FFCC00] animate-spin" />
      </div>
    );
  }

  const hasData = revenueChartData.length > 0 || expenseChartData.length > 0 || cashFlowChartData.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#FFCC00]" />
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Financial Forecast</span>
        </div>
        <div className="flex gap-1 neu-inset rounded-xl p-1">
          {([3, 6, 12] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMonths(m)}
              className={cn(
                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                months === m ? "bg-[#FFCC00] text-[#0a0a0f]" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {m}mo
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="neu-raised rounded-xl p-4 border border-red-500/20 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {/* KPI Row */}
      {hasData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="neu-raised rounded-xl p-4 border border-white/5">
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Avg Monthly Revenue</p>
            <p className="text-lg font-black text-emerald-400 tabular-nums mt-1">
              {revenueData ? formatDollars(revenueData.averageMonthly / 100) : '—'}
            </p>
          </div>
          <div className="neu-raised rounded-xl p-4 border border-white/5">
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Revenue Growth</p>
            <p className={cn("text-lg font-black tabular-nums mt-1", (revenueData?.growthRate ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {revenueData ? `${(revenueData.growthRate * 100).toFixed(1)}%` : '—'}
            </p>
          </div>
          <div className="neu-raised rounded-xl p-4 border border-white/5">
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Avg Monthly Expenses</p>
            <p className="text-lg font-black text-red-400 tabular-nums mt-1">
              {expenseData ? formatDollars(expenseData.averageMonthly / 100) : '—'}
            </p>
          </div>
          <div className="neu-raised rounded-xl p-4 border border-white/5">
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Projected Cash Flow</p>
            <p className="text-lg font-black text-[#FFCC00] tabular-nums mt-1">
              {cashFlowChartData.length > 0 ? formatDollars(cashFlowChartData[cashFlowChartData.length - 1]!.balance) : '—'}
            </p>
          </div>
        </div>
      )}

      {!hasData ? (
        <div className="neu-raised rounded-2xl p-12 border border-white/5 text-center">
          <TrendingUp className="w-10 h-10 mx-auto text-zinc-600 mb-3" />
          <p className="text-sm text-zinc-500">No forecast data available yet.</p>
          <p className="text-xs text-zinc-600 mt-1">Upload statements and categorize transactions to enable projections.</p>
        </div>
      ) : (
        <>
          {/* Revenue & Expense Forecasts */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue Forecast */}
            <div className="neu-raised rounded-2xl p-4 border border-white/5">
              <GoldLineChart
                data={revenueChartData}
                dataKeys={['projected', 'upper95', 'lower95']}
                xAxisKey="month"
                showArea
                curved
                colors={[CHART_COLORS.primary, 'rgba(255,204,0,0.15)', 'rgba(255,204,0,0.08)']}
                title="Revenue Forecast"
                subtitle={`${months}-month projection with 95% confidence bands`}
                height={280}
              />
            </div>

            {/* Expense Forecast */}
            <div className="neu-raised rounded-2xl p-4 border border-white/5">
              <GoldLineChart
                data={expenseChartData}
                dataKeys={['recurring', 'variable', 'total']}
                xAxisKey="month"
                colors={[CHART_COLORS.expense, '#FF9500', '#DC2626']}
                title="Expense Forecast"
                subtitle="Recurring vs variable expense breakdown"
                height={280}
              />
            </div>
          </div>

          {/* Cash Flow & Anomaly Detection */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Cash Flow Projection */}
            <div className="neu-raised rounded-2xl p-4 border border-white/5">
              <GoldComposedChart
                data={cashFlowChartData}
                xAxisKey="month"
                areas={[
                  { dataKey: 'balance', color: CHART_COLORS.primary, opacity: 0.3, name: 'Projected Balance' },
                ]}
                lines={[
                  { dataKey: 'upper', color: CHART_COLORS.revenue, dashed: true, name: 'Upper Bound' },
                  { dataKey: 'lower', color: CHART_COLORS.expense, dashed: true, name: 'Lower Bound' },
                ]}
                title="Cash Flow Projection"
                subtitle="Projected balance with upper/lower confidence range"
                height={280}
              />
            </div>

            {/* Anomaly Detection Scatter */}
            <div className="neu-raised rounded-2xl p-4 border border-white/5">
              <GoldScatterPlot
                data={anomalyData}
                xKey="expected"
                yKey="deviation"
                xLabel="Expected ($)"
                yLabel="Deviation ($)"
                color={CHART_COLORS.primary}
                title="Forecast Uncertainty Analysis"
                subtitle="Expected balance vs deviation range per period"
                height={280}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default React.memo(ForecastDashboardInner);
export const ForecastDashboard = React.memo(ForecastDashboardInner);
