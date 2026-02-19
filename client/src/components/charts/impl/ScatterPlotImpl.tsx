import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis } from 'recharts';
import { CHART_COLORS, CHART_THEME } from '../ChartColorPalette';
import { ChartContainer } from './ChartContainerImpl';

export interface ScatterPlotProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  sizeKey?: string;
  xLabel?: string;
  yLabel?: string;
  color?: string;
  title?: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  error?: string;
}

function ScatterPlotInner({
  data,
  xKey,
  yKey,
  sizeKey,
  xLabel,
  yLabel,
  color = CHART_COLORS.primary,
  title,
  subtitle,
  height = 300,
  loading,
  error,
}: ScatterPlotProps) {
  if (!loading && !error && data.length === 0) {
    return (
      <ChartContainer title={title} subtitle={subtitle} height={height}>
        <ScatterChart>
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#9CA3AF"
            fontSize={14}
          >
            No data available
          </text>
        </ScatterChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      height={height}
      loading={loading}
      error={error}
    >
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        <XAxis
          dataKey={xKey}
          name={xLabel ?? xKey}
          tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }}
          label={
            xLabel
              ? { value: xLabel, position: 'insideBottom', offset: -5, fill: CHART_COLORS.axis }
              : undefined
          }
        />
        <YAxis
          dataKey={yKey}
          name={yLabel ?? yKey}
          tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }}
          label={
            yLabel
              ? { value: yLabel, angle: -90, position: 'insideLeft', fill: CHART_COLORS.axis }
              : undefined
          }
        />
        {sizeKey && <ZAxis dataKey={sizeKey} range={[20, 400]} />}
        <Tooltip
          contentStyle={CHART_THEME.tooltipStyle}
          labelStyle={{ color: CHART_COLORS.primary }}
          cursor={{ strokeDasharray: '3 3', stroke: CHART_COLORS.primary }}
        />
        <Scatter data={data} fill={color} fillOpacity={0.7} animationDuration={500} />
      </ScatterChart>
    </ChartContainer>
  );
}

export const ScatterPlot = React.memo(ScatterPlotInner);
