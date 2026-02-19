import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface PriceSparklineProps {
  price: number;
  isUp: boolean;
}

// Deterministic pseudo-random based on seed (pure — same input → same output)
function pseudoRand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export default function PriceSparkline({ price, isUp }: PriceSparklineProps) {
  const data = Array.from({ length: 10 }, (_, i) => ({
    v: price * (1 + (pseudoRand(price + i) - 0.5) * 0.04),
  }));

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
