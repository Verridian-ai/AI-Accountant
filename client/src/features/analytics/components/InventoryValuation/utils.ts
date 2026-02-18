export function freshnessColor(days: number): string {
  if (days <= 14) return '#22C55E'; // green — recent
  if (days <= 30) return '#84CC16'; // lime
  if (days <= 60) return '#F59E0B'; // amber
  if (days <= 90) return '#F97316'; // orange
  return '#EF4444'; // red — overdue
}

export function formatAUD(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatAUDShort(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value}`;
}
