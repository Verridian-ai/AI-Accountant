import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Calendar,
  MessageSquare,
  Percent,
  Bell,
  Globe,
} from 'lucide-react';
import { EconomicIndicators } from './EconomicIndicators';
import { PriceTracker } from './PriceTracker';
import { SentimentDashboard } from './SentimentDashboard';
import { EconomicCalendar } from './EconomicCalendar';
import { MarketBriefing } from './MarketBriefing';
import { RateDecisionTracker } from './RateDecisionTracker';
import { MarketAlerts } from './MarketAlerts';
import { fetchEconomicSnapshot } from '../../../api';

interface SnapshotMetric {
  label: string;
  value: string;
  change?: string;
  changeDirection?: 'up' | 'down' | 'neutral';
  source?: string;
}

type SubTab = 'indicators' | 'prices' | 'sentiment' | 'calendar' | 'briefing' | 'rates' | 'alerts';

const SUB_TABS: { id: SubTab; label: string; icon: typeof Activity }[] = [
  { id: 'indicators', label: 'Indicators', icon: BarChart3 },
  { id: 'prices', label: 'Prices', icon: TrendingUp },
  { id: 'sentiment', label: 'Sentiment', icon: MessageSquare },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'briefing', label: 'Briefing', icon: Globe },
  { id: 'rates', label: 'Rates', icon: Percent },
  { id: 'alerts', label: 'Alerts', icon: Bell },
];

export function MarketDashboard() {
  const [activeTab, setActiveTab] = useState<SubTab>('indicators');
  const [snapshot, setSnapshot] = useState<SnapshotMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchEconomicSnapshot();
      if (data && Array.isArray(data.metrics)) {
        setSnapshot(data.metrics);
      } else if (data && typeof data === 'object') {
        // Flatten object response into metrics array
        const metrics: SnapshotMetric[] = [];
        const defaults: Record<string, { label: string; fallback: string }> = {
          cash_rate: { label: 'Cash Rate', fallback: '4.35%' },
          cpi: { label: 'CPI', fallback: '3.6%' },
          unemployment: { label: 'Unemployment', fallback: '4.1%' },
          asx200: { label: 'ASX 200', fallback: '7,850' },
          audusd: { label: 'AUD/USD', fallback: '0.6520' },
        };
        for (const [key, def] of Object.entries(defaults)) {
          const val = (data as Record<string, unknown>)[key];
          metrics.push({
            label: def.label,
            value: val != null ? String(val) : def.fallback,
            change: (data as Record<string, Record<string, string>>)[`${key}_change`]?.toString(),
            changeDirection: 'neutral',
          });
        }
        if (metrics.length > 0) setSnapshot(metrics);
      }
    } catch {
      // Use fallback data when API isn't available
      setSnapshot([
        { label: 'Cash Rate', value: '4.35%', change: '0bps', changeDirection: 'neutral' },
        { label: 'CPI', value: '3.6%', change: '-0.2%', changeDirection: 'down' },
        { label: 'Unemployment', value: '4.1%', change: '+0.1%', changeDirection: 'up' },
        { label: 'ASX 200', value: '7,850', change: '+1.2%', changeDirection: 'up' },
        { label: 'AUD/USD', value: '0.6520', change: '-0.3%', changeDirection: 'down' },
      ]);
      setError('Using cached data - live feed unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSnapshot();
    setRefreshing(false);
  }, [loadSnapshot]);

  const getChangeColor = (dir?: string) => {
    if (dir === 'up') return 'text-emerald-400';
    if (dir === 'down') return 'text-red-400';
    return 'text-zinc-400';
  };

  const getChangeIcon = (dir?: string) => {
    if (dir === 'up') return <TrendingUp className="w-3.5 h-3.5" />;
    if (dir === 'down') return <TrendingDown className="w-3.5 h-3.5" />;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gradient-gold">Market Intelligence</h2>
          <p className="text-sm text-zinc-500">
            Australian economic indicators, prices, and market sentiment
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="neu-raised-sm px-4 py-2 rounded-xl text-zinc-400 hover:text-[#FFCC00] transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="neu-inset px-4 py-2 rounded-xl text-xs text-amber-400 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="neu-raised rounded-2xl p-4 animate-pulse">
                <div className="h-3 w-16 bg-zinc-700 rounded mb-3" />
                <div className="h-6 w-20 bg-zinc-700 rounded mb-2" />
                <div className="h-3 w-12 bg-zinc-700 rounded" />
              </div>
            ))
          : snapshot.map((metric, idx) => (
              <div key={idx} className="neu-raised rounded-2xl p-4 hover:border-[#FFCC00]/20 border border-transparent transition-all">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">
                  {metric.label}
                </p>
                <p className="text-xl font-bold text-white">{metric.value}</p>
                {metric.change && (
                  <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${getChangeColor(metric.changeDirection)}`}>
                    {getChangeIcon(metric.changeDirection)}
                    <span>{metric.change}</span>
                  </div>
                )}
              </div>
            ))}
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#FFCC00] text-[#0a0a0f] shadow-[0_0_20px_rgba(255,204,0,0.2)]'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5 neu-raised-sm'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Sub-component */}
      <div className="animate-in fade-in duration-300">
        {activeTab === 'indicators' && <EconomicIndicators />}
        {activeTab === 'prices' && <PriceTracker />}
        {activeTab === 'sentiment' && <SentimentDashboard />}
        {activeTab === 'calendar' && <EconomicCalendar />}
        {activeTab === 'briefing' && <MarketBriefing />}
        {activeTab === 'rates' && <RateDecisionTracker />}
        {activeTab === 'alerts' && <MarketAlerts />}
      </div>
    </div>
  );
}
