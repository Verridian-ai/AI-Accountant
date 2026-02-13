import React from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { CHART_COLORS, CHART_THEME, getCategoryColor } from './ChartColorPalette';
import { ChartContainer } from './ChartContainer';

interface LineChartProps {
  data: Record<string, unknown>[];
  dataKeys: string[];
  xAxisKey: string;
  curved?: boolean;
  showDots?: boolean;
  showArea?: boolean;
  colors?: string[];
  title?: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  error?: string;
}

function LineChartInner({
  data,
  dataKeys,
  xAxisKey,
  curved = true,
  showDots = false,
  showArea = false,
  colors,
  title,
  subtitle,
  height = 300,
  loading,
  error,
}: LineChartProps) {
  if (!loading && !error && data.length === 0) {
    return (
      <ChartContainer title={title} subtitle={subtitle} height={height}>
        <RechartsLineChart data={[]}>
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#9CA3AF" fontSize={14}>
            No data available
          </text>
        </RechartsLineChart>
      </ChartContainer>
    );
  }

  const curveType = curved ? 'monotone' : 'linear';

  return (
    <ChartContainer title={title} subtitle={subtitle} height={height} loading={loading} error={error}>
      <RechartsLineChart data={data}>
        <defs>
          {dataKeys.map((key, i) => {
            const color = colors?.[i] ?? getCategoryColor(i);
            return (
              <linearGradient key={`gradient-${key}`} id={`area-gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        <XAxis dataKey={xAxisKey} tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }} />
        <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }} />
        <Tooltip
          contentStyle={CHART_THEME.tooltipStyle}
          labelStyle={{ color: CHART_COLORS.primary }}
          itemStyle={{ color: '#E5E7EB' }}
        />
        {dataKeys.map((key, i) => {
          const color = colors?.[i] ?? getCategoryColor(i);
          return showArea ? (
            <Area
              key={key}
              type={curveType}
              dataKey={key}
              stroke={color}
              strokeWidth={2}
              fill={`url(#area-gradient-${key})`}
              dot={showDots}
              animationDuration={500}
            />
          ) : (
            <Line
              key={key}
              type={curveType}
              dataKey={key}
              stroke={color}
              strokeWidth={2}
              dot={showDots ? { fill: color, r: 3 } : false}
              activeDot={{ r: 5, fill: color, stroke: '#1F2937', strokeWidth: 2 }}
              animationDuration={500}
            />
          );
        })}
      </RechartsLineChart>
    </ChartContainer>
  );
}

export const LineChart = React.memo(LineChartInner);
