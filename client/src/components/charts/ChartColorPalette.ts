/**
 * Centralized color system for all Recharts-based charts.
 * Gold-themed to match the GoldLedger neumorphic dark UI.
 */

export const CHART_COLORS = {
  primary: '#FFCC00',
  primaryLight: '#FFE066',
  primaryDark: '#CC9900',
  revenue: '#22C55E',
  revenueDark: '#16A34A',
  expense: '#EF4444',
  expenseDark: '#DC2626',
  categories: [
    '#FFCC00',
    '#FF9500',
    '#FF5733',
    '#C70039',
    '#900C3F',
    '#581845',
    '#2E86C1',
    '#28B463',
    '#F39C12',
    '#8E44AD',
  ] as const,
  grid: '#374151',
  axis: '#9CA3AF',
  tooltip: '#1F2937',
  background: 'transparent',
} as const;

export const CHART_THEME = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  tooltipStyle: {
    backgroundColor: '#1F2937',
    border: '1px solid #FFCC00',
    borderRadius: 8,
  },
} as const;

export function getCategoryColor(index: number): string {
  return CHART_COLORS.categories[index % CHART_COLORS.categories.length] ?? CHART_COLORS.primary;
}
