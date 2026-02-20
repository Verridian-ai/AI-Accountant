import { useState, useEffect, useCallback } from 'react';
import { anomalyApi } from '../../../api';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Loader2,
  Search,
  AlertOctagon,
  Info,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

interface AnomalyAlert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  transactionId?: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  detectedAt: string;
}

interface AnomalyStats {
  open: number;
  acknowledged: number;
  resolved: number;
  total: number;
}

interface AnomalyAlertPanelProps {
  userId: string;
}

const severityConfig: Record<
  string,
  { icon: typeof AlertTriangle; color: string; bg: string; order: number }
> = {
  critical: {
    icon: AlertOctagon,
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-500/30',
    order: 0,
  },
  high: {
    icon: AlertTriangle,
    color: 'text-orange-400',
    bg: 'bg-orange-400/10 border-orange-500/30',
    order: 1,
  },
  medium: {
    icon: Info,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10 border-yellow-500/30',
    order: 2,
  },
  low: { icon: Info, color: 'text-secondary', bg: 'bg-zinc-400/10 border-zinc-500/30', order: 3 },
};

export function AnomalyAlertPanel({ userId }: AnomalyAlertPanelProps) {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [stats, setStats] = useState<AnomalyStats>({
    open: 0,
    acknowledged: 0,
    resolved: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const [alertData, statsData] = await Promise.all([
        anomalyApi.list(userId),
        anomalyApi.stats(userId),
      ]);
      const list = alertData.alerts ?? alertData ?? [];
      setAlerts(
        list.sort(
          (a: AnomalyAlert, b: AnomalyAlert) =>
            (severityConfig[a.severity]?.order ?? 9) - (severityConfig[b.severity]?.order ?? 9),
        ),
      );
      setStats(statsData);
    } catch (e) {
      console.error('Failed to load anomaly alerts', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleScan = async () => {
    try {
      setScanning(true);
      await anomalyApi.scan({ userId, detectors: ['all'] });
      await loadAlerts();
    } catch (e) {
      console.error('Failed to scan', e);
    } finally {
      setScanning(false);
    }
  };

  const handleAction = async (alertId: string, action: 'acknowledge' | 'resolve' | 'dismiss') => {
    try {
      if (action === 'acknowledge') await anomalyApi.acknowledge(alertId);
      else if (action === 'resolve') await anomalyApi.resolve(alertId, userId);
      else await anomalyApi.dismiss(alertId, 'User dismissed');
      await loadAlerts();
    } catch (e) {
      console.error(`Failed to ${action} alert`, e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-cba-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-6 neu-inset px-4 py-2 rounded-xl">
          <span className="text-xs font-bold text-red-400">Open: {stats.open}</span>
          <span className="text-xs font-bold text-yellow-400">Ack: {stats.acknowledged}</span>
          <span className="text-xs font-bold text-emerald-400">Resolved: {stats.resolved}</span>
        </div>

        <button
          onClick={handleScan}
          disabled={scanning}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-cba-gold text-base font-bold text-sm hover:bg-[#FFD633] transition-colors disabled:opacity-50"
        >
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Run Scan
        </button>
      </div>

      {/* Alert Cards */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="neu-raised rounded-2xl p-8 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-primary font-medium">No anomalies detected</p>
            <p className="text-muted text-sm mt-1">Run a scan to check for issues</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const sc = severityConfig[alert.severity] ?? severityConfig.low;
            const Icon = sc.icon;
            return (
              <div key={alert.id} className={cn('neu-raised rounded-2xl p-4 border', sc.bg)}>
                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-xl neu-inset', sc.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-primary font-bold text-sm">{alert.title}</h4>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                          sc.color,
                          sc.bg,
                        )}
                      >
                        {alert.severity}
                      </span>
                      {alert.status !== 'open' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-secondary bg-zinc-400/10">
                          {alert.status}
                        </span>
                      )}
                    </div>
                    <p className="text-secondary text-xs">{alert.description}</p>
                    <p className="text-zinc-600 text-[10px] mt-1">
                      Detected: {new Date(alert.detectedAt).toLocaleString('en-AU')}
                    </p>
                  </div>
                  {alert.status === 'open' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleAction(alert.id, 'acknowledge')}
                        title="Acknowledge"
                        className="p-1.5 rounded-lg text-yellow-400 hover:bg-yellow-400/10 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleAction(alert.id, 'resolve')}
                        title="Resolve"
                        className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleAction(alert.id, 'dismiss')}
                        title="Dismiss"
                        className="p-1.5 rounded-lg text-secondary hover:bg-zinc-400/10 transition-colors"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
