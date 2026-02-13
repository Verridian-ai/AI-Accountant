import React, { useCallback, useState } from 'react';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend, Sector } from 'recharts';
import { CHART_COLORS, CHART_THEME, getCategoryColor } from './ChartColorPalette';
import { ChartContainer } from './ChartContainer';

type PieSectorDataItem = any;

interface PieDataItem {
  name: string;
  value: number;
}

interface PieChartProps {
  data: PieDataItem[];
  innerRadius?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  colors?: string[];
  title?: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  error?: string;
}

interface ActiveShapeProps extends PieSectorDataItem {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
  payload: PieDataItem;
  value: number;
}

function renderActiveShape(props: unknown) {
  const p = props as ActiveShapeProps;
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = p;

  return (
    <g>
      {innerRadius > 0 && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
          <tspan x={cx} dy="-0.3em" fill={CHART_COLORS.primary} fontSize={16} fontWeight="bold">
            {value.toLocaleString('en-AU', {
              style: 'currency',
              currency: 'AUD',
              maximumFractionDigits: 0,
            })}
          </tspan>
          <tspan x={cx} dy="1.4em" fill="#9CA3AF" fontSize={11}>
            {payload.name}
          </tspan>
        </text>
      )}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius > 0 ? innerRadius - 4 : 0}
        outerRadius={innerRadius > 0 ? innerRadius - 1 : 0}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.4}
      />
    </g>
  );
}

function PieChartInner({
  data,
  innerRadius = 0,
  showLabels = false,
  showLegend = true,
  colors,
  title,
  subtitle,
  height = 300,
  loading,
  error,
}: PieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const onPieEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(undefined);
  }, []);

  if (!loading && !error && data.length === 0) {
    return (
      <ChartContainer title={title} subtitle={subtitle} height={height}>
        <RechartsPieChart>
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
        </RechartsPieChart>
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
      <RechartsPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={Math.min(height / 2 - 40, 120)}
          dataKey="value"
          nameKey="name"
          animationDuration={500}
          activeIndex={activeIndex}
          activeShape={renderActiveShape}
          onMouseEnter={onPieEnter}
          onMouseLeave={onPieLeave}
          label={showLabels ? { fill: '#E5E7EB', fontSize: 11 } : false}
        >
          {data.map((_, i) => (
            <Cell key={`cell-${i.toString()}`} fill={colors?.[i] ?? getCategoryColor(i)} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={CHART_THEME.tooltipStyle}
          labelStyle={{ color: CHART_COLORS.primary }}
          formatter={(value: number) => [
            value.toLocaleString('en-AU', {
              style: 'currency',
              currency: 'AUD',
              maximumFractionDigits: 0,
            }),
            '',
          ]}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ color: '#E5E7EB', fontSize: CHART_THEME.fontSize }}
            iconType="circle"
          />
        )}
      </RechartsPieChart>
    </ChartContainer>
  );
}

export const PieChart = React.memo(PieChartInner);
