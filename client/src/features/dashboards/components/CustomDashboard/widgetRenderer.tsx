import React from 'react';
import {
  BarChart,
  LineChart,
  PieChart,
  ComposedChart,
  ScatterPlot,
  TreeMap,
  Sankey,
  CHART_COLORS,
} from '@/components/charts';
import type { WidgetConfig } from '../../hooks/useDashboard';
import { KPICard } from './KPICard';
import {
  DEMO_BAR_DATA,
  DEMO_LINE_DATA,
  DEMO_PIE_DATA,
  DEMO_SCATTER_DATA,
  DEMO_TREEMAP_DATA,
  DEMO_SANKEY,
} from './demoData';

export function renderWidget(
  widget: WidgetConfig,
  widgetData: Record<string, unknown[]>,
): React.ReactNode {
  const data = widgetData[widget.id];
  const config = widget.config ?? {};

  switch (widget.chartType) {
    case 'bar':
      return (
        <BarChart
          data={(data as Record<string, unknown>[]) ?? DEMO_BAR_DATA}
          dataKeys={(config.dataKeys as string[]) ?? ['value']}
          xAxisKey={(config.xAxisKey as string) ?? 'name'}
          stacked={Boolean(config.stacked)}
          title={widget.title}
          height={200}
        />
      );
    case 'line':
      return (
        <LineChart
          data={(data as Record<string, unknown>[]) ?? DEMO_LINE_DATA}
          dataKeys={(config.dataKeys as string[]) ?? ['value']}
          xAxisKey={(config.xAxisKey as string) ?? 'date'}
          curved={config.curved !== false}
          showArea={Boolean(config.showArea)}
          title={widget.title}
          height={200}
        />
      );
    case 'pie':
      return (
        <PieChart
          data={(data as Array<{ name: string; value: number }>) ?? DEMO_PIE_DATA}
          showLabels={config.showLabels !== false}
          showLegend={config.showLegend !== false}
          title={widget.title}
          height={200}
        />
      );
    case 'donut':
      return (
        <PieChart
          data={(data as Array<{ name: string; value: number }>) ?? DEMO_PIE_DATA}
          innerRadius={(config.innerRadius as number) ?? 60}
          showLabels={config.showLabels !== false}
          showLegend={config.showLegend !== false}
          title={widget.title}
          height={200}
        />
      );
    case 'scatter':
      return (
        <ScatterPlot
          data={(data as Record<string, unknown>[]) ?? DEMO_SCATTER_DATA}
          xKey={(config.xKey as string) ?? 'x'}
          yKey={(config.yKey as string) ?? 'y'}
          title={widget.title}
          height={200}
        />
      );
    case 'composed':
      return (
        <ComposedChart
          data={(data as Record<string, unknown>[]) ?? DEMO_BAR_DATA}
          bars={
            (config.bars as Array<{ dataKey: string; color: string }>) ?? [
              { dataKey: 'value', color: CHART_COLORS.primary },
            ]
          }
          lines={(config.lines as Array<{ dataKey: string; color: string }>) ?? []}
          areas={(config.areas as Array<{ dataKey: string; color: string }>) ?? []}
          xAxisKey={(config.xAxisKey as string) ?? 'name'}
          title={widget.title}
          height={200}
        />
      );
    case 'treemap':
      return (
        <TreeMap
          data={
            (data as Array<{
              name: string;
              value?: number;
              children?: Array<{ name: string; value?: number }>;
            }>) ?? DEMO_TREEMAP_DATA
          }
          title={widget.title}
          height={200}
        />
      );
    case 'sankey': {
      const sankeyData = data
        ? {
            nodes:
              (
                data as unknown as {
                  nodes: Array<{ name: string }>;
                  links: Array<{ source: number; target: number; value: number }>;
                }
              ).nodes ?? DEMO_SANKEY.nodes,
            links:
              (
                data as unknown as {
                  nodes: Array<{ name: string }>;
                  links: Array<{ source: number; target: number; value: number }>;
                }
              ).links ?? DEMO_SANKEY.links,
          }
        : DEMO_SANKEY;
      return (
        <Sankey
          nodes={sankeyData.nodes}
          links={sankeyData.links}
          title={widget.title}
          height={200}
        />
      );
    }
    case 'kpi':
      return (
        <KPICard
          label={(config.metricLabel as string) ?? 'Metric'}
          value={42850}
          previousValue={38200}
          format={(config.format as 'currency' | 'number' | 'percent') ?? 'currency'}
        />
      );
    default:
      return (
        <div className="flex items-center justify-center h-full text-muted text-sm">
          Unknown widget type: {widget.chartType}
        </div>
      );
  }
}
