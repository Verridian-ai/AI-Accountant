import { StatCard, StatCardSkeleton } from '@/features/analytics/components/StatCard';
import { Package, DollarSign, TrendingDown, Calculator } from 'lucide-react';
import type { AssetRegisterResponse } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

interface AssetSummaryCardsProps {
  data: AssetRegisterResponse | null;
  loading: boolean;
}

export function AssetSummaryCards({ data, loading }: AssetSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      <StatCard
        title="Total Assets"
        value={String(summary?.totalAssets ?? 0)}
        subtitle="Registered"
        icon={Package}
      />
      <StatCard
        title="Total Cost"
        value={formatCurrency(summary?.totalCost ?? 0)}
        subtitle="Purchase price"
        icon={DollarSign}
      />
      <StatCard
        title="Current WDV"
        value={formatCurrency(summary?.totalWDV ?? 0)}
        subtitle="Written down"
        icon={TrendingDown}
        trend="down"
      />
      <StatCard
        title="Depreciation"
        value={formatCurrency(summary?.totalDepreciationToDate ?? 0)}
        subtitle="Accumulated"
        icon={Calculator}
        trend="down"
      />
    </div>
  );
}
