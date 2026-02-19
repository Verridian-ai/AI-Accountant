import React, { useState, useCallback, useMemo } from 'react';
import { Sankey as RechartsSankey, Tooltip, Layer, Rectangle } from 'recharts';
import { ChartContainer, CHART_COLORS } from '@/components/charts';
import {
  getCategoryColor as getCatColor,
  isRevenueCategory,
} from '../../transactions/constants/categoryColors';
import { useMoneyFlow, type SankeyNode, type SankeyLink } from '../hooks/useMoneyFlow';
import { FlowSummaryCards } from './FlowSummaryCards';
import { MoneyFlowDetail } from './MoneyFlowDetail';

const PERIOD_OPTIONS = [
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'fy', label: 'Financial Year' },
];

interface NodePayload {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: { name: string };
}

interface LinkPayload {
  sourceX: number;
  sourceY: number;
  sourceControlX: number;
  targetX: number;
  targetY: number;
  targetControlX: number;
  linkWidth: number;
  index: number;
  payload: { source: number; target: number; value: number };
}

/** Map Tailwind color name to hex for Sankey node fills */
const COLOR_NAME_TO_HEX: Record<string, string> = {
  orange: '#F97316',
  rose: '#F43F5E',
  pink: '#EC4899',
  fuchsia: '#D946EF',
  purple: '#A855F7',
  violet: '#8B5CF6',
  indigo: '#6366F1',
  blue: '#3B82F6',
  sky: '#0EA5E9',
  yellow: '#EAB308',
  stone: '#78716C',
  emerald: '#10B981',
  green: '#22C55E',
  teal: '#14B8A6',
  lime: '#84CC16',
  cyan: '#06B6D4',
  amber: '#F59E0B',
  zinc: '#71717A',
  slate: '#64748B',
};

function getNodeColor(
  name: string,
  index: number,
  incomeCount: number,
  accountCount: number,
): string {
  // Income sources (first batch) -- green family
  if (index < incomeCount) {
    if (isRevenueCategory(name)) {
      const catColor = getCatColor(name);
      return COLOR_NAME_TO_HEX[catColor.name] ?? CHART_COLORS.revenue;
    }
    return CHART_COLORS.revenue;
  }
  // Accounts (middle) -- gold
  if (index < incomeCount + accountCount) {
    return CHART_COLORS.primary;
  }
  // Expense categories (right side)
  const catColor = getCatColor(name);
  return (
    COLOR_NAME_TO_HEX[catColor.name] ??
    CHART_COLORS.categories[index % CHART_COLORS.categories.length] ??
    CHART_COLORS.primary
  );
}

function SankeyNodeRenderer(
  props: {
    incomeCount: number;
    accountCount: number;
    nodeCount: number;
    onNodeClick: (node: SankeyNode, index: number) => void;
  } & Record<string, unknown>,
) {
  const { x, y, width, height: h, index, payload } = props as unknown as NodePayload;
  const { incomeCount, accountCount, onNodeClick } = props;
  const name = payload?.name ?? '';
  const fill = getNodeColor(name, index, incomeCount, accountCount);

  return (
    <Layer key={`node-${index.toString()}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={h}
        fill={fill}
        fillOpacity={0.9}
        style={{ cursor: 'pointer' }}
        onClick={() => onNodeClick({ name }, index)}
      />
      {h > 14 && (
        <text
          x={index < incomeCount ? x - 6 : x + width + 6}
          y={y + h / 2}
          textAnchor={index < incomeCount ? 'end' : 'start'}
          dominantBaseline="middle"
          fill="#E5E7EB"
          fontSize={11}
          style={{ cursor: 'pointer' }}
          onClick={() => onNodeClick({ name }, index)}
        >
          {name}
        </text>
      )}
    </Layer>
  );
}

function SankeyLinkRenderer(
  props: {
    incomeCount: number;
    onLinkClick: (link: SankeyLink, index: number) => void;
    highlightIndex: number | null;
  } & Record<string, unknown>,
) {
  const {
    sourceX,
    sourceY,
    sourceControlX,
    targetX,
    targetY,
    targetControlX,
    linkWidth,
    index,
    payload,
  } = props as unknown as LinkPayload;
  const { incomeCount, onLinkClick, highlightIndex } = props;
  const isHighlighted = highlightIndex === index;

  // Income flows = gold, expense flows = muted red
  const isIncomeFlow = (payload?.source ?? 0) < incomeCount;
  const stroke = isIncomeFlow ? CHART_COLORS.primary : '#EF4444';

  return (
    <Layer key={`link-${index.toString()}`}>
      <path
        d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        fill="none"
        stroke={stroke}
        strokeWidth={linkWidth}
        strokeOpacity={isHighlighted ? 0.55 : 0.2}
        style={{ cursor: 'pointer', transition: 'stroke-opacity 0.2s' }}
        onClick={() => {
          if (payload) {
            onLinkClick(
              { source: payload.source, target: payload.target, value: payload.value },
              index,
            );
          }
        }}
        onMouseEnter={(e) => {
          (e.target as SVGPathElement).setAttribute('stroke-opacity', '0.5');
        }}
        onMouseLeave={(e) => {
          (e.target as SVGPathElement).setAttribute(
            'stroke-opacity',
            isHighlighted ? '0.55' : '0.2',
          );
        }}
      />
    </Layer>
  );
}

function MoneyFlowSankeyInner() {
  const [period, setPeriod] = useState('quarter');
  const [minThreshold, setMinThreshold] = useState(10);
  const [includeTransfers, setIncludeTransfers] = useState(false);
  const [selectedNode, setSelectedNode] = useState<SankeyNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<SankeyLink | null>(null);
  const [highlightLinkIndex, setHighlightLinkIndex] = useState<number | null>(null);

  const { nodes, links, summary, transactions, loading, error } = useMoneyFlow(period, {
    minThreshold,
    includeTransfers,
  });

  // Compute segment counts for coloring
  const { incomeCount, accountCount } = useMemo(() => {
    let income = 0;
    let account = 0;
    for (const node of nodes) {
      const name = node.name;
      if (name.startsWith('Account ') || name === 'Main Account') {
        account++;
      } else {
        // Determine if it is an income or expense node by checking link topology
        const asSource = links.some((l) => nodes[l.source]?.name === name);
        const asTarget = links.some((l) => nodes[l.target]?.name === name);
        if (asSource && !asTarget) income++;
        else if (!asSource && asTarget) {
          // expense node -- not counted here
        } else if (asSource && asTarget) account++;
        else income++; // isolated node fallback
      }
    }
    return { incomeCount: income, accountCount: account };
  }, [nodes, links]);

  const handleNodeClick = useCallback((node: SankeyNode, _index: number) => {
    setSelectedNode(node);
    setSelectedLink(null);
    setHighlightLinkIndex(null);
  }, []);

  const handleLinkClick = useCallback((link: SankeyLink, index: number) => {
    setSelectedLink(link);
    setSelectedNode(null);
    setHighlightLinkIndex(index);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedNode(null);
    setSelectedLink(null);
    setHighlightLinkIndex(null);
  }, []);

  const hasData = nodes.length > 0 && links.length > 0;

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <FlowSummaryCards summary={summary} loading={loading} />

      {/* Controls */}
      <div className="neu-raised rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Period selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-gray-800 border border-cba-gold/30 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:border-cba-gold focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/50"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Min threshold slider */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Min Flow</label>
            <input
              type="range"
              min={0}
              max={500}
              step={10}
              value={minThreshold}
              onChange={(e) => setMinThreshold(Number(e.target.value))}
              className="w-24 accent-[#FFCC00]"
            />
            <span className="text-xs text-gray-300 w-10">${minThreshold}</span>
          </div>

          {/* Transfers toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTransfers}
              onChange={(e) => setIncludeTransfers(e.target.checked)}
              className="rounded bg-gray-700 border-gray-600 text-cba-gold focus:ring-[#FFCC00]/50"
            />
            <span className="text-xs text-gray-400">Include Transfers</span>
          </label>
        </div>
      </div>

      {/* Sankey Diagram */}
      <div className="relative overflow-x-auto">
        <div className="min-w-[600px]">
          <ChartContainer
            title="Money Flow"
            subtitle="How money flows from income sources through accounts to expenses"
            height={500}
            loading={loading}
            error={error ?? undefined}
          >
            {hasData ? (
              <RechartsSankey
                data={{ nodes, links }}
                nodeWidth={14}
                nodePadding={28}
                node={
                  (
                    <SankeyNodeRenderer
                      incomeCount={incomeCount}
                      accountCount={accountCount}
                      nodeCount={nodes.length}
                      onNodeClick={handleNodeClick}
                    />
                  ) as React.ReactElement
                }
                link={
                  (
                    <SankeyLinkRenderer
                      incomeCount={incomeCount}
                      onLinkClick={handleLinkClick}
                      highlightIndex={highlightLinkIndex}
                    />
                  ) as React.ReactElement
                }
                margin={{ top: 10, right: 160, bottom: 10, left: 160 }}
              >
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #FFCC00',
                    borderRadius: 8,
                  }}
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
            ) : (
              <RechartsSankey
                data={{ nodes: [{ name: '' }], links: [] }}
                node={(() => null) as unknown as React.ReactElement}
                link={(() => null) as unknown as React.ReactElement}
              >
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#9CA3AF"
                  fontSize={14}
                >
                  No flow data for this period
                </text>
              </RechartsSankey>
            )}
          </ChartContainer>

          {/* Detail Panel */}
          <MoneyFlowDetail
            selectedNode={selectedNode}
            selectedLink={selectedLink}
            nodes={nodes}
            onClose={handleCloseDetail}
            transactions={transactions}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="neu-raised rounded-xl p-4">
        <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Flow Legend</h4>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div
              className="w-8 h-1 rounded"
              style={{ backgroundColor: CHART_COLORS.primary, opacity: 0.6 }}
            />
            <span className="text-gray-300">Income flows</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-1 rounded" style={{ backgroundColor: '#EF4444', opacity: 0.6 }} />
            <span className="text-gray-300">Expense flows</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS.revenue }} />
            <span className="text-gray-300">Income sources</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS.primary }} />
            <span className="text-gray-300">Accounts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#F97316' }} />
            <span className="text-gray-300">Expense categories</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const MoneyFlowSankey = React.memo(MoneyFlowSankeyInner);
