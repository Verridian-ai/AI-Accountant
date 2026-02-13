import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Search } from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  fetchMarketPrices,
  fetchPriceHistory,
  searchSymbol,
  refreshMarketPrices,
} from '../../../api';

interface PriceItem {
  symbol: string;
  name: string;
  type: 'equity' | 'crypto' | 'forex' | 'commodity';
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: string;
  updatedAt?: string;
}

interface HistoryPoint {
  date: string;
  price: number;
}

type PriceTab = 'all' | 'equity' | 'crypto';

const TABS: { id: PriceTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'equity', label: 'ASX Equities' },
  { id: 'crypto', label: 'Cryptocurrency' },
];

export function PriceTracker() {
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PriceTab>('all');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PriceItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadPrices = useCallback(async () => {
    try {
      setLoading(true);
      const type = activeTab === 'all' ? undefined : activeTab;
      const data = await fetchMarketPrices(type);
      const items = Array.isArray(data) ? data : (data as { prices: PriceItem[] }).prices || [];
      setPrices(items);
    } catch {
      // Fallback data
      setPrices([
        {
          symbol: 'ASX:CBA',
          name: 'Commonwealth Bank',
          type: 'equity',
          price: 128.45,
          change: 1.23,
          changePercent: 0.97,
        },
        {
          symbol: 'ASX:BHP',
          name: 'BHP Group',
          type: 'equity',
          price: 45.67,
          change: -0.45,
          changePercent: -0.98,
        },
        {
          symbol: 'ASX:CSL',
          name: 'CSL Limited',
          type: 'equity',
          price: 298.5,
          change: 3.2,
          changePercent: 1.08,
        },
        {
          symbol: 'ASX:WBC',
          name: 'Westpac Banking',
          type: 'equity',
          price: 28.9,
          change: 0.15,
          changePercent: 0.52,
        },
        {
          symbol: 'ASX:NAB',
          name: 'National Australia Bank',
          type: 'equity',
          price: 35.6,
          change: -0.3,
          changePercent: -0.84,
        },
        {
          symbol: 'ASX:ANZ',
          name: 'ANZ Banking Group',
          type: 'equity',
          price: 29.45,
          change: 0.22,
          changePercent: 0.75,
        },
        {
          symbol: 'BTC-AUD',
          name: 'Bitcoin',
          type: 'crypto',
          price: 148523.0,
          change: 2456.0,
          changePercent: 1.68,
        },
        {
          symbol: 'ETH-AUD',
          name: 'Ethereum',
          type: 'crypto',
          price: 5243.0,
          change: -87.0,
          changePercent: -1.63,
        },
        {
          symbol: 'SOL-AUD',
          name: 'Solana',
          type: 'crypto',
          price: 245.8,
          change: 12.3,
          changePercent: 5.27,
        },
        {
          symbol: 'XRP-AUD',
          name: 'Ripple',
          type: 'crypto',
          price: 3.82,
          change: 0.08,
          changePercent: 2.14,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  const loadHistory = useCallback(async (symbol: string) => {
    setSelectedSymbol(symbol);
    setHistoryLoading(true);
    try {
      const data = await fetchPriceHistory(symbol, 30);
      const points = Array.isArray(data)
        ? data
        : (data as { history: HistoryPoint[] }).history || [];
      setHistory(points);
    } catch {
      // Mock history
      const mock: HistoryPoint[] = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        mock.push({
          date: d.toISOString().slice(0, 10),
          price: Number((Math.random() * 20 + 100).toFixed(2)),
        });
      }
      setHistory(mock);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await searchSymbol(searchQuery);
      const results = Array.isArray(data) ? data : (data as { results: PriceItem[] }).results || [];
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshMarketPrices();
      await loadPrices();
    } catch {
      await loadPrices();
    } finally {
      setRefreshing(false);
    }
  }, [loadPrices]);

  const filtered = activeTab === 'all' ? prices : prices.filter((p) => p.type === activeTab);
  const displayPrices = searchResults.length > 0 ? searchResults : filtered;

  const formatPrice = (price: number) => {
    if (price >= 1000)
      return price.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toFixed(price < 1 ? 4 : 2);
  };

  return (
    <div className="space-y-4">
      {/* Header with tabs */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchResults([]);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-[#FFCC00]/20 text-[#FFCC00] ring-1 ring-[#FFCC00]/30'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="neu-inset pl-8 pr-3 py-1.5 rounded-lg text-xs text-white bg-transparent w-40 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="neu-raised-sm p-1.5 rounded-lg text-zinc-400 hover:text-[#FFCC00] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {searching && <div className="text-xs text-zinc-500">Searching...</div>}

      {/* Price History Chart */}
      {selectedSymbol && (
        <div className="neu-raised rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">{selectedSymbol} - 30 Day History</h3>
            <button
              onClick={() => setSelectedSymbol(null)}
              className="text-xs text-zinc-500 hover:text-white"
            >
              Close
            </button>
          </div>
          {historyLoading ? (
            <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
              Loading...
            </div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#666" fontSize={10} />
                  <YAxis stroke="#666" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a2e',
                      border: '1px solid rgba(255,204,0,0.2)',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`$${formatPrice(value)}`, 'Price']}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#FFCC00"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#FFCC00' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Price Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="neu-raised rounded-2xl p-4 animate-pulse">
              <div className="h-4 w-20 bg-zinc-700 rounded mb-2" />
              <div className="h-6 w-24 bg-zinc-700 rounded mb-1" />
              <div className="h-3 w-16 bg-zinc-700 rounded" />
            </div>
          ))
        ) : displayPrices.length === 0 ? (
          <div className="col-span-full text-center py-8 text-zinc-500 text-sm">
            No prices available
          </div>
        ) : (
          displayPrices.map((item) => {
            const isUp = item.changePercent >= 0;
            return (
              <button
                key={item.symbol}
                onClick={() => loadHistory(item.symbol)}
                className={`neu-raised rounded-2xl p-4 text-left hover:scale-[1.02] transition-all border ${
                  selectedSymbol === item.symbol
                    ? 'border-[#FFCC00]/40'
                    : isUp
                      ? 'border-emerald-500/10 hover:border-emerald-500/30'
                      : 'border-red-500/10 hover:border-red-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#FFCC00] uppercase tracking-wider">
                    {item.symbol}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.type === 'equity'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-purple-500/10 text-purple-400'
                    }`}
                  >
                    {item.type}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 truncate mb-1">{item.name}</p>
                <p className="text-lg font-bold text-white">${formatPrice(item.price)}</p>
                <div
                  className={`flex items-center gap-1 mt-1 text-xs font-medium ${isUp ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span>
                    {isUp ? '+' : ''}
                    {item.change.toFixed(2)}
                  </span>
                  <span className="text-zinc-600">|</span>
                  <span>
                    {isUp ? '+' : ''}
                    {item.changePercent.toFixed(2)}%
                  </span>
                </div>
                {/* Mini sparkline placeholder */}
                <div className="mt-2 h-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={Array.from({ length: 10 }, (_, i) => ({
                        v: item.price + (Math.random() - 0.5) * item.price * 0.02 * (i + 1),
                      }))}
                    >
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={isUp ? '#34d399' : '#f87171'}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
