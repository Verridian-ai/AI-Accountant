import { formatCurrency } from '@/utils/formatters';

export function GSTBar({
  label,
  amount,
  total,
  color,
}: {
  label: string;
  amount: number;
  total: number;
  color: string;
}) {
  const percent = total > 0 ? (Math.abs(amount) / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="font-black text-primary tabular-nums">{formatCurrency(amount)}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-[#1a1a2e]">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(percent, 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}
