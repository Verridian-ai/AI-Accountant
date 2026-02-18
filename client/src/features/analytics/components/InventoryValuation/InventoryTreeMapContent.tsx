import { CHART_COLORS } from '@/components/charts';
import { formatAUD } from './utils';
import type { TreeMapContentProps } from './types';

export function InventoryTreeMapContent(props: TreeMapContentProps) {
  const { x, y, width, height: h, name, value, fill } = props;
  if (width < 30 || h < 20) return null;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={h}
        fill={fill ?? CHART_COLORS.primary}
        fillOpacity={0.85}
        stroke="#1F2937"
        strokeWidth={2}
        rx={4}
      />
      {width > 55 && h > 28 && (
        <>
          <text x={x + 6} y={y + 16} fill="#FFFFFF" fontSize={11} fontWeight="bold">
            {name && name.length > Math.floor(width / 7)
              ? `${name.slice(0, Math.floor(width / 7))}…`
              : name}
          </text>
          {value !== undefined && h > 40 && (
            <text x={x + 6} y={y + 32} fill="#E5E7EB" fontSize={10}>
              {formatAUD(value)}
            </text>
          )}
        </>
      )}
    </g>
  );
}
