import { formatCurrencyShort } from '../utils.js';

export function SummaryCell({
  label,
  title,
  value,
}: {
  label: string;
  title: string;
  value: number;
}) {
  return (
    <div className="neu-inset rounded-xl p-3 border border-border/50">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-black text-cba-gold uppercase">{label}</span>
        <span className="text-[8px] text-zinc-600 truncate">{title}</span>
      </div>
      <p className="text-sm font-black text-primary tabular-nums">{formatCurrencyShort(value)}</p>
    </div>
  );
}
