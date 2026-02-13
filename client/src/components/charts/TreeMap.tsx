import React from 'react';
import { Treemap as RechartsTreemap, Tooltip } from 'recharts';
import { CHART_COLORS, CHART_THEME, getCategoryColor } from './ChartColorPalette';
import { ChartContainer } from './ChartContainer';

interface TreeMapDataItem {
  name: string;
  value?: number;
  children?: TreeMapDataItem[];
}

interface TreeMapProps {
  data: TreeMapDataItem[];
  colorScale?: string[];
  title?: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  error?: string;
}

interface ContentProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  value?: number;
  index: number;
  colors: string[];
}

function TreeMapContent(props: unknown) {
  const { x, y, width, height: h, name, value, index, colors } = props as ContentProps;
  if (width < 30 || h < 20) return null;

  const fill = colors[index % colors.length] ?? CHART_COLORS.primary;

  return (
    <g>
      <rect x={x} y={y} width={width} height={h} fill={fill} fillOpacity={0.85} stroke="#1F2937" strokeWidth={2} rx={4} />
      {width > 60 && h > 30 && (
        <>
          <text x={x + 6} y={y + 16} fill="#FFFFFF" fontSize={11} fontWeight="bold">
            {name && name.length > Math.floor(width / 7) ? `${name.slice(0, Math.floor(width / 7))}…` : name}
          </text>
          {value !== undefined && h > 45 && (
            <text x={x + 6} y={y + 32} fill="#E5E7EB" fontSize={10}>
              {value.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })}
            </text>
          )}
        </>
      )}
    </g>
  );
}

function TreeMapInner({
  data,
  colorScale,
  title,
  subtitle,
  height = 300,
  loading,
  error,
}: TreeMapProps) {
  if (!loading && !error && data.length === 0) {
    return (
      <ChartContainer title={title} subtitle={subtitle} height={height}>
        <RechartsTreemap data={[]} dataKey="value">
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#9CA3AF" fontSize={14}>
            No data available
          </text>
        </RechartsTreemap>
      </ChartContainer>
    );
  }

  const colors = colorScale ?? CHART_COLORS.categories.map((_, i) => getCategoryColor(i));

  return (
    <ChartContainer title={title} subtitle={subtitle} height={height} loading={loading} error={error}>
      <RechartsTreemap
        data={data}
        dataKey="value"
        aspectRatio={4 / 3}
        animationDuration={500}
        content={<TreeMapContent x={0} y={0} width={0} height={0} index={0} colors={colors} />}
      >
        <Tooltip
          contentStyle={CHART_THEME.tooltipStyle}
          formatter={(value: number) => [
            value.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }),
            '',
          ]}
        />
      </RechartsTreemap>
    </ChartContainer>
  );
}

export const TreeMap = React.memo(TreeMapInner);
