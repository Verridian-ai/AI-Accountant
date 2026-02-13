import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DollarSign,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Download,
  PieChart,
} from 'lucide-react';

// Types
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  userCount: number;
  revenue: number;
  color: string;
}

export interface RevenueMetric {
  label: string;
  value: number;
  change: number;
  period: string;
}

export interface ChurnData {
  month: string;
  churned: number;
  gained: number;
  net: number;
}

interface SubscriptionOverviewProps {
  onExportData?: (format: 'csv' | 'json') => void;
  className?: string;
}

// Mock data
const mockPlans: SubscriptionPlan[] = [
  { id: 'free', name: 'Free', price: 0, userCount: 1245, revenue: 0, color: '#71717a' },
  { id: 'pro', name: 'Pro', price: 1999, userCount: 567, revenue: 1133433, color: '#FFCC00' },
  {
    id: 'business',
    name: 'Business',
    price: 4999,
    userCount: 189,
    revenue: 944811,
    color: '#22c55e',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 9999,
    userCount: 45,
    revenue: 449955,
    color: '#3b82f6',
  },
];

const mockRevenueMetrics: RevenueMetric[] = [
  { label: 'Monthly Recurring Revenue', value: 252819900, change: 12.4, period: 'vs last month' },
  { label: 'Annual Run Rate', value: 3033838800, change: 8.7, period: 'projected' },
  { label: 'Average Revenue Per User', value: 125000, change: 3.2, period: 'vs last month' },
  { label: 'Customer Lifetime Value', value: 1875000, change: 5.1, period: 'vs last quarter' },
];

const mockChurnData: ChurnData[] = [
  { month: 'Aug', churned: 23, gained: 67, net: 44 },
  { month: 'Sep', churned: 18, gained: 82, net: 64 },
  { month: 'Oct', churned: 31, gained: 95, net: 64 },
  { month: 'Nov', churned: 15, gained: 78, net: 63 },
  { month: 'Dec', churned: 28, gained: 112, net: 84 },
  { month: 'Jan', churned: 19, gained: 89, net: 70 },
];

export function SubscriptionOverview({ onExportData, className }: SubscriptionOverviewProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetric[]>([]);
  const [churnData, setChurnData] = useState<ChurnData[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState('month');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setPlans(mockPlans);
      setRevenueMetrics(mockRevenueMetrics);
      setChurnData(mockChurnData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, periodFilter]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const totalUsers = plans.reduce((sum, plan) => sum + plan.userCount, 0);
  const totalRevenue = plans.reduce((sum, plan) => sum + plan.revenue, 0);
  const paidUsers = plans.filter((p) => p.price > 0).reduce((sum, p) => sum + p.userCount, 0);

  if (loading) {
    return <SubscriptionOverviewSkeleton className={className} />;
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Revenue Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {revenueMetrics.map((metric) => (
          <div
            key={metric.label}
            className="neu-raised rounded-[2rem] p-6 interactive-card group relative overflow-hidden border border-white/5"
          >
            <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />
            <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-0 group-hover:opacity-40 transition-opacity duration-700 bg-emerald-500" />

            <div className="relative space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">
                  {metric.label}
                </p>
              </div>
              <h3 className="text-2xl font-black tracking-tighter text-gradient-gold">
                {formatCurrency(metric.value)}
              </h3>
              <div className="flex items-center gap-1">
                {metric.change >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-red-400" />
                )}
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-widest',
                    metric.change >= 0 ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {Math.abs(metric.change)}% {metric.period}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Plan Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart Visualization */}
        <div className="neu-raised rounded-[2rem] p-6 relative overflow-hidden border border-white/5">
          <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />

          <div className="relative flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="neu-inset p-3 rounded-xl border border-white/5">
                <PieChart className="w-5 h-5 text-[#FFCC00]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-100">Plan Distribution</h3>
                <p className="text-xs text-zinc-500">{totalUsers.toLocaleString()} total users</p>
              </div>
            </div>
          </div>

          {/* Simple Donut Chart */}
          <div className="relative flex items-center justify-center py-4">
            <svg width="200" height="200" viewBox="0 0 200 200">
              {(() => {
                let currentAngle = -90;
                return plans.map((plan) => {
                  const percentage = (plan.userCount / totalUsers) * 100;
                  const angle = (percentage / 100) * 360;
                  const startAngle = currentAngle;
                  currentAngle += angle;

                  const x1 = 100 + 70 * Math.cos((startAngle * Math.PI) / 180);
                  const y1 = 100 + 70 * Math.sin((startAngle * Math.PI) / 180);
                  const x2 = 100 + 70 * Math.cos(((startAngle + angle) * Math.PI) / 180);
                  const y2 = 100 + 70 * Math.sin(((startAngle + angle) * Math.PI) / 180);

                  const largeArcFlag = angle > 180 ? 1 : 0;

                  const pathData = [
                    `M 100 100`,
                    `L ${x1} ${y1}`,
                    `A 70 70 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                    `Z`,
                  ].join(' ');

                  return (
                    <path
                      key={plan.id}
                      d={pathData}
                      fill={plan.color}
                      opacity={0.8}
                      className="transition-opacity hover:opacity-100"
                    />
                  );
                });
              })()}
              {/* Inner circle for donut effect */}
              <circle cx="100" cy="100" r="45" fill="#0a0a0f" />
              {/* Center text */}
              <text x="100" y="95" textAnchor="middle" className="fill-zinc-400 text-xs">
                Paid Users
              </text>
              <text
                x="100"
                y="115"
                textAnchor="middle"
                className="fill-[#FFCC00] text-lg font-bold"
              >
                {Math.round((paidUsers / totalUsers) * 100)}%
              </text>
            </svg>
          </div>

          {/* Legend */}
          <div className="relative grid grid-cols-2 gap-3 mt-4">
            {plans.map((plan) => (
              <div key={plan.id} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plan.color }} />
                <span className="text-sm text-zinc-400">{plan.name}</span>
                <span className="text-sm text-zinc-600 ml-auto">
                  {plan.userCount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by Plan */}
        <div className="neu-raised rounded-[2rem] p-6 relative overflow-hidden border border-white/5">
          <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />

          <div className="relative flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="neu-inset p-3 rounded-xl border border-white/5">
                <DollarSign className="w-5 h-5 text-[#FFCC00]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-100">Revenue by Plan</h3>
                <p className="text-xs text-zinc-500">{formatCurrency(totalRevenue)} this period</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onExportData?.('csv')}>
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>

          <div className="relative space-y-4">
            {plans
              .filter((p) => p.price > 0)
              .map((plan) => {
                const percentage = totalRevenue > 0 ? (plan.revenue / totalRevenue) * 100 : 0;
                return (
                  <div key={plan.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-white/10"
                          style={{ borderColor: plan.color, color: plan.color }}
                        >
                          {plan.name}
                        </Badge>
                        <span className="text-xs text-zinc-500">{plan.userCount} users</span>
                      </div>
                      <span className="text-sm font-semibold text-zinc-200">
                        {formatCurrency(plan.revenue)}
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: plan.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Churn Analysis */}
      <div className="neu-raised rounded-[2rem] p-6 relative overflow-hidden border border-white/5">
        <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="neu-inset p-3 rounded-xl border border-white/5">
              <Users className="w-5 h-5 text-[#FFCC00]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100">User Growth & Churn</h3>
              <p className="text-xs text-zinc-500">Monthly subscriber changes</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="quarter">Quarterly</SelectItem>
                <SelectItem value="year">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Churn Chart */}
        <div className="relative h-[200px] mt-4">
          <div className="flex items-end justify-between h-full gap-4 px-2">
            {churnData.map((data) => {
              const maxValue = Math.max(...churnData.map((d) => Math.max(d.churned, d.gained)));
              return (
                <div key={data.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex gap-1 items-end h-[160px]">
                    {/* Gained */}
                    <div
                      className="w-4 bg-emerald-500/60 rounded-t transition-all hover:bg-emerald-500"
                      style={{
                        height: `${(data.gained / maxValue) * 140}px`,
                      }}
                      title={`Gained: ${data.gained}`}
                    />
                    {/* Churned */}
                    <div
                      className="w-4 bg-red-500/60 rounded-t transition-all hover:bg-red-500"
                      style={{
                        height: `${(data.churned / maxValue) * 140}px`,
                      }}
                      title={`Churned: ${data.churned}`}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500">{data.month}</span>
                  <span
                    className={cn(
                      'text-[10px] font-semibold',
                      data.net >= 0 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {data.net >= 0 ? '+' : ''}
                    {data.net}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="relative flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500/60" />
            <span className="text-xs text-zinc-400">New Subscribers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500/60" />
            <span className="text-xs text-zinc-400">Churned</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubscriptionOverviewSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="neu-raised rounded-[2rem] p-6 border border-white/5">
            <div className="space-y-3">
              <Skeleton className="w-32 h-3 rounded" />
              <Skeleton className="w-24 h-8 rounded" />
              <Skeleton className="w-20 h-3 rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="neu-raised rounded-[2rem] p-6 border border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="w-11 h-11 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="w-32 h-5 rounded" />
              <Skeleton className="w-24 h-3 rounded" />
            </div>
          </div>
          <Skeleton className="w-[200px] h-[200px] rounded-full mx-auto" />
        </div>
        <div className="neu-raised rounded-[2rem] p-6 border border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="w-11 h-11 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="w-32 h-5 rounded" />
              <Skeleton className="w-24 h-3 rounded" />
            </div>
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="w-full h-4 rounded" />
                <Skeleton className="w-full h-2 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
