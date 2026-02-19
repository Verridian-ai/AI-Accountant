import React, { Suspense } from 'react';

interface ForecastPeriod {
  period: string;
  predictedInflow: number;
  predictedOutflow: number;
  predictedNet: number;
  confidenceUpper: number;
  confidenceLower: number;
  actualInflow?: number | null;
  actualOutflow?: number | null;
  actualNet?: number | null;
}

interface ForecastChartProps {
  periods: ForecastPeriod[];
  granularity: string;
}

const ForecastChartImpl = React.lazy(() => import('./ForecastChartImpl'));

export function ForecastChart({ periods, granularity }: ForecastChartProps) {
  if (!periods.length) {
    return (
      <div className="neu-inset rounded-2xl p-8 text-center text-muted">
        <p className="text-lg font-medium">No forecast data available</p>
        <p className="text-sm mt-1">Generate a forecast to see projections</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="neu-raised rounded-2xl p-6 h-[460px] animate-pulse" />}>
      <ForecastChartImpl periods={periods} granularity={granularity} />
    </Suspense>
  );
}
