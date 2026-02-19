import { useState, useEffect } from 'react';
import { fetchSystemMetrics } from '../../../api';
import { BarChart3, Cpu, HardDrive, Wifi, Clock } from 'lucide-react';

interface MetricPoint {
  timestamp: string;
  value: number;
}

interface MetricsData {
  memory: { used: number; total: number; pct: number; history: MetricPoint[] };
  cpu: { usage: number; history: MetricPoint[] };
  apiLatency: { avg: number; p95: number; p99: number; history: MetricPoint[] };
  database: {
    queryAvgMs: number;
    connectionPool: number;
    maxConnections: number;
    history: MetricPoint[];
  };
}

export function SystemMetricsCharts() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('6h');

  useEffect(() => {
    loadMetrics();
  }, [timeRange]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetchSystemMetrics({ range: timeRange });
      setMetrics(res);
    } catch {
      /* */
    }
    setLoading(false);
  };

  const renderSparkline = (history: MetricPoint[], color: string, maxVal?: number) => {
    if (!history || history.length < 2) return null;
    const max = maxVal || Math.max(...history.map((h) => h.value), 1);
    const width = 100;
    const height = 40;
    const points = history
      .map((h, i) => {
        const x = (i / (history.length - 1)) * width;
        const y = height - (h.value / max) * height;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12" preserveAspectRatio="none">
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
        <polyline
          fill={`${color}20`}
          stroke="none"
          points={`0,${height} ${points} ${width},${height}`}
        />
      </svg>
    );
  };

  const gaugeArc = (pct: number, color: string) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;
    return (
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#1a1a2e" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">System Metrics</h2>
        <div className="animate-pulse h-64 rounded-2xl bg-[#16213e]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">System Metrics</h2>
          <p className="text-sm text-muted">
            Memory, CPU, API latency, and database performance
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-[#1a1a2e] p-1">
          {(['1h', '6h', '24h'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeRange === r ? 'bg-cba-gold text-[#1a1a2e]' : 'text-secondary hover:text-primary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Gauge Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Memory */}
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-5 flex flex-col items-center">
          <HardDrive className="w-5 h-5 text-blue-400 mb-2" />
          <div className="relative">
            {gaugeArc(metrics?.memory?.pct ?? 0, '#3b82f6')}
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-primary rotate-90">
              {(metrics?.memory?.pct ?? 0).toFixed(0)}%
            </span>
          </div>
          <p className="text-xs text-secondary mt-2">Memory Usage</p>
          <p className="text-[10px] text-zinc-600">
            {((metrics?.memory?.used ?? 0) / 1073741824).toFixed(1)}GB /{' '}
            {((metrics?.memory?.total ?? 0) / 1073741824).toFixed(1)}GB
          </p>
        </div>

        {/* CPU */}
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-5 flex flex-col items-center">
          <Cpu className="w-5 h-5 text-emerald-400 mb-2" />
          <div className="relative">
            {gaugeArc(metrics?.cpu?.usage ?? 0, '#10b981')}
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-primary rotate-90">
              {(metrics?.cpu?.usage ?? 0).toFixed(0)}%
            </span>
          </div>
          <p className="text-xs text-secondary mt-2">CPU Usage</p>
        </div>

        {/* API Latency */}
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-5 flex flex-col items-center">
          <Wifi className="w-5 h-5 text-cba-gold mb-2" />
          <p className="text-3xl font-bold text-primary">
            {(metrics?.apiLatency?.avg ?? 0).toFixed(0)}
          </p>
          <p className="text-xs text-secondary mt-1">Avg Latency (ms)</p>
          <div className="flex gap-4 mt-2 text-[10px] text-muted">
            <span>P95: {(metrics?.apiLatency?.p95 ?? 0).toFixed(0)}ms</span>
            <span>P99: {(metrics?.apiLatency?.p99 ?? 0).toFixed(0)}ms</span>
          </div>
        </div>

        {/* Database */}
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-5 flex flex-col items-center">
          <Clock className="w-5 h-5 text-violet-400 mb-2" />
          <p className="text-3xl font-bold text-primary">
            {(metrics?.database?.queryAvgMs ?? 0).toFixed(1)}
          </p>
          <p className="text-xs text-secondary mt-1">DB Avg Query (ms)</p>
          <p className="text-[10px] text-muted mt-2">
            Pool: {metrics?.database?.connectionPool ?? 0}/{metrics?.database?.maxConnections ?? 0}
          </p>
        </div>
      </div>

      {/* Time Series Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memory History */}
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
          <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-blue-400" /> Memory History
          </h3>
          {renderSparkline(metrics?.memory?.history || [], '#3b82f6', metrics?.memory?.total)}
          {(!metrics?.memory?.history || metrics.memory.history.length < 2) && (
            <p className="text-xs text-muted text-center py-4">Insufficient data</p>
          )}
        </div>

        {/* CPU History */}
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
          <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" /> CPU History
          </h3>
          {renderSparkline(metrics?.cpu?.history || [], '#10b981', 100)}
          {(!metrics?.cpu?.history || metrics.cpu.history.length < 2) && (
            <p className="text-xs text-muted text-center py-4">Insufficient data</p>
          )}
        </div>

        {/* API Latency History */}
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
          <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
            <Wifi className="w-4 h-4 text-cba-gold" /> API Latency History
          </h3>
          {renderSparkline(metrics?.apiLatency?.history || [], '#FFCC00')}
          {(!metrics?.apiLatency?.history || metrics.apiLatency.history.length < 2) && (
            <p className="text-xs text-muted text-center py-4">Insufficient data</p>
          )}
        </div>

        {/* Database History */}
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
          <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-400" /> Database Query Time
          </h3>
          {renderSparkline(metrics?.database?.history || [], '#8b5cf6')}
          {(!metrics?.database?.history || metrics.database.history.length < 2) && (
            <p className="text-xs text-muted text-center py-4">Insufficient data</p>
          )}
        </div>
      </div>
    </div>
  );
}
