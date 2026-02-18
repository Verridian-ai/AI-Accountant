import { CHART_COLORS } from '@/components/charts';
import { formatAUD } from './utils';
import type { CenterLabelProps } from './types';

export function DonutCenterLabel({ viewBox, total }: CenterLabelProps) {
  const { cx, cy } = viewBox ?? { cx: 0, cy: 0 };
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.5em" fill={CHART_COLORS.primary} fontSize={18} fontWeight="bold">
        {formatAUD(total)}
      </tspan>
      <tspan x={cx} dy="1.6em" fill="#9CA3AF" fontSize={11}>
        Total Assets
      </tspan>
    </text>
  );
}
