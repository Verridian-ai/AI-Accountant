import React, { useMemo, useId } from 'react';
import { LineChart, Line, Area, YAxis } from 'recharts';
import { CHART_COLORS } from '../ChartColorPalette';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
  trend?: 'up' | 'down' | 'flat';
}

function SparklineInner({
  data,
  width = 100,
  height = 30,
  color,
  showArea = false,
  trend,
}: SparklineProps) {
  const chartData = useMemo(() => data.map((value, i) => ({ i, value })), [data]);

  const baseId = useId().replace(/:/g, '');
  const gradientId = `sparkline-${baseId}`;

  if (data.length === 0) {
    return <svg width={width} height={height} className="bg-gray-800/30 rounded" />;
  }

  const resolvedColor =
    color ??
    (trend === 'up'
      ? CHART_COLORS.revenue
      : trend === 'down'
        ? CHART_COLORS.expense
        : CHART_COLORS.primary);

  return (
    <LineChart width={width} height={height} data={chartData}>
      {showArea && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={resolvedColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={resolvedColor} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      <YAxis domain={['dataMin', 'dataMax']} hide />
      {showArea ? (
        <Area
          type="monotone"
          dataKey="value"
          stroke={resolvedColor}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
        />
      ) : (
        <Line
          type="monotone"
          dataKey="value"
          stroke={resolvedColor}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      )}
    </LineChart>
  );
}

export const Sparkline = React.memo(SparklineInner);
