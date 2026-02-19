import React, { useReducer, useEffect, useCallback, Suspense } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Search } from 'lucide-react';
import { fetchIndicators, fetchIndicatorHistory } from '../../../api';

interface Indicator {
  code: string;
  name: string;
  category: string;
  currentValue: number | string;
  previousValue?: number | string;
  changePercent?: number;
  period?: string;
  source: string;
  unit?: string;
  updatedAt?: string;
}

interface HistoryPoint {
  date: string;
  value: number;
}

const CATEGORIES = ['All', 'Interest Rates', 'Inflation', 'Employment', 'GDP', 'Wages', 'Housing'];
const SOURCES = ['All', 'RBA', 'ABS'];

const FALLBACK_INDICATORS: Indicator[] = [
  { code: 'RBA_CASH_RATE', name: 'Cash Rate Target', category: 'Interest Rates', currentValue: 4.35, previousValue: 4.35, changePercent: 0, period: 'Feb 2026', source: 'RBA', unit: '%' },
  { code: 'ABS_CPI', name: 'Consumer Price Index', category: 'Inflation', currentValue: 3.6, previousValue: 3.8, changePercent: -5.26, period: 'Dec 2025', source: 'ABS', unit: '%' },
  { code: 'ABS_UNEMPLOYMENT', name: 'Unemployment Rate', category: 'Employment', currentValue: 4.1, previousValue: 4.0, changePercent: 2.5, period: 'Jan 2026', source: 'ABS', unit: '%' },
  { code: 'ABS_GDP', name: 'GDP Growth (Annual)', category: 'GDP', currentValue: 1.5, previousValue: 1.1, changePercent: 36.36, period: 'Sep 2025', source: 'ABS', unit: '%' },
  { code: 'ABS_WAGES', name: 'Wage Price Index', category: 'Wages', currentValue: 4.1, previousValue: 4.2, changePercent: -2.38, period: 'Sep 2025', source: 'ABS', unit: '%' },
  { code: 'RBA_DWELLING', name: 'Housing Credit Growth', category: 'Housing', currentValue: 5.3, previousValue: 5.1, changePercent: 3.92, period: 'Jan 2026', source: 'RBA', unit: '%' },
  { code: 'ABS_EMPLOYMENT_CHANGE', name: 'Employment Change', category: 'Employment', currentValue: 14200, previousValue: 61300, changePercent: -76.8, period: 'Jan 2026', source: 'ABS', unit: 'persons' },
  { code: 'RBA_INFLATION_EXPECT', name: 'Inflation Expectations', category: 'Inflation', currentValue: 4.3, previousValue: 4.5, changePercent: -4.44, period: 'Feb 2026', source: 'RBA', unit: '%' },
];

interface State {
  indicators: Indicator[];
  loading: boolean;
  error: string | null;
  activeCategory: string;
  activeSource: string;
  expandedCode: string | null;
  historyData: Record<string, HistoryPoint[]>;
  historyLoading: string | null;
  searchQuery: string;
}

type Action =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; indicators: Indicator[] }
  | { type: 'LOAD_ERROR'; error: string; indicators: Indicator[] }
  | { type: 'SET_CATEGORY'; value: string }
  | { type: 'SET_SOURCE'; value: string }
  | { type: 'SET_SEARCH'; value: string }
  | { type: 'EXPAND'; code: string }
  | { type: 'COLLAPSE' }
  | { type: 'HISTORY_START'; code: string }
  | { type: 'HISTORY_SUCCESS'; code: string; history: HistoryPoint[] };

const INITIAL: State = {
  indicators: [],
  loading: true,
  error: null,
  activeCategory: 'All',
  activeSource: 'All',
  expandedCode: null,
  historyData: {},
  historyLoading: null,
  searchQuery: '',
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS':
      return { ...state, loading: false, indicators: action.indicators };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error, indicators: action.indicators };
    case 'SET_CATEGORY':
      return { ...state, activeCategory: action.value };
    case 'SET_SOURCE':
      return { ...state, activeSource: action.value };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.value };
    case 'EXPAND':
      return { ...state, expandedCode: action.code };
    case 'COLLAPSE':
      return { ...state, expandedCode: null };
    case 'HISTORY_START':
      return { ...state, historyLoading: action.code };
    case 'HISTORY_SUCCESS':
      return {
        ...state,
        historyLoading: null,
        historyData: { ...state.historyData, [action.code]: action.history },
      };
  }
}

const LazyIndicatorHistoryChart = React.lazy(() => import('./IndicatorHistoryChart'));

export function EconomicIndicators() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const loadIndicators = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const params: Record<string, string> = {};
      if (state.activeCategory !== 'All') params.category = state.activeCategory;
      if (state.activeSource !== 'All') params.source = state.activeSource;
      const data = await fetchIndicators(params);
      if (Array.isArray(data)) {
        dispatch({ type: 'LOAD_SUCCESS', indicators: data });
      } else if (data && Array.isArray((data as { indicators: Indicator[] }).indicators)) {
        dispatch({ type: 'LOAD_SUCCESS', indicators: (data as { indicators: Indicator[] }).indicators });
      }
    } catch {
      dispatch({ type: 'LOAD_ERROR', error: 'Failed to load indicators', indicators: FALLBACK_INDICATORS });
    }
  }, [state.activeCategory, state.activeSource, dispatch]);

  useEffect(() => {
    loadIndicators();
  }, [loadIndicators]);

  const toggleExpand = useCallback(
    async (code: string) => {
      if (state.expandedCode === code) {
        dispatch({ type: 'COLLAPSE' });
        return;
      }
      dispatch({ type: 'EXPAND', code });
      if (!state.historyData[code]) {
        dispatch({ type: 'HISTORY_START', code });
        try {
          const data = await fetchIndicatorHistory(code, 24);
          const points = Array.isArray(data)
            ? data
            : (data as { history: HistoryPoint[] }).history || [];
          dispatch({ type: 'HISTORY_SUCCESS', code, history: points });
        } catch {
          const mockHistory: HistoryPoint[] = [];
          const now = new Date();
          for (let i = 23; i >= 0; i--) {
            const d = new Date(now);
            d.setMonth(d.getMonth() - i);
            mockHistory.push({ date: d.toISOString().slice(0, 7), value: Number((Math.random() * 2 + 3).toFixed(2)) });
          }
          dispatch({ type: 'HISTORY_SUCCESS', code, history: mockHistory });
        }
      }
    },
    [state.expandedCode, state.historyData, dispatch],
  );

  const filtered = state.indicators.filter((ind) => {
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      return ind.name.toLowerCase().includes(q) || ind.code.toLowerCase().includes(q);
    }
    return true;
  });

  const getChangeColor = (pct?: number) => {
    if (pct == null) return 'text-zinc-400';
    if (pct > 0) return 'text-emerald-400';
    if (pct < 0) return 'text-red-400';
    return 'text-zinc-400';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => dispatch({ type: 'SET_CATEGORY', value: cat })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                state.activeCategory === cat
                  ? 'bg-[#FFCC00]/20 text-[#FFCC00] ring-1 ring-[#FFCC00]/30'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {SOURCES.map((src) => (
            <button
              key={src}
              onClick={() => dispatch({ type: 'SET_SOURCE', value: src })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                state.activeSource === src
                  ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              {src}
            </button>
          ))}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search..."
              value={state.searchQuery}
              onChange={(e) => dispatch({ type: 'SET_SEARCH', value: e.target.value })}
              className="neu-inset pl-8 pr-3 py-1.5 rounded-lg text-xs text-white bg-transparent w-36 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
        </div>
      </div>

      {state.error && (
        <div className="text-xs text-amber-400 neu-inset px-3 py-2 rounded-lg">{state.error}</div>
      )}

      {/* Table */}
      <div className="neu-raised rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Indicator</th>
                <th className="text-right px-4 py-3 font-medium">Current</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Previous</th>
                <th className="text-right px-4 py-3 font-medium">Change</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Period</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Source</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {state.loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="border-b border-white/5 animate-pulse">
                    <td className="px-4 py-3">
                      <div className="h-4 w-32 bg-zinc-700 rounded" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="h-4 w-16 bg-zinc-700 rounded ml-auto" />
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <div className="h-4 w-12 bg-zinc-700 rounded ml-auto" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="h-4 w-14 bg-zinc-700 rounded ml-auto" />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="h-4 w-20 bg-zinc-700 rounded" />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="h-4 w-10 bg-zinc-700 rounded" />
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500 text-sm">
                    No indicators found
                  </td>
                </tr>
              ) : (
                filtered.map((ind) => (
                  <tr key={ind.code} className="group">
                    <td colSpan={7} className="p-0">
                      <div>
                        <button
                          onClick={() => toggleExpand(ind.code)}
                          className="w-full flex items-center border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-4 py-3 text-left font-medium text-white">
                            {ind.name}
                            <span className="ml-2 text-[10px] text-zinc-600 uppercase">
                              {ind.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-white whitespace-nowrap">
                            {ind.currentValue}
                            {ind.unit === '%' ? '%' : ''}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-400 hidden sm:table-cell whitespace-nowrap">
                            {ind.previousValue ?? '-'}
                            {ind.unit === '%' ? '%' : ''}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-medium whitespace-nowrap ${getChangeColor(ind.changePercent)}`}
                          >
                            {ind.changePercent != null
                              ? `${ind.changePercent > 0 ? '+' : ''}${ind.changePercent.toFixed(1)}%`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-left text-zinc-400 hidden md:table-cell">
                            {ind.period ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-left hidden lg:table-cell">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                ind.source === 'RBA'
                                  ? 'bg-blue-500/10 text-blue-400'
                                  : 'bg-emerald-500/10 text-emerald-400'
                              }`}
                            >
                              {ind.source}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-500">
                            {state.expandedCode === ind.code ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </td>
                        </button>
                        {state.expandedCode === ind.code && (
                          <div className="px-4 py-4 bg-white/[0.02] border-b border-white/5">
                            {state.historyLoading === ind.code ? (
                              <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
                                Loading history...
                              </div>
                            ) : state.historyData[ind.code] && state.historyData[ind.code].length > 0 ? (
                              <Suspense fallback={<div className="h-48 animate-pulse bg-white/5 rounded-xl" />}>
                                <LazyIndicatorHistoryChart data={state.historyData[ind.code]} />
                              </Suspense>
                            ) : (
                              <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
                                No history available
                              </div>
                            )}
                            <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                              <span>Source: {ind.source}</span>
                              <ExternalLink className="w-3 h-3" />
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
