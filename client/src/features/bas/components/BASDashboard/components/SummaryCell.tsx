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
    <div className="neu-inset rounded-xl p-3 border border-white/5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-black text-[#FFCC00] uppercase">{label}</span>
        <span className="text-[8px] text-zinc-600 truncate">{title}</span>
      </div>
      <p className="text-sm font-black text-zinc-200 tabular-nums">{formatCurrencyShort(value)}</p>
    </div>
  );
}
