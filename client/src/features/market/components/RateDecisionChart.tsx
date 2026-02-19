import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface RateDecision {
  date: string;
  rate: number;
  change: number;
  direction: 'hold' | 'increase' | 'decrease';
}

interface RateDecisionChartProps {
  history: RateDecision[];
  currentRate?: number;
}

export default function RateDecisionChart({ history, currentRate }: RateDecisionChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="date" stroke="#666" fontSize={10} />
          <YAxis
            stroke="#666"
            fontSize={10}
            domain={['dataMin - 0.5', 'dataMax + 0.5']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a2e',
              border: '1px solid rgba(255,204,0,0.2)',
              borderRadius: '0.75rem',
              color: '#fff',
              fontSize: '12px',
            }}
            formatter={(value: number) => [`${value.toFixed(2)}%`, 'Cash Rate']}
          />
          {currentRate != null && (
            <ReferenceLine
              y={currentRate}
              stroke="#FFCC00"
              strokeDasharray="5 5"
              label={{ value: 'Current', fill: '#FFCC00', fontSize: 10 }}
            />
          )}
          <Line
            type="stepAfter"
            dataKey="rate"
            stroke="#FFCC00"
            strokeWidth={2}
            dot={{ fill: '#FFCC00', r: 4 }}
            activeDot={{ r: 6, fill: '#FFCC00' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
