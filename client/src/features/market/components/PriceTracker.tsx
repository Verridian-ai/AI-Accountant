import React, { useReducer, useEffect, useCallback, Suspense } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Search } from 'lucide-react';
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

const FALLBACK_PRICES: PriceItem[] = [
  { symbol: 'ASX:CBA', name: 'Commonwealth Bank', type: 'equity', price: 128.45, change: 1.23, changePercent: 0.97 },
  { symbol: 'ASX:BHP', name: 'BHP Group', type: 'equity', price: 45.67, change: -0.45, changePercent: -0.98 },
  { symbol: 'ASX:CSL', name: 'CSL Limited', type: 'equity', price: 298.5, change: 3.2, changePercent: 1.08 },
  { symbol: 'ASX:WBC', name: 'Westpac Banking', type: 'equity', price: 28.9, change: 0.15, changePercent: 0.52 },
  { symbol: 'ASX:NAB', name: 'National Australia Bank', type: 'equity', price: 35.6, change: -0.3, changePercent: -0.84 },
  { symbol: 'ASX:ANZ', name: 'ANZ Banking Group', type: 'equity', price: 29.45, change: 0.22, changePercent: 0.75 },
  { symbol: 'BTC-AUD', name: 'Bitcoin', type: 'crypto', price: 148523.0, change: 2456.0, changePercent: 1.68 },
  { symbol: 'ETH-AUD', name: 'Ethereum', type: 'crypto', price: 5243.0, change: -87.0, changePercent: -1.63 },
  { symbol: 'SOL-AUD', name: 'Solana', type: 'crypto', price: 245.8, change: 12.3, changePercent: 5.27 },
  { symbol: 'XRP-AUD', name: 'Ripple', type: 'crypto', price: 3.82, change: 0.08, changePercent: 2.14 },
];

interface State {
  prices: PriceItem[];
  loading: boolean;
  activeTab: PriceTab;
  selectedSymbol: string | null;
  history: HistoryPoint[];
  historyLoading: boolean;
  searchQuery: string;
  searchResults: PriceItem[];
  searching: boolean;
  refreshing: boolean;
}

type Action =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; prices: PriceItem[] }
  | { type: 'LOAD_ERROR'; prices: PriceItem[] }
  | { type: 'SET_TAB'; tab: PriceTab }
  | { type: 'SELECT_SYMBOL'; symbol: string }
  | { type: 'CLEAR_SYMBOL' }
  | { type: 'HISTORY_SUCCESS'; history: HistoryPoint[] }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'SEARCH_START' }
  | { type: 'SEARCH_SUCCESS'; results: PriceItem[] }
  | { type: 'SEARCH_ERROR' }
  | { type: 'SET_REFRESHING'; value: boolean };

const INITIAL: State = {
  prices: [],
  loading: true,
  activeTab: 'all',
  selectedSymbol: null,
  history: [],
  historyLoading: false,
  searchQuery: '',
  searchResults: [],
  searching: false,
  refreshing: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true };
    case 'LOAD_SUCCESS':
    case 'LOAD_ERROR':
      return { ...state, loading: false, prices: action.prices };
    case 'SET_TAB':
      return { ...state, activeTab: action.tab, searchResults: [] };
    case 'SELECT_SYMBOL':
      return { ...state, selectedSymbol: action.symbol, historyLoading: true, history: [] };
    case 'CLEAR_SYMBOL':
      return { ...state, selectedSymbol: null };
    case 'HISTORY_SUCCESS':
      return { ...state, historyLoading: false, history: action.history };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };
    case 'SEARCH_START':
      return { ...state, searching: true };
    case 'SEARCH_SUCCESS':
      return { ...state, searching: false, searchResults: action.results };
    case 'SEARCH_ERROR':
      return { ...state, searching: false, searchResults: [] };
    case 'SET_REFRESHING':
      return { ...state, refreshing: action.value };
  }
}

const LazyPriceHistoryChart = React.lazy(() => import('./PriceHistoryChart'));
const LazyPriceSparkline = React.lazy(() => import('./PriceSparkline'));

export function PriceTracker() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const loadPrices = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const type = state.activeTab === 'all' ? undefined : state.activeTab;
      const data = await fetchMarketPrices(type);
      const items = Array.isArray(data) ? data : (data as { prices: PriceItem[] }).prices || [];
      dispatch({ type: 'LOAD_SUCCESS', prices: items });
    } catch {
      dispatch({ type: 'LOAD_ERROR', prices: FALLBACK_PRICES });
    }
  }, [state.activeTab, dispatch]);

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  const loadHistory = useCallback(async (symbol: string) => {
    dispatch({ type: 'SELECT_SYMBOL', symbol });
    try {
      const data = await fetchPriceHistory(symbol, 30);
      const points = Array.isArray(data)
        ? data
        : (data as { history: HistoryPoint[] }).history || [];
      dispatch({ type: 'HISTORY_SUCCESS', history: points });
    } catch {
      const mock: HistoryPoint[] = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        mock.push({ date: d.toISOString().slice(0, 10), price: Number((Math.random() * 20 + 100).toFixed(2)) });
      }
      dispatch({ type: 'HISTORY_SUCCESS', history: mock });
    }
  }, [dispatch]);

  const handleSearch = useCallback(async () => {
    if (!state.searchQuery.trim()) {
      dispatch({ type: 'SEARCH_ERROR' });
      return;
    }
    dispatch({ type: 'SEARCH_START' });
    try {
      const data = await searchSymbol(state.searchQuery);
      const results = Array.isArray(data) ? data : (data as { results: PriceItem[] }).results || [];
      dispatch({ type: 'SEARCH_SUCCESS', results });
    } catch {
      dispatch({ type: 'SEARCH_ERROR' });
    }
  }, [state.searchQuery, dispatch]);

  const handleRefresh = useCallback(async () => {
    dispatch({ type: 'SET_REFRESHING', value: true });
    try {
      await refreshMarketPrices();
    } catch {
      // ignore refresh error, still reload
    }
    await loadPrices();
    dispatch({ type: 'SET_REFRESHING', value: false });
  }, [loadPrices, dispatch]);

  const filtered = state.activeTab === 'all' ? state.prices : state.prices.filter((p) => p.type === state.activeTab);
  const displayPrices = state.searchResults.length > 0 ? state.searchResults : filtered;

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
              onClick={() => dispatch({ type: 'SET_TAB', tab: tab.id })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                state.activeTab === tab.id
                  ? 'bg-cba-gold/20 text-cba-gold ring-1 ring-[#FFCC00]/30'
                  : 'text-muted hover:text-primary hover:bg-overlay'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={state.searchQuery}
              onChange={(e) => dispatch({ type: 'SET_SEARCH', query: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="neu-inset pl-8 pr-3 py-1.5 rounded-lg text-xs text-primary bg-transparent w-40 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={state.refreshing}
            className="neu-raised-sm p-1.5 rounded-lg text-secondary hover:text-cba-gold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${state.refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {state.searching && <div className="text-xs text-muted">Searching...</div>}

      {/* Price History Chart */}
      {state.selectedSymbol && (
        <div className="neu-raised rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-primary">{state.selectedSymbol} - 30 Day History</h3>
            <button
              onClick={() => dispatch({ type: 'CLEAR_SYMBOL' })}
              className="text-xs text-muted hover:text-primary"
            >
              Close
            </button>
          </div>
          {state.historyLoading ? (
            <div className="h-48 flex items-center justify-center text-muted text-sm">
              Loading...
            </div>
          ) : (
            <Suspense fallback={<div className="h-48 animate-pulse bg-overlay rounded-xl" />}>
              <LazyPriceHistoryChart data={state.history} formatPrice={formatPrice} />
            </Suspense>
          )}
        </div>
      )}

      {/* Price Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {state.loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={`skel-${i}`} className="neu-raised rounded-2xl p-4 animate-pulse">
              <div className="h-4 w-20 bg-zinc-700 rounded mb-2" />
              <div className="h-6 w-24 bg-zinc-700 rounded mb-1" />
              <div className="h-3 w-16 bg-zinc-700 rounded" />
            </div>
          ))
        ) : displayPrices.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted text-sm">
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
                  state.selectedSymbol === item.symbol
                    ? 'border-cba-gold/40'
                    : isUp
                      ? 'border-emerald-500/10 hover:border-emerald-500/30'
                      : 'border-red-500/10 hover:border-red-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-cba-gold uppercase tracking-wider">
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
                <p className="text-xs text-muted truncate mb-1">{item.name}</p>
                <p className="text-lg font-bold text-primary">${formatPrice(item.price)}</p>
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
                <Suspense fallback={<div className="mt-2 h-6" />}>
                  <LazyPriceSparkline price={item.price} isUp={isUp} />
                </Suspense>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
