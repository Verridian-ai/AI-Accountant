import React from 'react';
import { ResponsiveContainer } from 'recharts';

interface ChartContainerProps {
  title?: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  error?: string;
  children: React.ReactNode;
}

function ChartContainerInner({
  title,
  subtitle,
  height = 300,
  loading,
  error,
  children,
}: ChartContainerProps) {
  if (loading) {
    return (
      <div className="rounded-xl neu-inset p-4">
        {title && (
          <div className="mb-3">
            <div className="h-5 w-40 rounded bg-gray-700 animate-pulse" />
          </div>
        )}
        <div className="w-full rounded-lg bg-gray-800/50 animate-pulse" style={{ height }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl neu-inset p-4 border border-[#FFCC00]/30">
        {title && <h3 className="text-[#FFCC00] font-semibold mb-2">{title}</h3>}
        <div className="flex items-center justify-center text-red-400 text-sm" style={{ height }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl neu-inset p-4">
      {(title ?? subtitle) && (
        <div className="mb-3">
          {title && <h3 className="text-[#FFCC00] font-semibold text-sm">{title}</h3>}
          {subtitle && <p className="text-gray-400 text-xs mt-0.5">{subtitle}</p>}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export const ChartContainer = React.memo(ChartContainerInner);
