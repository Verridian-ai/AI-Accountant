import React, { useMemo } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart as RechartsLineChart,
  Line,
  Treemap as RechartsTreemap,
} from 'recharts';
import { ChartContainer, CHART_COLORS, CHART_THEME } from '@/components/charts';

// ─── Types ────────────────────────────────────────────────

interface AssetAllocation {
  name: string;
  value: number;
  color: string;
}

interface DepreciationAsset {
  name: string;
  originalCost: number;
  bookValue: number;
  currentYearDep: number;
}

interface AssetValuePoint {
  year: string;
  equipment: number;
  vehicles: number;
  property: number;
  equipmentProj?: number;
  vehiclesProj?: number;
  propertyProj?: number;
}

interface InventoryItem {
  name: string;
  value: number;
  daysSinceRestock: number;
}

interface TreeMapLeaf {
  name: string;
  value: number;
  fill: string;
}

interface TreeMapCategory {
  name: string;
  children: TreeMapLeaf[];
}

// ─── Mock data ────────────────────────────────────────────

const ASSET_ALLOCATION: AssetAllocation[] = [
  { name: 'Equipment', value: 185000, color: CHART_COLORS.primary },
  { name: 'Vehicles', value: 120000, color: '#2E86C1' },
  { name: 'Property', value: 450000, color: '#28B463' },
  { name: 'Inventory', value: 67000, color: '#FF9500' },
  { name: 'Intangibles', value: 35000, color: '#8E44AD' },
];

const DEPRECIATION_SCHEDULE: DepreciationAsset[] = [
  { name: 'CNC Machine', originalCost: 95000, bookValue: 62000, currentYearDep: 9500 },
  { name: 'Delivery Van', originalCost: 55000, bookValue: 28000, currentYearDep: 11000 },
  { name: 'Office Fitout', originalCost: 42000, bookValue: 31500, currentYearDep: 4200 },
  { name: 'Warehouse', originalCost: 450000, bookValue: 405000, currentYearDep: 11250 },
  { name: 'Forklift', originalCost: 38000, bookValue: 15200, currentYearDep: 7600 },
  { name: 'IT Systems', originalCost: 28000, bookValue: 9800, currentYearDep: 7000 },
];

function generateAssetValueOverTime(): AssetValuePoint[] {
  const data: AssetValuePoint[] = [];
  // Historical (actual values)
  const years = ['FY20', 'FY21', 'FY22', 'FY23', 'FY24', 'FY25'];
  let equip = 120000,
    veh = 65000,
    prop = 480000;
  for (const year of years) {
    data.push({
      year,
      equipment: equip,
      vehicles: veh,
      property: prop,
    });
    equip = Math.round(equip * 0.9 + (year === 'FY22' ? 40000 : 0));
    veh = Math.round(veh * 0.8 + (year === 'FY23' ? 55000 : 0));
    prop = Math.round(prop * 0.975);
  }
  // Projected (dashed lines)
  const lastActual = data[data.length - 1]!;
  let eqProj = lastActual.equipment;
  let vhProj = lastActual.vehicles;
  let prProj = lastActual.property;
  for (const fy of ['FY26', 'FY27', 'FY28']) {
    eqProj = Math.round(eqProj * 0.9);
    vhProj = Math.round(vhProj * 0.8);
    prProj = Math.round(prProj * 0.975);
    data.push({
      year: fy,
      equipment: fy === 'FY26' ? lastActual.equipment : (undefined as unknown as number),
      vehicles: fy === 'FY26' ? lastActual.vehicles : (undefined as unknown as number),
      property: fy === 'FY26' ? lastActual.property : (undefined as unknown as number),
      equipmentProj: eqProj,
      vehiclesProj: vhProj,
      propertyProj: prProj,
    });
  }
  // Bridge: connect actual to projected by including the last actual point projected values
  const bridgeIdx = years.length - 1;
  const bridgeItem = data[bridgeIdx]!;
  data[bridgeIdx] = {
    ...bridgeItem,
    equipmentProj: bridgeItem.equipment,
    vehiclesProj: bridgeItem.vehicles,
    propertyProj: bridgeItem.property,
  };
  return data;
}

const INVENTORY_CATEGORIES: TreeMapCategory[] = [
  {
    name: 'Raw Materials',
    children: [
      { name: 'Steel', value: 18000, fill: freshnessColor(5) },
      { name: 'Aluminium', value: 12000, fill: freshnessColor(15) },
      { name: 'Timber', value: 8000, fill: freshnessColor(45) },
      { name: 'Plastic', value: 5000, fill: freshnessColor(90) },
    ],
  },
  {
    name: 'Work in Progress',
    children: [
      { name: 'Assembly A', value: 14000, fill: freshnessColor(3) },
      { name: 'Assembly B', value: 9000, fill: freshnessColor(12) },
    ],
  },
  {
    name: 'Finished Goods',
    children: [
      { name: 'Product X', value: 22000, fill: freshnessColor(8) },
      { name: 'Product Y', value: 16000, fill: freshnessColor(60) },
      { name: 'Product Z', value: 7000, fill: freshnessColor(120) },
    ],
  },
];

function freshnessColor(days: number): string {
  if (days <= 14) return '#22C55E'; // green — recent
  if (days <= 30) return '#84CC16'; // lime
  if (days <= 60) return '#F59E0B'; // amber
  if (days <= 90) return '#F97316'; // orange
  return '#EF4444'; // red — overdue
}

// ─── Formatters ───────────────────────────────────────────

function formatAUD(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatAUDShort(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value}`;
}

// ─── TreeMap custom content ───────────────────────────────

interface TreeMapContentProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  value?: number;
  fill?: string;
}

function InventoryTreeMapContent(props: any) {
  const { x, y, width, height: h, name, value, fill } = props as TreeMapContentProps;
  if (width < 30 || h < 20) return null;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={h}
        fill={fill ?? CHART_COLORS.primary}
        fillOpacity={0.85}
        stroke="#1F2937"
        strokeWidth={2}
        rx={4}
      />
      {width > 55 && h > 28 && (
        <>
          <text x={x + 6} y={y + 16} fill="#FFFFFF" fontSize={11} fontWeight="bold">
            {name && name.length > Math.floor(width / 7)
              ? `${name.slice(0, Math.floor(width / 7))}…`
              : name}
          </text>
          {value !== undefined && h > 40 && (
            <text x={x + 6} y={y + 32} fill="#E5E7EB" fontSize={10}>
              {formatAUD(value)}
            </text>
          )}
        </>
      )}
    </g>
  );
}

// ─── Donut center label ───────────────────────────────────

interface CenterLabelProps {
  viewBox?: { cx: number; cy: number };
  total: number;
}

function DonutCenterLabel({ viewBox, total }: CenterLabelProps) {
  const { cx, cy } = viewBox ?? { cx: 0, cy: 0 };
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.5em" fill={CHART_COLORS.primary} fontSize={18} fontWeight="bold">
        {formatAUD(total)}
      </tspan>
      <tspan x={cx} dy="1.6em" fill="#9CA3AF" fontSize={11}>
        Total Assets
      </tspan>
    </text>
  );
}

// ─── Component ────────────────────────────────────────────

function InventoryValuationInner() {
  const totalAssets = useMemo(() => ASSET_ALLOCATION.reduce((s, a) => s + a.value, 0), []);

  const totalDepreciation = useMemo(
    () => DEPRECIATION_SCHEDULE.reduce((s, a) => s + (a.originalCost - a.bookValue), 0),
    [],
  );

  const totalBookValue = useMemo(
    () => DEPRECIATION_SCHEDULE.reduce((s, a) => s + a.bookValue, 0),
    [],
  );

  const depExpenseYTD = useMemo(
    () => DEPRECIATION_SCHEDULE.reduce((s, a) => s + a.currentYearDep, 0),
    [],
  );

  const assetTimelineData = useMemo(() => generateAssetValueOverTime(), []);

  return (
    <div className="space-y-6">
      {/* ── Summary Row ──────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Assets', value: formatAUD(totalAssets), color: 'text-[#FFCC00]' },
          {
            label: 'Total Depreciation',
            value: formatAUD(totalDepreciation),
            color: 'text-red-400',
          },
          { label: 'Net Book Value', value: formatAUD(totalBookValue), color: 'text-emerald-400' },
          { label: 'Dep. Expense YTD', value: formatAUD(depExpenseYTD), color: 'text-amber-400' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl neu-raised p-4">
            <p className="text-xs text-gray-400 mb-1">{item.label}</p>
            <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* ── Asset Allocation Donut ────────────── */}
      <div className="rounded-xl neu-raised p-4">
        <ChartContainer
          title="Asset Allocation"
          subtitle="Current market value by category"
          height={320}
        >
          <RechartsPieChart>
            <Pie
              data={ASSET_ALLOCATION}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={120}
              dataKey="value"
              nameKey="name"
              animationDuration={500}
              label={({ name, percent }: { name: string; percent: number }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
            >
              {ASSET_ALLOCATION.map((entry, i) => (
                <Cell key={`cell-${i.toString()}`} fill={entry.color} />
              ))}
            </Pie>
            <Pie
              data={[{ value: 1 }]}
              cx="50%"
              cy="50%"
              innerRadius={0}
              outerRadius={0}
              dataKey="value"
              isAnimationActive={false}
              label={<DonutCenterLabel total={totalAssets} />}
            />
            <Tooltip
              contentStyle={CHART_THEME.tooltipStyle}
              formatter={((value: number) => [formatAUD(value), '']) as any}
            />
            <Legend
              wrapperStyle={{ color: '#E5E7EB', fontSize: CHART_THEME.fontSize }}
              iconType="circle"
            />
          </RechartsPieChart>
        </ChartContainer>
      </div>

      {/* ── Depreciation Schedule ─────────────── */}
      <div className="rounded-xl neu-raised p-4">
        <ChartContainer
          title="Depreciation Schedule"
          subtitle="Original cost vs book value — gold bar = current year depreciation"
          height={320}
        >
          <RechartsBarChart data={DEPRECIATION_SCHEDULE} margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="name"
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }}
              tickFormatter={(v: number) => formatAUDShort(v)}
            />
            <Tooltip
              contentStyle={CHART_THEME.tooltipStyle}
              labelStyle={{ color: CHART_COLORS.primary }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  originalCost: 'Original Cost',
                  bookValue: 'Book Value',
                  currentYearDep: 'FY Depreciation',
                };
                return [formatAUD(value), labels[name] ?? name];
              }}
            />
            <Legend
              wrapperStyle={{ color: '#E5E7EB', fontSize: CHART_THEME.fontSize }}
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  originalCost: 'Original Cost',
                  bookValue: 'Book Value',
                  currentYearDep: 'FY Depreciation',
                };
                return labels[value] ?? value;
              }}
            />
            <Bar
              dataKey="originalCost"
              fill="#4B5563"
              name="originalCost"
              radius={[4, 4, 0, 0]}
              animationDuration={500}
            />
            <Bar
              dataKey="bookValue"
              fill="#2E86C1"
              name="bookValue"
              radius={[4, 4, 0, 0]}
              animationDuration={500}
            />
            <Bar
              dataKey="currentYearDep"
              fill={CHART_COLORS.primary}
              name="currentYearDep"
              radius={[4, 4, 0, 0]}
              animationDuration={500}
            />
          </RechartsBarChart>
        </ChartContainer>
      </div>

      {/* ── Asset Value Over Time ─────────────── */}
      <div className="rounded-xl neu-raised p-4">
        <ChartContainer
          title="Asset Value Over Time"
          subtitle="Actual (solid) and projected (dashed) depreciation curves"
          height={320}
        >
          <RechartsLineChart data={assetTimelineData}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="year"
              tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }}
            />
            <YAxis
              tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }}
              tickFormatter={(v: number) => formatAUDShort(v)}
            />
            <Tooltip
              contentStyle={CHART_THEME.tooltipStyle}
              labelStyle={{ color: CHART_COLORS.primary }}
              formatter={
                ((value: number | undefined, name: string) => {
                  if (value == null) return ['-', name];
                  const labels: Record<string, string> = {
                    equipment: 'Equipment',
                    vehicles: 'Vehicles',
                    property: 'Property',
                    equipmentProj: 'Equipment (Proj)',
                    vehiclesProj: 'Vehicles (Proj)',
                    propertyProj: 'Property (Proj)',
                  };
                  return [formatAUD(value), labels[name] ?? name];
                }) as any
              }
            />
            <Legend
              wrapperStyle={{ color: '#E5E7EB', fontSize: CHART_THEME.fontSize }}
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  equipment: 'Equipment',
                  vehicles: 'Vehicles',
                  property: 'Property',
                  equipmentProj: 'Equipment (Proj)',
                  vehiclesProj: 'Vehicles (Proj)',
                  propertyProj: 'Property (Proj)',
                };
                return labels[value] ?? value;
              }}
            />
            {/* Actual lines — solid */}
            <Line
              type="monotone"
              dataKey="equipment"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.primary, r: 3 }}
              connectNulls={false}
              name="equipment"
              animationDuration={500}
            />
            <Line
              type="monotone"
              dataKey="vehicles"
              stroke="#2E86C1"
              strokeWidth={2}
              dot={{ fill: '#2E86C1', r: 3 }}
              connectNulls={false}
              name="vehicles"
              animationDuration={500}
            />
            <Line
              type="monotone"
              dataKey="property"
              stroke="#28B463"
              strokeWidth={2}
              dot={{ fill: '#28B463', r: 3 }}
              connectNulls={false}
              name="property"
              animationDuration={500}
            />
            {/* Projected lines — dashed */}
            <Line
              type="monotone"
              dataKey="equipmentProj"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              connectNulls={false}
              name="equipmentProj"
              animationDuration={500}
            />
            <Line
              type="monotone"
              dataKey="vehiclesProj"
              stroke="#2E86C1"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              connectNulls={false}
              name="vehiclesProj"
              animationDuration={500}
            />
            <Line
              type="monotone"
              dataKey="propertyProj"
              stroke="#28B463"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              connectNulls={false}
              name="propertyProj"
              animationDuration={500}
            />
          </RechartsLineChart>
        </ChartContainer>
      </div>

      {/* ── Inventory TreeMap ─────────────────── */}
      <div className="rounded-xl neu-raised p-4">
        <div className="mb-3">
          <h3 className="text-[#FFCC00] font-semibold text-sm">Inventory Breakdown</h3>
          <p className="text-gray-400 text-xs mt-0.5">
            Size by value — color by freshness (green = recent, red = overdue restock)
          </p>
        </div>
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#22C55E' }} />
            {'< 14d'}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#F59E0B' }} />
            30-60d
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#EF4444' }} />
            {'> 90d'}
          </div>
        </div>
        <ChartContainer height={280}>
          <RechartsTreemap
            data={INVENTORY_CATEGORIES}
            dataKey="value"
            aspectRatio={4 / 3}
            animationDuration={500}
            content={(<InventoryTreeMapContent x={0} y={0} width={0} height={0} />) as any}
          >
            <Tooltip
              contentStyle={CHART_THEME.tooltipStyle}
              formatter={((value: number) => [formatAUD(value), '']) as any}
            />
          </RechartsTreemap>{' '}
        </ChartContainer>
      </div>
    </div>
  );
}

export default React.memo(InventoryValuationInner);
