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
import { formatAUD, formatAUDShort } from './utils';
import {
  ASSET_ALLOCATION,
  DEPRECIATION_SCHEDULE,
  generateAssetValueOverTime,
  INVENTORY_CATEGORIES,
} from './mockData';
import { DonutCenterLabel } from './DonutCenterLabel';
import { InventoryTreeMapContent } from './InventoryTreeMapContent';

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
          { label: 'Total Assets', value: formatAUD(totalAssets), color: 'text-cba-gold' },
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
              formatter={(value: string | number | Array<string | number>) => [
                formatAUD(Number(value)),
                '',
              ]}
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
              formatter={(value: string | number | Array<string | number>, name: string) => {
                if (value == null) return ['-', name];
                const labels: Record<string, string> = {
                  equipment: 'Equipment',
                  vehicles: 'Vehicles',
                  property: 'Property',
                  equipmentProj: 'Equipment (Proj)',
                  vehiclesProj: 'Vehicles (Proj)',
                  propertyProj: 'Property (Proj)',
                };
                return [formatAUD(Number(value)), labels[name] ?? name];
              }}
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
          <h3 className="text-cba-gold font-semibold text-sm">Inventory Breakdown</h3>
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
            content={<InventoryTreeMapContent x={0} y={0} width={0} height={0} />}
          >
            <Tooltip
              contentStyle={CHART_THEME.tooltipStyle}
              formatter={(value: string | number | Array<string | number>) => [
                formatAUD(Number(value)),
                '',
              ]}
            />
          </RechartsTreemap>{' '}
        </ChartContainer>
      </div>
    </div>
  );
}

export default React.memo(InventoryValuationInner);
