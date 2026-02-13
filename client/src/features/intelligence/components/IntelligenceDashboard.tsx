import { useState, useEffect } from 'react';
import { Brain, Lightbulb, Clock, Link, Bell, Activity, Scan, Search } from 'lucide-react';
import { InsightFeed } from './InsightFeed';
import { IntelligenceTimeline } from './IntelligenceTimeline';
import { TemporalQueryBuilder } from './TemporalQueryBuilder';
import { ModuleConnectionMap } from './ModuleConnectionMap';
import { SubscriptionManager } from './SubscriptionManager';
import { CorrelationExplorer } from './CorrelationExplorer';
import { intelligenceApi } from '../../../api';
import { cn } from '../../../lib/utils';

type TabId = 'insights' | 'timeline' | 'temporal' | 'modules' | 'subscriptions' | 'correlations';

const tabs: { id: TabId; label: string; icon: typeof Brain }[] = [
  { id: 'insights', label: 'Insights', icon: Lightbulb },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'temporal', label: 'Temporal Queries', icon: Search },
  { id: 'modules', label: 'Module Map', icon: Link },
  { id: 'subscriptions', label: 'Subscriptions', icon: Bell },
  { id: 'correlations', label: 'Correlations', icon: Activity },
];

export function IntelligenceDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('insights');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stats, setStats] = useState<{ insightCount: number; criticalAlerts: number; activeSubscriptions: number } | null>(null);
  const [scanning, setScanning] = useState(false);

  const userId = 'default';

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Attempt to load insight stats in parallel
      const [insights, subs] = await Promise.all([
        intelligenceApi.listInsights(userId).catch(() => []),
        intelligenceApi.listSubscriptions(userId).catch(() => []),
      ]);
      const insightList = Array.isArray(insights) ? insights : (insights as any).insights ?? [];
      const subList = Array.isArray(subs) ? subs : (subs as any).subscriptions ?? [];
      setStats({
        insightCount: insightList.length,
        criticalAlerts: insightList.filter((i: any) => i.severity === 'critical' && i.status === 'new').length,
        activeSubscriptions: subList.filter((s: any) => s.isActive).length,
      });
    } catch {
      setStats({ insightCount: 0, criticalAlerts: 0, activeSubscriptions: 0 });
    }
  };

  const scanForInsights = async () => {
    try {
      setScanning(true);
      await intelligenceApi.scanInsights({ userId });
      loadStats();
    } catch {
      // silent
    } finally {
      setScanning(false);
    }
  };

  const dateRange = startDate && endDate ? { start: startDate, end: endDate } : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="neu-raised p-3 rounded-xl">
            <Brain className="w-7 h-7 text-[#FFCC00]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Intelligence Hub</h2>
            <p className="text-xs text-zinc-500">Cross-module insights, temporal queries & correlations</p>
          </div>
        </div>

        {/* Stats badges */}
        {stats && (
          <div className="flex items-center gap-3">
            <div className="neu-raised-sm px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-[#FFCC00]" />
              <span className="text-sm font-bold text-zinc-200">{stats.insightCount}</span>
              <span className="text-[10px] text-zinc-500 uppercase">Insights</span>
            </div>
            {stats.criticalAlerts > 0 && (
              <div className="neu-raised-sm px-3 py-1.5 rounded-xl flex items-center gap-2 border border-red-500/30">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-bold text-red-400">{stats.criticalAlerts}</span>
                <span className="text-[10px] text-zinc-500 uppercase">Critical</span>
              </div>
            )}
            <div className="neu-raised-sm px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-bold text-zinc-200">{stats.activeSubscriptions}</span>
              <span className="text-[10px] text-zinc-500 uppercase">Active</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions + Date Range */}
      <div className="neu-raised p-4 rounded-lg flex flex-wrap items-center gap-3">
        <button
          onClick={scanForInsights}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FFCC00] text-[#0a0a0f] font-bold text-sm hover:bg-[#FFCC00]/90 transition-colors disabled:opacity-50"
        >
          <Scan className={cn('w-4 h-4', scanning && 'animate-spin')} />
          {scanning ? 'Scanning...' : 'Scan for Insights'}
        </button>
        <button
          onClick={() => setActiveTab('temporal')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-sm transition-colors"
        >
          <Search className="w-4 h-4" />
          New Temporal Query
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 font-medium">From:</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 font-medium">To:</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300"
          />
        </div>
      </div>

      {/* Tab Bar */}
      <div className="neu-raised rounded-lg p-1.5 flex flex-wrap gap-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-[#FFCC00] text-[#0a0a0f] shadow-[0_0_20px_rgba(255,204,0,0.2)]'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-300">
        {activeTab === 'insights' && (
          <InsightFeed userId={userId} dateRange={dateRange} />
        )}
        {activeTab === 'timeline' && (
          <IntelligenceTimeline userId={userId} />
        )}
        {activeTab === 'temporal' && (
          <TemporalQueryBuilder userId={userId} />
        )}
        {activeTab === 'modules' && (
          <ModuleConnectionMap />
        )}
        {activeTab === 'subscriptions' && (
          <SubscriptionManager userId={userId} />
        )}
        {activeTab === 'correlations' && (
          <CorrelationExplorer userId={userId} />
        )}
      </div>
    </div>
  );
}
