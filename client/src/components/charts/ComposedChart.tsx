import React from 'react';
import {
  ComposedChart as RechartsComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { CHART_COLORS, CHART_THEME } from './ChartColorPalette';
import { ChartContainer } from './ChartContainer';

export interface BarConfig {
  dataKey: string;
  color: string;
  yAxisId?: string;
  stackId?: string;
  name?: string;
}

export interface LineConfig {
  dataKey: string;
  color: string;
  yAxisId?: string;
  strokeWidth?: number;
  dashed?: boolean;
  name?: string;
}

export interface AreaConfig {
  dataKey: string;
  color: string;
  yAxisId?: string;
  opacity?: number;
  name?: string;
}

interface ComposedChartProps {
  data: Record<string, unknown>[];
  bars?: BarConfig[];
  lines?: LineConfig[];
  areas?: AreaConfig[];
  xAxisKey: string;
  dualAxis?: boolean;
  title?: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  error?: string;
}

function ComposedChartInner({
  data,
  bars = [],
  lines = [],
  areas = [],
  xAxisKey,
  dualAxis = false,
  title,
  subtitle,
  height = 300,
  loading,
  error,
}: ComposedChartProps) {
  if (!loading && !error && data.length === 0) {
    return (
      <ChartContainer title={title} subtitle={subtitle} height={height}>
        <RechartsComposedChart data={[]}>
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#9CA3AF" fontSize={14}>
            No data available
          </text>
        </RechartsComposedChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer title={title} subtitle={subtitle} height={height} loading={loading} error={error}>
      <RechartsComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        <XAxis dataKey={xAxisKey} tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }} />
        <YAxis
          yAxisId="left"
          tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }}
        />
        {dualAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }}
          />
        )}
        <Tooltip
          contentStyle={CHART_THEME.tooltipStyle}
          labelStyle={{ color: CHART_COLORS.primary }}
          itemStyle={{ color: '#E5E7EB' }}
        />
        <Legend wrapperStyle={{ color: '#E5E7EB', fontSize: CHART_THEME.fontSize }} />

        {areas.map((area) => (
          <Area
            key={`area-${area.dataKey}`}
            type="monotone"
            dataKey={area.dataKey}
            fill={area.color}
            stroke={area.color}
            fillOpacity={area.opacity ?? 0.2}
            yAxisId={area.yAxisId ?? 'left'}
            name={area.name ?? area.dataKey}
            animationDuration={500}
          />
        ))}
        {bars.map((bar) => (
          <Bar
            key={`bar-${bar.dataKey}`}
            dataKey={bar.dataKey}
            fill={bar.color}
            yAxisId={bar.yAxisId ?? 'left'}
            stackId={bar.stackId}
            name={bar.name ?? bar.dataKey}
            animationDuration={500}
            radius={[4, 4, 0, 0]}
          />
        ))}
        {lines.map((line) => (
          <Line
            key={`line-${line.dataKey}`}
            type="monotone"
            dataKey={line.dataKey}
            stroke={line.color}
            strokeWidth={line.strokeWidth ?? 2}
            strokeDasharray={line.dashed ? '5 5' : undefined}
            yAxisId={line.yAxisId ?? 'left'}
            name={line.name ?? line.dataKey}
            dot={false}
            animationDuration={500}
          />
        ))}
      </RechartsComposedChart>
    </ChartContainer>
  );
}

export const ComposedChart = React.memo(ComposedChartInner);
