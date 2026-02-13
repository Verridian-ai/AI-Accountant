import { useState, useEffect } from 'react';
import { fetchSystemHealth, fetchHealthHistory, fetchDiskUsage } from '../../../api';
import {
  Server,
  CheckCircle,
  AlertTriangle,
  XCircle,
  HardDrive,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTimeMs?: number;
  lastCheck?: string;
  details?: Record<string, unknown>;
}

interface HealthData {
  status: string;
  uptime: number;
  services: ServiceHealth[];
}

interface DiskInfo {
  path: string;
  total: number;
  used: number;
  available: number;
  pct: number;
}

export function SystemHealthDashboard() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [disk, setDisk] = useState<DiskInfo[]>([]);
  const [history, setHistory] = useState<
    Array<{ timestamp: string; status: string; service: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [h, d, hist] = await Promise.allSettled([
        fetchSystemHealth(),
        fetchDiskUsage(),
        fetchHealthHistory(undefined, 24),
      ]);
      if (h.status === 'fulfilled') setHealth(h.value);
      if (d.status === 'fulfilled')
        setDisk(Array.isArray(d.value) ? d.value : d.value?.disks || []);
      if (hist.status === 'fulfilled')
        setHistory(Array.isArray(hist.value) ? hist.value : hist.value?.history || []);
    } catch {
      /* */
    }
    setLoading(false);
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-zinc-500" />;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'healthy':
        return 'border-emerald-500/20 bg-emerald-500/5';
      case 'degraded':
        return 'border-yellow-500/20 bg-yellow-500/5';
      case 'unhealthy':
        return 'border-red-500/20 bg-red-500/5';
      default:
        return 'border-zinc-500/20 bg-zinc-500/5';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white">System Health</h2>
        <div className="animate-pulse h-64 rounded-2xl bg-[#16213e]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">System Health</h2>
          <p className="text-sm text-zinc-500">Service status, uptime, and resource usage</p>
        </div>
        <button
          type="button"
          onClick={loadAll}
          className="p-2 rounded-xl bg-[#16213e] text-zinc-400 hover:text-[#FFCC00]"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Overall Status */}
      <div className={`rounded-2xl border p-6 ${statusColor(health?.status || 'unknown')}`}>
        <div className="flex items-center gap-3">
          {statusIcon(health?.status || 'unknown')}
          <div>
            <p className="text-lg font-bold text-white">
              System: {(health?.status || 'unknown').toUpperCase()}
            </p>
            <p className="text-xs text-zinc-500">Uptime: {formatUptime(health?.uptime || 0)}</p>
          </div>
        </div>
      </div>

      {/* Service Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(health?.services || []).map((svc) => (
          <div key={svc.name} className={`rounded-2xl border p-5 ${statusColor(svc.status)}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-bold text-white capitalize">{svc.name}</span>
              </div>
              {statusIcon(svc.status)}
            </div>
            <div className="space-y-1 text-xs text-zinc-400">
              {svc.responseTimeMs !== undefined && <p>Response: {svc.responseTimeMs}ms</p>}
              {svc.lastCheck && <p>Checked: {new Date(svc.lastCheck).toLocaleTimeString()}</p>}
              {svc.details &&
                Object.entries(svc.details).map(([k, v]) => (
                  <p key={k}>
                    {k}: {String(v)}
                  </p>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Disk Usage */}
      {disk.length > 0 && (
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#FFCC00]" /> Disk Usage
          </h3>
          <div className="space-y-4">
            {disk.map((d, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-zinc-300 font-mono">{d.path}</span>
                  <span
                    className={`font-bold ${d.pct > 90 ? 'text-red-400' : d.pct > 70 ? 'text-yellow-400' : 'text-emerald-400'}`}
                  >
                    {d.pct.toFixed(1)}% used
                  </span>
                </div>
                <div className="h-3 rounded-full bg-[#1a1a2e] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${d.pct > 90 ? 'bg-red-500' : d.pct > 70 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                    style={{ width: `${d.pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                  <span>Used: {formatBytes(d.used)}</span>
                  <span>Available: {formatBytes(d.available)}</span>
                  <span>Total: {formatBytes(d.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Health History */}
      {history.length > 0 && (
        <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6">
          <h3 className="text-lg font-bold text-white mb-4">Health History (24h)</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {history.slice(0, 50).map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${h.status === 'healthy' ? 'bg-emerald-400' : h.status === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'}`}
                  />
                  <span className="text-zinc-300">{h.service}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-bold ${h.status === 'healthy' ? 'text-emerald-400' : h.status === 'degraded' ? 'text-yellow-400' : 'text-red-400'}`}
                  >
                    {h.status}
                  </span>
                  <span className="text-zinc-600">
                    {new Date(h.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
