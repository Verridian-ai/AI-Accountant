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
        highlight ? 'bg-cba-gold/5 border border-cba-gold/10' : 'hover:bg-white/[0.02]',
      )}
    >
      <span className={cn('text-[11px]', highlight ? 'font-black text-primary' : 'text-muted')}>
        {label}
      </span>
      <span
        className={cn(
          'tabular-nums',
          highlight ? 'text-sm font-black text-cba-gold' : 'text-sm font-bold text-primary',
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}
