import React from 'react';
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Circle,
  ScatterChart,
  Layers,
  TreePine,
  GitBranch,
  Activity,
  X,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { WidgetConfig } from '../hooks/useDashboard';

interface WidgetType {
  chartType: WidgetConfig['chartType'];
  name: string;
  description: string;
  icon: React.ElementType;
  defaultConfig: Record<string, unknown>;
}

const WIDGET_TYPES: WidgetType[] = [
  {
    chartType: 'bar',
    name: 'Bar Chart',
    description: 'Compare values across categories with vertical or horizontal bars',
    icon: BarChart3,
    defaultConfig: {
      dataKeys: ['value'],
      xAxisKey: 'name',
      stacked: false,
    },
  },
  {
    chartType: 'line',
    name: 'Line Chart',
    description: 'Track trends over time with smooth or straight lines',
    icon: LineChartIcon,
    defaultConfig: {
      dataKeys: ['value'],
      xAxisKey: 'date',
      curved: true,
      showDots: false,
    },
  },
  {
    chartType: 'pie',
    name: 'Pie Chart',
    description: 'Show proportions and distribution of a whole',
    icon: PieChartIcon,
    defaultConfig: {
      showLabels: true,
      showLegend: true,
    },
  },
  {
    chartType: 'donut',
    name: 'Donut Chart',
    description: 'Like a pie chart but with a centre hole for KPI display',
    icon: Circle,
    defaultConfig: {
      innerRadius: 60,
      showLabels: true,
      showLegend: true,
    },
  },
  {
    chartType: 'scatter',
    name: 'Scatter Plot',
    description: 'Visualise correlations between two numeric dimensions',
    icon: ScatterChart,
    defaultConfig: {
      xKey: 'x',
      yKey: 'y',
    },
  },
  {
    chartType: 'composed',
    name: 'Composed Chart',
    description: 'Mix bars, lines, and areas for multi-metric views',
    icon: Layers,
    defaultConfig: {
      bars: [],
      lines: [],
      areas: [],
      xAxisKey: 'name',
    },
  },
  {
    chartType: 'treemap',
    name: 'TreeMap',
    description: 'Display hierarchical data as nested rectangles by size',
    icon: TreePine,
    defaultConfig: {},
  },
  {
    chartType: 'sankey',
    name: 'Sankey Diagram',
    description: 'Show flow and volume between stages or categories',
    icon: GitBranch,
    defaultConfig: {
      nodes: [],
      links: [],
    },
  },
  {
    chartType: 'kpi',
    name: 'KPI Card',
    description: 'Single metric with trend indicator and sparkline',
    icon: Activity,
    defaultConfig: {
      metricLabel: 'Metric',
      format: 'currency',
    },
  },
];

interface WidgetPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (widget: WidgetConfig) => void;
}

export function WidgetPicker({ open, onClose, onSelect }: WidgetPickerProps) {
  if (!open) return null;

  const handleSelect = (wt: WidgetType) => {
    const widget: WidgetConfig = {
      id: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      chartType: wt.chartType,
      title: wt.name,
      position: { col: 0, row: 0, width: 6, height: 4 },
      config: { ...wt.defaultConfig },
    };
    onSelect(widget);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative neu-raised rounded-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#FFCC00]/20 shrink-0">
          <h3 className="text-lg font-bold text-gradient-gold">Add Widget</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Widget Types Grid */}
        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {WIDGET_TYPES.map((wt) => (
              <button
                key={wt.chartType}
                onClick={() => handleSelect(wt)}
                className={cn(
                  'neu-raised-sm rounded-xl p-4 text-left border border-transparent',
                  'hover:border-[#FFCC00]/30 hover:shadow-[0_0_15px_rgba(255,204,0,0.08)]',
                  'transition-all duration-200 group'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="neu-inset p-2 rounded-lg text-[#FFCC00] group-hover:shadow-[0_0_10px_rgba(255,204,0,0.15)] transition-shadow">
                    <wt.icon className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-zinc-100 text-sm">{wt.name}</h4>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {wt.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
