import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Activity,
    Cpu,
    Database,
    FileText,
    Server,
    TrendingUp,
    TrendingDown,
    Clock,
    Zap,
    RefreshCw,
    ArrowUpRight,
    ArrowDownRight,
} from 'lucide-react';

// Types
export interface SystemMetric {
    label: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
    trend?: 'up' | 'down' | 'neutral';
    icon: React.ReactNode;
}

export interface APIUsageData {
    endpoint: string;
    calls: number;
    avgLatency: number;
    errorRate: number;
}

export interface TimeSeriesPoint {
    timestamp: string;
    value: number;
}

interface SystemMetricsProps {
    className?: string;
}

// Mock data
const mockMetrics: SystemMetric[] = [
    {
        label: 'Total API Calls',
        value: '48.2K',
        change: 12.5,
        changeLabel: 'vs last week',
        trend: 'up',
        icon: <Activity className="w-5 h-5" />,
    },
    {
        label: 'Avg Response Time',
        value: '127ms',
        change: -8.3,
        changeLabel: 'vs last week',
        trend: 'up',
        icon: <Clock className="w-5 h-5" />,
    },
    {
        label: 'Statements Parsed',
        value: '3,847',
        change: 23.1,
        changeLabel: 'this month',
        trend: 'up',
        icon: <FileText className="w-5 h-5" />,
    },
    {
        label: 'Active Sessions',
        value: '142',
        change: 5.2,
        changeLabel: 'currently',
        trend: 'neutral',
        icon: <Server className="w-5 h-5" />,
    },
];

const mockAPIUsage: APIUsageData[] = [
    { endpoint: '/api/transactions', calls: 15420, avgLatency: 45, errorRate: 0.2 },
    { endpoint: '/api/statements/upload', calls: 3847, avgLatency: 2340, errorRate: 1.8 },
    { endpoint: '/api/chat', calls: 8923, avgLatency: 890, errorRate: 0.5 },
    { endpoint: '/api/categories', calls: 12100, avgLatency: 23, errorRate: 0.1 },
    { endpoint: '/api/accounts', calls: 6780, avgLatency: 34, errorRate: 0.3 },
];

const mockTimeSeriesData: TimeSeriesPoint[] = [
    { timestamp: '00:00', value: 120 },
    { timestamp: '04:00', value: 80 },
    { timestamp: '08:00', value: 340 },
    { timestamp: '12:00', value: 520 },
    { timestamp: '16:00', value: 480 },
    { timestamp: '20:00', value: 380 },
    { timestamp: '24:00', value: 220 },
];

export function SystemMetrics({ className }: SystemMetricsProps) {
    const [metrics, setMetrics] = useState<SystemMetric[]>([]);
    const [apiUsage, setApiUsage] = useState<APIUsageData[]>([]);
    const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('24h');

    const fetchMetrics = useCallback(async () => {
        setLoading(true);
        try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 600));
            setMetrics(mockMetrics);
            setApiUsage(mockAPIUsage);
            setTimeSeriesData(mockTimeSeriesData);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics, timeRange]);

    // Calculate chart dimensions
    const maxValue = Math.max(...timeSeriesData.map((d) => d.value));
    const chartHeight = 120;

    if (loading) {
        return <SystemMetricsSkeleton className={className} />;
    }

    return (
        <div className={cn('space-y-6', className)}>
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {metrics.map((metric, index) => (
                    <div
                        key={metric.label}
                        className="neu-raised rounded-[2rem] p-6 interactive-card group relative overflow-hidden border border-white/5"
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        {/* Background Effects */}
                        <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />
                        <div
                            className={cn(
                                'absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-0 group-hover:opacity-40 transition-opacity duration-700',
                                metric.trend === 'up' && 'bg-emerald-500',
                                metric.trend === 'down' && 'bg-red-500',
                                metric.trend === 'neutral' && 'bg-[#FFCC00]'
                            )}
                        />

                        <div className="relative flex items-start justify-between gap-4">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div
                                        className={cn(
                                            'w-1.5 h-1.5 rounded-full animate-pulse',
                                            metric.trend === 'up' && 'bg-emerald-500',
                                            metric.trend === 'down' && 'bg-red-500',
                                            metric.trend === 'neutral' && 'bg-[#FFCC00]'
                                        )}
                                    />
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.25em]">
                                        {metric.label}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <h3
                                        className={cn(
                                            'text-2xl font-black tracking-tighter leading-none',
                                            metric.trend === 'neutral' && 'text-gradient-gold'
                                        )}
                                    >
                                        {metric.value}
                                    </h3>
                                    {metric.change !== undefined && (
                                        <div className="flex items-center gap-1 mt-1">
                                            {metric.change >= 0 ? (
                                                <ArrowUpRight
                                                    className={cn(
                                                        'w-3 h-3',
                                                        metric.trend === 'up'
                                                            ? 'text-emerald-400'
                                                            : 'text-red-400'
                                                    )}
                                                />
                                            ) : (
                                                <ArrowDownRight
                                                    className={cn(
                                                        'w-3 h-3',
                                                        metric.trend === 'up'
                                                            ? 'text-emerald-400'
                                                            : 'text-red-400'
                                                    )}
                                                />
                                            )}
                                            <span
                                                className={cn(
                                                    'text-[10px] font-bold uppercase tracking-widest',
                                                    metric.trend === 'up'
                                                        ? 'text-emerald-400'
                                                        : metric.trend === 'down'
                                                        ? 'text-red-400'
                                                        : 'text-zinc-500'
                                                )}
                                            >
                                                {Math.abs(metric.change)}% {metric.changeLabel}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div
                                className={cn(
                                    'neu-inset p-4 rounded-2xl transition-all duration-500 shrink-0 border border-white/5',
                                    'group-hover:shadow-[0_0_20px_rgba(255,204,0,0.2)] group-hover:border-[#FFCC00]/30'
                                )}
                            >
                                <div className="text-[#FFCC00]">{metric.icon}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* API Usage Chart */}
            <div className="neu-raised rounded-[2rem] p-6 relative overflow-hidden border border-white/5">
                <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />

                <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="neu-inset p-3 rounded-xl border border-white/5">
                            <Cpu className="w-5 h-5 text-[#FFCC00]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-zinc-100">API Traffic</h3>
                            <p className="text-xs text-zinc-500">Requests over time</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Select value={timeRange} onValueChange={setTimeRange}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1h">Last Hour</SelectItem>
                                <SelectItem value="24h">Last 24h</SelectItem>
                                <SelectItem value="7d">Last 7 Days</SelectItem>
                                <SelectItem value="30d">Last 30 Days</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={fetchMetrics}>
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Simple Bar Chart */}
                <div className="relative h-[140px] mt-4">
                    <div className="flex items-end justify-between h-full gap-2 px-2">
                        {timeSeriesData.map((point, index) => (
                            <div
                                key={point.timestamp}
                                className="flex-1 flex flex-col items-center gap-2"
                            >
                                <div
                                    className="w-full bg-gradient-to-t from-[#FFCC00]/20 to-[#FFCC00]/60 rounded-t-lg transition-all hover:from-[#FFCC00]/30 hover:to-[#FFCC00]/80"
                                    style={{
                                        height: `${(point.value / maxValue) * chartHeight}px`,
                                    }}
                                />
                                <span className="text-[10px] text-zinc-500">{point.timestamp}</span>
                            </div>
                        ))}
                    </div>
                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-0 h-[120px] flex flex-col justify-between text-[10px] text-zinc-600 -ml-6">
                        <span>{maxValue}</span>
                        <span>{Math.round(maxValue / 2)}</span>
                        <span>0</span>
                    </div>
                </div>
            </div>

            {/* Endpoint Usage Table */}
            <div className="neu-raised rounded-[2rem] p-6 relative overflow-hidden border border-white/5">
                <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />

                <div className="relative flex items-center gap-3 mb-6">
                    <div className="neu-inset p-3 rounded-xl border border-white/5">
                        <Database className="w-5 h-5 text-[#FFCC00]" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-zinc-100">Endpoint Usage</h3>
                        <p className="text-xs text-zinc-500">Top API endpoints by call volume</p>
                    </div>
                </div>

                <div className="relative overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                    Endpoint
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                    Calls
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                    Avg Latency
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                    Error Rate
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {apiUsage.map((endpoint) => (
                                <tr
                                    key={endpoint.endpoint}
                                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                                >
                                    <td className="py-3 px-4">
                                        <code className="text-sm text-zinc-300 bg-white/5 px-2 py-1 rounded">
                                            {endpoint.endpoint}
                                        </code>
                                    </td>
                                    <td className="text-right py-3 px-4 text-sm text-zinc-300">
                                        {endpoint.calls.toLocaleString()}
                                    </td>
                                    <td className="text-right py-3 px-4">
                                        <span
                                            className={cn(
                                                'text-sm',
                                                endpoint.avgLatency > 1000
                                                    ? 'text-red-400'
                                                    : endpoint.avgLatency > 200
                                                    ? 'text-amber-400'
                                                    : 'text-emerald-400'
                                            )}
                                        >
                                            {endpoint.avgLatency}ms
                                        </span>
                                    </td>
                                    <td className="text-right py-3 px-4">
                                        <span
                                            className={cn(
                                                'text-sm',
                                                endpoint.errorRate > 1
                                                    ? 'text-red-400'
                                                    : endpoint.errorRate > 0.5
                                                    ? 'text-amber-400'
                                                    : 'text-emerald-400'
                                            )}
                                        >
                                            {endpoint.errorRate}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function SystemMetricsSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn('space-y-6', className)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div
                        key={i}
                        className="neu-raised rounded-[2rem] p-6 relative overflow-hidden border border-white/5"
                    >
                        <div className="flex items-start justify-between">
                            <div className="space-y-3 flex-1">
                                <Skeleton className="w-24 h-3 rounded" />
                                <Skeleton className="w-20 h-8 rounded" />
                                <Skeleton className="w-32 h-3 rounded" />
                            </div>
                            <Skeleton className="w-14 h-14 rounded-2xl shrink-0" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="neu-raised rounded-[2rem] p-6 border border-white/5">
                <div className="flex items-center gap-3 mb-6">
                    <Skeleton className="w-11 h-11 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="w-24 h-5 rounded" />
                        <Skeleton className="w-32 h-3 rounded" />
                    </div>
                </div>
                <Skeleton className="w-full h-[140px] rounded-xl" />
            </div>
        </div>
    );
}
