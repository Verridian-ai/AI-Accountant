import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface PriceSparklineProps {
  price: number;
  isUp: boolean;
}

export default function PriceSparkline({ price, isUp }: PriceSparklineProps) {
  const data = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        v: price + (Math.random() - 0.5) * price * 0.02 * (i + 1),
      })),
    [price],
  );

  return (
    <div className="mt-2 h-6">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={isUp ? '#34d399' : '#f87171'}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
