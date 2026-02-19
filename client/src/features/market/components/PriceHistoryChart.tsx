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
  price: number;
}

interface PriceHistoryChartProps {
  data: HistoryPoint[];
  formatPrice: (price: number) => string;
}

export default function PriceHistoryChart({ data, formatPrice }: PriceHistoryChartProps) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="date" stroke="#666" fontSize={10} />
          <YAxis stroke="#666" fontSize={10} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a2e',
              border: '1px solid rgba(255,204,0,0.2)',
              borderRadius: '0.75rem',
              color: '#fff',
              fontSize: '12px',
            }}
            formatter={(value: number) => [`$${formatPrice(value)}`, 'Price']}
          />
          <Line
            type="monotone"
            dataKey="price"
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
