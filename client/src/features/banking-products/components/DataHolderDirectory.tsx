import { useState, useEffect } from 'react';
import { Building2, RefreshCw, Check, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchDataHolders, triggerCdrCrawl } from '@/api';

interface DataHolder {
  id: string;
  brandName: string;
  abn: string | null;
  productCount: number;
  lastCrawled: string | null;
  status: string;
  logoUrl: string | null;
}

interface CrawlLog {
  id: string;
  dataHolderId: string;
  brandName: string;
  status: string;
  productsFound: number;
  duration: number;
  startedAt: string;
  error: string | null;
}

export function DataHolderDirectory() {
  const [holders, setHolders] = useState<DataHolder[]>([]);
  const [crawlLogs, setCrawlLogs] = useState<CrawlLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await fetchDataHolders();
      setHolders(result.dataHolders ?? result.holders ?? []);
      setCrawlLogs(result.crawlLogs ?? result.logs ?? []);
    } catch (e) {
      console.error('Failed to load data holders', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCrawl = async () => {
    setCrawling(true);
    try {
      await triggerCdrCrawl();
      // Refresh after a short delay
      setTimeout(load, 2000);
    } catch (e) {
      console.error('Crawl failed', e);
    } finally {
      setCrawling(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'success':
      case 'completed':
        return 'text-emerald-400';
      case 'error':
      case 'failed':
        return 'text-red-400';
      case 'pending':
      case 'crawling':
        return 'text-amber-400';
      default:
        return 'text-secondary';
    }
  };

  const statusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'success':
      case 'completed':
        return Check;
      case 'error':
      case 'failed':
        return AlertTriangle;
      default:
        return Clock;
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {holders.length} data holder{holders.length !== 1 ? 's' : ''} registered
        </p>
        <button
          onClick={handleCrawl}
          disabled={crawling}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all',
            crawling
              ? 'neu-raised-sm text-muted'
              : 'bg-cba-gold text-base hover:bg-[#FFD633]',
          )}
        >
          <RefreshCw className={cn('h-4 w-4', crawling && 'animate-spin')} />
          {crawling ? 'Crawling...' : 'Full Crawl'}
        </button>
      </div>

      {/* Data Holder Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="neu-raised rounded-2xl p-5 animate-pulse space-y-3">
              <div className="h-10 w-10 bg-zinc-700/40 rounded-xl" />
              <div className="h-4 w-2/3 bg-zinc-700/40 rounded" />
              <div className="h-3 w-1/2 bg-zinc-700/40 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {holders.map((holder) => {
            const StatusIcon = statusIcon(holder.status);
            return (
              <div key={holder.id} className="neu-raised rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="neu-inset p-2.5 rounded-xl shrink-0">
                    <Building2 className="h-5 w-5 text-secondary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-zinc-100 truncate">{holder.brandName}</p>
                    {holder.abn && <p className="text-xs text-muted">ABN: {holder.abn}</p>}
                  </div>
                  <div className={cn('shrink-0', statusColor(holder.status))}>
                    <StatusIcon className="h-4 w-4" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">
                    <span className="text-primary font-bold">{holder.productCount}</span> products
                  </span>
                  <span className="text-zinc-600">
                    {holder.lastCrawled
                      ? `Crawled ${new Date(holder.lastCrawled).toLocaleDateString('en-AU')}`
                      : 'Never crawled'}
                  </span>
                </div>
              </div>
            );
          })}
          {holders.length === 0 && (
            <div className="col-span-full text-center py-12 text-zinc-600">
              No data holders registered. Run a full crawl to populate.
            </div>
          )}
        </div>
      )}

      {/* Crawl Log */}
      {crawlLogs.length > 0 && (
        <div className="neu-raised rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-primary">Recent Crawl History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-3 text-xs text-muted font-semibold">
                    Provider
                  </th>
                  <th className="text-left py-2 px-3 text-xs text-muted font-semibold">
                    Status
                  </th>
                  <th className="text-right py-2 px-3 text-xs text-muted font-semibold">
                    Products
                  </th>
                  <th className="text-right py-2 px-3 text-xs text-muted font-semibold">
                    Duration
                  </th>
                  <th className="text-right py-2 px-3 text-xs text-muted font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {crawlLogs.slice(0, 20).map((log) => (
                  <tr key={log.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 px-3 text-primary">{log.brandName}</td>
                    <td className={cn('py-2 px-3 font-semibold', statusColor(log.status))}>
                      {log.status}
                    </td>
                    <td className="py-2 px-3 text-right text-secondary">{log.productsFound}</td>
                    <td className="py-2 px-3 text-right text-muted">
                      {(log.duration / 1000).toFixed(1)}s
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-600">
                      {new Date(log.startedAt).toLocaleDateString('en-AU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
