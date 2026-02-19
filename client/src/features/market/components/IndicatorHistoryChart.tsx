import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface HistoryPoint {
  date: string;
  value: number;
}

interface IndicatorHistoryChartProps {
  data: HistoryPoint[];
}

export default function IndicatorHistoryChart({ data }: IndicatorHistoryChartProps) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="date" stroke="#666" fontSize={11} />
          <YAxis stroke="#666" fontSize={11} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a2e',
              border: '1px solid rgba(255,204,0,0.2)',
              borderRadius: '0.75rem',
              color: '#fff',
              fontSize: '12px',
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#FFCC00"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#FFCC00' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
