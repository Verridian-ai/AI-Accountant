import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { CHART_COLORS, CHART_THEME, getCategoryColor } from './ChartColorPalette';
import { ChartContainer } from './ChartContainer';

interface BarChartProps {
  data: Record<string, unknown>[];
  dataKeys: string[];
  xAxisKey: string;
  stacked?: boolean;
  horizontal?: boolean;
  colors?: string[];
  title?: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  error?: string;
}

function BarChartInner({
  data,
  dataKeys,
  xAxisKey,
  stacked = false,
  horizontal = false,
  colors,
  title,
  subtitle,
  height = 300,
  loading,
  error,
}: BarChartProps) {
  if (!loading && !error && data.length === 0) {
    return (
      <ChartContainer title={title} subtitle={subtitle} height={height}>
        <RechartsBarChart data={[]}>
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#9CA3AF" fontSize={14}>
            No data available
          </text>
        </RechartsBarChart>
      </ChartContainer>
    );
  }

  const layout = horizontal ? 'vertical' : 'horizontal';

  return (
    <ChartContainer title={title} subtitle={subtitle} height={height} loading={loading} error={error}>
      <RechartsBarChart data={data} layout={layout}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }} />
            <YAxis dataKey={xAxisKey} type="category" tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }} width={80} />
          </>
        ) : (
          <>
            <XAxis dataKey={xAxisKey} tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }} />
            <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }} />
          </>
        )}
        <Tooltip
          contentStyle={CHART_THEME.tooltipStyle}
          labelStyle={{ color: CHART_COLORS.primary }}
          itemStyle={{ color: '#E5E7EB' }}
        />
        <Legend wrapperStyle={{ color: '#E5E7EB', fontSize: CHART_THEME.fontSize }} />
        {dataKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors?.[i] ?? getCategoryColor(i)}
            stackId={stacked ? 'stack' : undefined}
            animationDuration={500}
            radius={stacked ? undefined : [4, 4, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ChartContainer>
  );
}

export const BarChart = React.memo(BarChartInner);
