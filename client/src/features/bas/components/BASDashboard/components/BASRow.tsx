import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';

export function BASRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex justify-between items-center py-2 px-3 rounded-lg text-sm transition-colors',
        highlight ? 'bg-[#FFCC00]/5 border border-[#FFCC00]/10' : 'hover:bg-white/[0.02]',
      )}
    >
      <span className={cn('text-[11px]', highlight ? 'font-black text-zinc-200' : 'text-zinc-500')}>
        {label}
      </span>
      <span
        className={cn(
          'tabular-nums',
          highlight ? 'text-sm font-black text-[#FFCC00]' : 'text-sm font-bold text-zinc-300',
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}
