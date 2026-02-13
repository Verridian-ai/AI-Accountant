import React from 'react';
import { Sankey as RechartsSankey, Tooltip, Layer, Rectangle } from 'recharts';
import { CHART_COLORS, CHART_THEME, getCategoryColor } from './ChartColorPalette';
import { ChartContainer } from './ChartContainer';

interface SankeyNode {
  name: string;
}

interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

interface SankeyProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  colors?: string[];
  title?: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  error?: string;
}

interface SankeyNodePayload {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: { name: string };
}

interface SankeyLinkPayload {
  sourceX: number;
  sourceY: number;
  sourceControlX: number;
  targetX: number;
  targetY: number;
  targetControlX: number;
  linkWidth: number;
  index: number;
}

function SankeyNodeComponent(props: { nodeColors: string[] } & Record<string, unknown>) {
  const {
    x,
    y,
    width,
    height: h,
    index,
    payload,
    nodeColors,
  } = props as unknown as SankeyNodePayload & { nodeColors: string[] };
  const name = payload?.name ?? '';
  const fill = nodeColors[index % nodeColors.length] ?? CHART_COLORS.primary;

  return (
    <Layer key={`node-${index.toString()}`}>
      <Rectangle x={x} y={y} width={width} height={h} fill={fill} fillOpacity={0.9} />
      {h > 14 && (
        <text
          x={x + width + 6}
          y={y + h / 2}
          textAnchor="start"
          dominantBaseline="middle"
          fill="#E5E7EB"
          fontSize={11}
        >
          {name}
        </text>
      )}
    </Layer>
  );
}

function SankeyLinkComponent(props: Record<string, unknown>) {
  const { sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, index } =
    props as unknown as SankeyLinkPayload;

  return (
    <Layer key={`link-${index.toString()}`}>
      <path
        d={`
          M${sourceX},${sourceY}
          C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
        `}
        fill="none"
        stroke={CHART_COLORS.primary}
        strokeWidth={linkWidth}
        strokeOpacity={0.25}
      />
    </Layer>
  );
}

function SankeyInner({
  nodes,
  links,
  colors,
  title,
  subtitle,
  height = 400,
  loading,
  error,
}: SankeyProps) {
  if (!loading && !error && (nodes.length === 0 || links.length === 0)) {
    return (
      <ChartContainer title={title} subtitle={subtitle} height={height}>
        <RechartsSankey
          data={{ nodes: [{ name: '' }], links: [] }}
          node={(() => null) as any}
          link={(() => null) as any}
        >
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
        </RechartsSankey>
      </ChartContainer>
    );
  }

  const nodeColors = colors ?? CHART_COLORS.categories.map((_, i) => getCategoryColor(i));

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      height={height}
      loading={loading}
      error={error}
    >
      <RechartsSankey
        data={{ nodes, links }}
        nodeWidth={12}
        nodePadding={24}
        node={(<SankeyNodeComponent nodeColors={nodeColors} />) as any}
        link={(<SankeyLinkComponent />) as any}
        margin={{ top: 10, right: 120, bottom: 10, left: 10 }}
      >
        <Tooltip
          contentStyle={CHART_THEME.tooltipStyle}
          formatter={(value: number) => [
            value.toLocaleString('en-AU', {
              style: 'currency',
              currency: 'AUD',
              maximumFractionDigits: 0,
            }),
            'Amount',
          ]}
        />
      </RechartsSankey>
    </ChartContainer>
  );
}

export const Sankey = React.memo(SankeyInner);
