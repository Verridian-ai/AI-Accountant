import React from 'react';
import { Sparkline } from '@/components/charts';
import { CHART_COLORS } from '@/components/charts/ChartColorPalette';
import type { FlowSummary } from '../hooks/useMoneyFlow';

interface FlowSummaryCardsProps {
  summary: FlowSummary;
  loading?: boolean;
}

function formatAUD(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return value < 0 ? `-${formatted}` : formatted;
}

function CardSkeleton() {
  return (
    <div className="neu-raised rounded-xl p-4 animate-pulse">
      <div className="h-3 w-20 bg-gray-700 rounded mb-2" />
      <div className="h-6 w-28 bg-gray-700 rounded mb-3" />
      <div className="h-[30px] w-full bg-gray-800/30 rounded" />
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  subValue?: string;
  sparklineData: number[];
  color: string;
  trend?: 'up' | 'down' | 'flat';
}

function SummaryCard({ label, value, subValue, sparklineData, color, trend }: SummaryCardProps) {
  return (
    <div className="neu-raised rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold mb-1" style={{ color }}>
        {value}
      </p>
      {subValue && <p className="text-xs text-gray-500 mb-2">{subValue}</p>}
      <div className="mt-1">
        <Sparkline
          data={sparklineData}
          width={120}
          height={30}
          color={color}
          showArea
          trend={trend}
        />
      </div>
    </div>
  );
}

/** Circular progress ring for savings rate */
function SavingsRateCircle({ rate, color }: { rate: number; color: string }) {
  const radius = 28;
  const stroke = 4;
  const circumference = 2 * Math.PI * radius;
  const clampedRate = Math.max(0, Math.min(100, Math.abs(rate)));
  const offset = circumference - (clampedRate / 100) * circumference;
  const size = (radius + stroke) * 2;

  return (
    <div className="flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          fill="none"
          stroke="#374151"
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>
        {rate.toFixed(1)}%
      </span>
    </div>
  );
}

function FlowSummaryCardsInner({ summary, loading }: FlowSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const savingsColor =
    summary.savingsRate >= 20
      ? CHART_COLORS.revenue
      : summary.savingsRate >= 0
        ? CHART_COLORS.primary
        : CHART_COLORS.expense;

  const savingsLabel =
    summary.savingsRate >= 20
      ? 'Healthy'
      : summary.savingsRate >= 0
        ? 'Could improve'
        : 'Spending exceeds income';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Total Income */}
      <SummaryCard
        label="Total Income"
        value={formatAUD(summary.totalIncome)}
        sparklineData={summary.monthlyIncome}
        color={CHART_COLORS.revenue}
        trend="up"
      />

      {/* Total Expenses */}
      <SummaryCard
        label="Total Expenses"
        value={formatAUD(summary.totalExpenses)}
        sparklineData={summary.monthlyExpenses}
        color={CHART_COLORS.expense}
        trend="down"
      />

      {/* Net Cash Flow */}
      <SummaryCard
        label="Net Cash Flow"
        value={formatAUD(summary.netCashFlow)}
        sparklineData={summary.monthlyCashFlow}
        color={CHART_COLORS.primary}
        trend={summary.netCashFlow >= 0 ? 'up' : 'down'}
      />

      {/* Largest Income Source */}
      <SummaryCard
        label="Largest Income Source"
        value={summary.largestIncomeSource.name}
        subValue={
          summary.largestIncomeSource.amount > 0
            ? formatAUD(summary.largestIncomeSource.amount)
            : undefined
        }
        sparklineData={summary.monthlyIncome.map((v) => v * 0.4)}
        color="#22C55E"
      />

      {/* Largest Expense Category */}
      <SummaryCard
        label="Largest Expense"
        value={summary.largestExpenseCategory.name}
        subValue={
          summary.largestExpenseCategory.amount > 0
            ? formatAUD(summary.largestExpenseCategory.amount)
            : undefined
        }
        sparklineData={summary.monthlyExpenses.map((v) => v * 0.3)}
        color="#F59E0B"
      />

      {/* Savings Rate with circular progress */}
      <div className="neu-raised rounded-xl p-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Savings Rate</p>
        <div className="flex items-center gap-3 mt-2">
          <div className="relative flex items-center justify-center">
            <SavingsRateCircle rate={summary.savingsRate} color={savingsColor} />
          </div>
          <div>
            <p className="text-xs text-gray-500">{savingsLabel}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">
              {summary.savingsRate >= 0 ? 'of income saved' : 'net deficit'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const FlowSummaryCards = React.memo(FlowSummaryCardsInner);
