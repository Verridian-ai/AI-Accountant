import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const SCENARIO_COLORS = ['#FFCC00', '#22c55e', '#ef4444', '#8b5cf6', '#06b6d4'];

const formatDollar = (value: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value / 100);

interface ScenarioEntry {
  id: string;
  name: string;
}

interface ScenarioComparerChartProps {
  data: Record<string, number>[];
  scenarios: ScenarioEntry[];
}

export default function ScenarioComparerChart({ data, scenarios }: ScenarioComparerChartProps) {
  return (
    <div className="neu-raised rounded-2xl p-4 sm:p-6">
      <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">
        Net Cash Flow Comparison
      </h4>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
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
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a2e',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
            }}
            labelStyle={{ color: '#a1a1aa' }}
            formatter={(value: number) => formatDollar(value)}
          />
          <Legend
            formatter={(value: string) => (
              <span className="text-xs text-zinc-400">{value}</span>
            )}
          />
          {scenarios.map((s, idx) => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={`scenario_${idx}`}
              stroke={SCENARIO_COLORS[idx % SCENARIO_COLORS.length]}
              strokeWidth={2}
              dot={false}
              name={s.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
