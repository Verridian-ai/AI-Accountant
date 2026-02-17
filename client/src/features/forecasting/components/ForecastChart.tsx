import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
  ComposedChart,
} from 'recharts';

interface ForecastPeriod {
  period: string;
  predictedInflow: number;
  predictedOutflow: number;
  predictedNet: number;
  confidenceUpper: number;
  confidenceLower: number;
  actualInflow?: number | null;
  actualOutflow?: number | null;
  actualNet?: number | null;
}

interface ForecastChartProps {
  periods: ForecastPeriod[];
  granularity: string;
}

const formatDollar = (value: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value / 100);

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; color: string; name: string; value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="neu-raised p-3 rounded-xl border border-white/10 text-xs space-y-1">
      <p className="font-bold text-zinc-300">{label}</p>
      {payload.map((entry: { dataKey: string; color: string; name: string; value: number }) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {formatDollar(entry.value)}
        </p>
      ))}
    </div>
  );
};

export function ForecastChart({ periods, granularity }: ForecastChartProps) {
  if (!periods.length) {
    return (
      <div className="neu-inset rounded-2xl p-8 text-center text-zinc-500">
        <p className="text-lg font-medium">No forecast data available</p>
        <p className="text-sm mt-1">Generate a forecast to see projections</p>
      </div>
    );
  }

  const hasActuals = periods.some((p) => p.actualNet != null);

  return (
    <div className="neu-raised rounded-2xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-zinc-100">Cash Flow Projection</h3>
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{granularity}</span>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={periods} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FFCC00" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#FFCC00" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="period"
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          />
          <YAxis
            tickFormatter={(v: number) => formatDollar(v)}
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 12 }}
            formatter={(value: string) => <span className="text-xs text-zinc-400">{value}</span>}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />

          {/* Confidence band */}
          <Area
            type="monotone"
            dataKey="confidenceUpper"
            stroke="none"
            fill="transparent"
            name="Confidence Upper"
            legendType="none"
          />
          <Area
            type="monotone"
            dataKey="confidenceLower"
            stroke="none"
            fill="url(#goldGradient)"
            name="Confidence Band"
            legendType="none"
          />

          {/* Predicted lines */}
          <Area
            type="monotone"
            dataKey="predictedInflow"
            stroke="#22c55e"
            fill="none"
            strokeWidth={2}
            name="Pred. Inflow"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="predictedOutflow"
            stroke="#ef4444"
            fill="none"
            strokeWidth={2}
            name="Pred. Outflow"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="predictedNet"
            stroke="#FFCC00"
            fill="none"
            strokeWidth={2.5}
            name="Pred. Net"
            dot={false}
          />

          {/* Actual data overlay */}
          {hasActuals && (
            <>
              <Scatter dataKey="actualInflow" fill="#22c55e" name="Actual Inflow" shape="circle" />
              <Scatter
                dataKey="actualOutflow"
                fill="#ef4444"
                name="Actual Outflow"
                shape="circle"
              />
              <Scatter dataKey="actualNet" fill="#FFCC00" name="Actual Net" shape="diamond" />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
