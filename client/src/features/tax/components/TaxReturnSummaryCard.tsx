import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface TaxReturnSummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'positive' | 'negative' | 'warning';
}

export function TaxReturnSummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
}: TaxReturnSummaryCardProps) {
  const colorMap = {
    default: 'text-zinc-100',
    positive: 'text-emerald-400',
    negative: 'text-red-400',
    warning: 'text-amber-400',
  };

  return (
    <Card className="neu-raised border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-secondary flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-cba-gold" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorMap[variant]}`}>{value}</div>
        {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
