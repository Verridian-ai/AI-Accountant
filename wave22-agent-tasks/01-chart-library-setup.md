# Agent 1: Chart Library Setup

## Role
Install Recharts and create 10 shared chart components with a gold-themed color palette. These form the foundation for all visualization work in Wave 22.

## Priority: WAVE 22 (Start Immediately)

## Files to CREATE

### 1. `client/src/components/charts/ChartColorPalette.ts`
**Purpose**: Centralized color system for all charts, matching neumorphic dark theme with gold accents

```typescript
export const CHART_COLORS = {
  // Primary palette (gold-themed)
  primary: '#FFCC00',        // Gold - primary accent
  primaryLight: '#FFE066',   // Light gold
  primaryDark: '#CC9900',    // Dark gold

  // Revenue (greens)
  revenue: '#22C55E',
  revenueDark: '#16A34A',

  // Expense (warm tones)
  expense: '#EF4444',
  expenseDark: '#DC2626',

  // Category colors (10-stop gradient)
  categories: [
    '#FFCC00', '#FF9500', '#FF5733', '#C70039', '#900C3F',
    '#581845', '#2E86C1', '#28B463', '#F39C12', '#8E44AD',
  ],

  // Neutral/system
  grid: '#374151',
  axis: '#9CA3AF',
  tooltip: '#1F2937',
  background: 'transparent',
};

export const CHART_THEME = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  tooltipStyle: { backgroundColor: '#1F2937', border: '1px solid #FFCC00', borderRadius: 8 },
};
```

- [ ] Define complete color palette matching existing `categoryColors.ts` semantic system
- [ ] Export `CHART_COLORS`, `CHART_THEME`, and helper `getCategoryColor(index: number)`

### 2. `client/src/components/charts/ChartContainer.tsx`
**Purpose**: Wrapper component providing consistent sizing, responsive behavior, and loading states

- [ ] Props: `title?: string`, `subtitle?: string`, `height?: number` (default 300), `loading?: boolean`, `error?: string`, `children: ReactNode`
- [ ] Responsive: Use `ResponsiveContainer` from Recharts
- [ ] Loading state: Skeleton animation with neu-inset background
- [ ] Error state: Gold-bordered error message
- [ ] Title: Gold text, subtitle gray-400

### 3. `client/src/components/charts/BarChart.tsx`
**Purpose**: Reusable bar chart with gold-themed styling

- [ ] Props: `data: Array<Record<string, any>>`, `dataKeys: string[]`, `xAxisKey: string`, `stacked?: boolean`, `horizontal?: boolean`, `colors?: string[]`
- [ ] Default colors from `CHART_COLORS.categories`
- [ ] Gold grid lines, dark tooltip with gold border
- [ ] Animated bars with 500ms duration

### 4. `client/src/components/charts/LineChart.tsx`
**Purpose**: Reusable line chart for trends and time series

- [ ] Props: `data`, `dataKeys`, `xAxisKey`, `curved?: boolean` (default true), `showDots?: boolean`, `showArea?: boolean`, `colors?: string[]`
- [ ] Gold primary line, gradient area fill when `showArea` is true
- [ ] Custom tooltip with formatted values (currency, percentage, count)

### 5. `client/src/components/charts/PieChart.tsx`
**Purpose**: Reusable pie/donut chart for category breakdowns

- [ ] Props: `data: Array<{name: string, value: number}>`, `innerRadius?: number` (0 for pie, 60 for donut), `showLabels?: boolean`, `showLegend?: boolean`
- [ ] Colors from `CHART_COLORS.categories`
- [ ] Active sector highlight on hover
- [ ] Center label for donut (total value)

### 6. `client/src/components/charts/ScatterPlot.tsx`
**Purpose**: Reusable scatter plot for correlation analysis

- [ ] Props: `data`, `xKey: string`, `yKey: string`, `sizeKey?: string`, `colorKey?: string`, `xLabel?: string`, `yLabel?: string`
- [ ] Gold dots with size mapping
- [ ] Zoom support via `ReferenceArea`
- [ ] Regression line option

### 7. `client/src/components/charts/Sparkline.tsx`
**Purpose**: Compact inline chart for KPI tiles and table cells

- [ ] Props: `data: number[]`, `width?: number` (default 100), `height?: number` (default 30), `color?: string` (default gold), `showArea?: boolean`, `trend?: 'up' | 'down' | 'flat'`
- [ ] No axes, no labels, no tooltip -- pure visual indicator
- [ ] Green tint for upward trend, red for downward, gold for flat

### 8. `client/src/components/charts/ComposedChart.tsx`
**Purpose**: Mixed chart combining bars, lines, and areas

- [ ] Props: `data`, `bars: BarConfig[]`, `lines: LineConfig[]`, `areas: AreaConfig[]`, `xAxisKey: string`
- [ ] Each series independently configurable (color, yAxisId for dual-axis)
- [ ] Useful for budget vs actual (bars) with trend line overlay

### 9. `client/src/components/charts/TreeMap.tsx`
**Purpose**: TreeMap for hierarchical spending breakdown

- [ ] Props: `data: Array<{name: string, value: number, children?: any[]}>`, `colorScale?: string[]`
- [ ] Gold-to-red color gradient based on value
- [ ] Click to drill into children
- [ ] Show name and formatted value in each cell

### 10. `client/src/components/charts/Sankey.tsx`
**Purpose**: Sankey diagram for money flow visualization

- [ ] Props: `nodes: Array<{name: string}>`, `links: Array<{source: number, target: number, value: number}>`, `colors?: string[]`
- [ ] Gold links with opacity gradient
- [ ] Hover to highlight full flow path
- [ ] Node labels with formatted currency values

### 11. `client/src/components/charts/index.ts`
**Purpose**: Barrel export for all chart components

- [ ] Export all 9 chart components + ChartColorPalette + ChartContainer

## Files to MODIFY

### 12. `client/package.json`
- [ ] Add dependency: `recharts@^2.12`
- [ ] Run `npm install` to update lock file

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] All 9 chart components render without errors when given sample data
- [ ] ChartColorPalette exports are importable
- [ ] Responsive behavior: charts resize correctly at sm/md/lg breakpoints
- [ ] Gold theme is consistent across all chart types
- [ ] Create marker file: `.agent-done-W22-01`

## Dependencies
- **None** -- can start immediately
- **Reuses**: Existing Tailwind config, neumorphic classes, categoryColors.ts for reference
