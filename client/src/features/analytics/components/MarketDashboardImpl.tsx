import React, { useState, useMemo } from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ComposedChart as RechartsComposedChart,
  BarChart as RechartsBarChart,
  Bar,
  Cell,
} from 'recharts';
import { ChartContainer, Sparkline, CHART_COLORS, CHART_THEME } from '@/components/charts';

// ─── Types ────────────────────────────────────────────────
interface KpiTile {
  label: string;
  value: string;
  change: string;
  changeDirection: 'up' | 'down' | 'flat';
  sparklineData: number[];
}

interface CashRatePoint {
  month: string;
  rate: number;
}

interface CpiVsCashPoint {
  quarter: string;
  cpi: number;
  cashRate: number;
}

interface SectorReturn {
  sector: string;
  ytdReturn: number;
}

type Period = '1Y' | '3Y' | '5Y';

// ─── Mock data generators ─────────────────────────────────

function generateCashRateHistory(): CashRatePoint[] {
  const months: CashRatePoint[] = [];
  let rate = 0.1; // start at 0.10% (2020-era low)
  const baseDate = new Date(2021, 0);
  for (let i = 0; i < 60; i++) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + i);
    // Simulate RBA hiking cycle 2022-2023, then plateau/cut 2024-2025
    if (i >= 18 && i < 36) rate = Math.min(rate + 0.15 + Math.random() * 0.1, 4.35);
    else if (i >= 36 && i < 48) rate = Math.max(rate - 0.02, 4.1);
    else if (i >= 48) rate = Math.max(rate - 0.08 - Math.random() * 0.05, 3.6);
    months.push({
      month: d.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
      rate: parseFloat(rate.toFixed(2)),
    });
  }
  return months;
}

function generateCpiVsCash(): CpiVsCashPoint[] {
  const data: CpiVsCashPoint[] = [];
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  let cpi = 1.2;
  let cash = 0.1;
  for (let y = 2021; y <= 2025; y++) {
    for (const q of quarters) {
      if (y === 2022 && q === 'Q2') cpi = 6.1;
      else if (y >= 2023) cpi = Math.max(cpi - 0.3 + Math.random() * 0.2, 2.5);
      else cpi = cpi + 0.5 + Math.random() * 0.5;

      if (y === 2022 && q >= 'Q2') cash = Math.min(cash + 0.5, 4.35);
      else if (y === 2023) cash = Math.min(cash + 0.15, 4.35);
      else if (y >= 2024) cash = Math.max(cash - 0.05, 3.6);

      data.push({
        quarter: `${q} ${String(y).slice(2)}`,
        cpi: parseFloat(cpi.toFixed(1)),
        cashRate: parseFloat(cash.toFixed(2)),
      });
      if (y === 2025 && q === 'Q4') break;
    }
  }
  return data;
}

function generateSectorReturns(): SectorReturn[] {
  return [
    { sector: 'Technology', ytdReturn: 18.4 },
    { sector: 'Healthcare', ytdReturn: 12.1 },
    { sector: 'Financials', ytdReturn: 9.7 },
    { sector: 'Materials', ytdReturn: 7.2 },
    { sector: 'Consumer Disc.', ytdReturn: 4.5 },
    { sector: 'Industrials', ytdReturn: 3.8 },
    { sector: 'Utilities', ytdReturn: 1.2 },
    { sector: 'Consumer Staples', ytdReturn: -0.8 },
    { sector: 'Energy', ytdReturn: -3.5 },
    { sector: 'Real Estate', ytdReturn: -5.2 },
  ].sort((a, b) => b.ytdReturn - a.ytdReturn);
}

// ─── KPI sparkline data ───────────────────────────────────

const KPI_DATA: KpiTile[] = [
  {
    label: 'RBA Cash Rate',
    value: '3.85%',
    change: '-25bp',
    changeDirection: 'down',
    sparklineData: [4.35, 4.35, 4.35, 4.35, 4.35, 4.35, 4.1, 4.1, 4.1, 3.85, 3.85, 3.85],
  },
  {
    label: 'CPI (Annual)',
    value: '3.2%',
    change: '-0.4%',
    changeDirection: 'down',
    sparklineData: [7.8, 7.0, 6.1, 5.4, 4.9, 4.3, 3.8, 3.6, 3.6, 3.4, 3.2, 3.2],
  },
  {
    label: 'AUD/USD',
    value: '$0.6542',
    change: '+0.8c',
    changeDirection: 'up',
    sparklineData: Array.from({ length: 30 }, (_, i) => 0.63 + Math.sin(i / 5) * 0.02 + i * 0.0008),
  },
  {
    label: 'Unemployment',
    value: '4.1%',
    change: '+0.1%',
    changeDirection: 'up',
    sparklineData: [3.5, 3.5, 3.6, 3.7, 3.7, 3.8, 3.8, 3.9, 3.9, 4.0, 4.0, 4.1],
  },
];

// ─── Component ────────────────────────────────────────────

function MarketDashboardInner() {
  const [cashRatePeriod, setCashRatePeriod] = useState<Period>('5Y');

  const cashRateData = useMemo(() => {
    const all = generateCashRateHistory();
    const months = cashRatePeriod === '1Y' ? 12 : cashRatePeriod === '3Y' ? 36 : 60;
    return all.slice(-months);
  }, [cashRatePeriod]);

  const cpiVsCashData = useMemo(() => generateCpiVsCash(), []);
  const sectorData = useMemo(() => generateSectorReturns(), []);

  const currentCashRate = cashRateData[cashRateData.length - 1]?.rate ?? 3.85;

  return (
    <div className="space-y-6">
      {/* ── KPI Tiles ────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_DATA.map((kpi) => (
          <div key={kpi.label} className="rounded-xl neu-raised p-4">
            <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xl font-bold text-primary">{kpi.value}</p>
                <p
                  className={`text-xs mt-0.5 ${
                    kpi.changeDirection === 'up'
                      ? 'text-emerald-400'
                      : kpi.changeDirection === 'down'
                        ? 'text-red-400'
                        : 'text-gray-400'
                  }`}
                >
                  {kpi.change}
                </p>
              </div>
              <Sparkline
                data={kpi.sparklineData}
                width={80}
                height={28}
                showArea
                trend={kpi.changeDirection}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── RBA Cash Rate History ─────────────── */}
      <div className="rounded-xl neu-raised p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-cba-gold font-semibold text-sm">RBA Cash Rate History</h3>
            <p className="text-gray-400 text-xs mt-0.5">
              Monthly target rate — current {currentCashRate}%
            </p>
          </div>
          <div className="flex gap-1">
            {(['1Y', '3Y', '5Y'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setCashRatePeriod(p)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  cashRatePeriod === p
                    ? 'bg-cba-gold text-base'
                    : 'text-gray-400 hover:text-primary neu-inset'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <ChartContainer height={300}>
          <RechartsLineChart data={cashRateData}>
            <defs>
              <linearGradient id="cashRateGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="month"
              tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }}
              interval={cashRatePeriod === '1Y' ? 0 : cashRatePeriod === '3Y' ? 2 : 5}
            />
            <YAxis
              tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }}
              domain={[0, 5]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={CHART_THEME.tooltipStyle}
              labelStyle={{ color: CHART_COLORS.primary }}
              formatter={(value: number) => [`${value}%`, 'Cash Rate']}
            />
            <ReferenceLine
              y={currentCashRate}
              stroke={CHART_COLORS.primary}
              strokeDasharray="4 4"
              label={{
                value: `Current ${currentCashRate}%`,
                fill: CHART_COLORS.primary,
                fontSize: 11,
                position: 'insideTopRight',
              }}
            />
            <Area
              type="stepAfter"
              dataKey="rate"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              fill="url(#cashRateGrad)"
              dot={false}
              animationDuration={500}
            />
          </RechartsLineChart>
        </ChartContainer>
      </div>

      {/* ── CPI vs Cash Rate ─────────────────── */}
      <div className="rounded-xl neu-raised p-4">
        <ChartContainer
          title="CPI vs Cash Rate"
          subtitle="Quarterly — dual-axis comparison"
          height={300}
        >
          <RechartsComposedChart data={cpiVsCashData}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="quarter"
              tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }}
              interval={1}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }}
              tickFormatter={(v: number) => `${v}%`}
              label={{
                value: 'CPI %',
                angle: -90,
                position: 'insideLeft',
                fill: CHART_COLORS.expense,
                fontSize: 11,
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }}
              tickFormatter={(v: number) => `${v}%`}
              label={{
                value: 'Cash Rate %',
                angle: 90,
                position: 'insideRight',
                fill: CHART_COLORS.primary,
                fontSize: 11,
              }}
            />
            <Tooltip
              contentStyle={CHART_THEME.tooltipStyle}
              labelStyle={{ color: CHART_COLORS.primary }}
              formatter={(value: number, name: string) => [
                `${value}%`,
                name === 'cpi' ? 'CPI' : 'Cash Rate',
              ]}
            />
            <Legend
              wrapperStyle={{ color: '#E5E7EB', fontSize: CHART_THEME.fontSize }}
              formatter={(value: string) => (value === 'cpi' ? 'CPI (Annual)' : 'Cash Rate')}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="cpi"
              stroke={CHART_COLORS.expense}
              strokeWidth={2}
              dot={false}
              name="cpi"
              animationDuration={500}
            />
            <Line
              yAxisId="right"
              type="stepAfter"
              dataKey="cashRate"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              dot={false}
              name="cashRate"
              animationDuration={500}
            />
          </RechartsComposedChart>
        </ChartContainer>
      </div>

      {/* ── Sector Performance ───────────────── */}
      <div className="rounded-xl neu-raised p-4">
        <ChartContainer
          title="ASX Sector Performance"
          subtitle="Year-to-date returns by sector"
          height={380}
        >
          <RechartsBarChart data={sectorData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: CHART_COLORS.axis, fontSize: CHART_THEME.fontSize }}
              tickFormatter={(v: number) => `${v}%`}
            />
            <YAxis
              dataKey="sector"
              type="category"
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              width={110}
            />
            <Tooltip
              contentStyle={CHART_THEME.tooltipStyle}
              labelStyle={{ color: CHART_COLORS.primary }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, 'YTD Return']}
            />
            <ReferenceLine x={0} stroke={CHART_COLORS.axis} strokeWidth={1} />
            <Bar dataKey="ytdReturn" animationDuration={500} radius={[0, 4, 4, 0]}>
              {sectorData.map((entry, i) => (
                <Cell
                  key={`cell-${i.toString()}`}
                  fill={entry.ytdReturn >= 0 ? CHART_COLORS.revenue : CHART_COLORS.expense}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </RechartsBarChart>
        </ChartContainer>
      </div>
    </div>
  );
}

export default React.memo(MarketDashboardInner);
