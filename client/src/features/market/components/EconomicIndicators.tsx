import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Search } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
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

export function EconomicIndicators() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeSource, setActiveSource] = useState('All');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<Record<string, HistoryPoint[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadIndicators = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const params: Record<string, string> = {};
      if (activeCategory !== 'All') params.category = activeCategory;
      if (activeSource !== 'All') params.source = activeSource;
      const data = await fetchIndicators(params);
      if (Array.isArray(data)) {
        setIndicators(data);
      } else if (data && Array.isArray((data as { indicators: Indicator[] }).indicators)) {
        setIndicators((data as { indicators: Indicator[] }).indicators);
      }
    } catch {
      setError('Failed to load indicators');
      // Fallback data
      setIndicators([
        { code: 'RBA_CASH_RATE', name: 'Cash Rate Target', category: 'Interest Rates', currentValue: 4.35, previousValue: 4.35, changePercent: 0, period: 'Feb 2026', source: 'RBA', unit: '%' },
        { code: 'ABS_CPI', name: 'Consumer Price Index', category: 'Inflation', currentValue: 3.6, previousValue: 3.8, changePercent: -5.26, period: 'Dec 2025', source: 'ABS', unit: '%' },
        { code: 'ABS_UNEMPLOYMENT', name: 'Unemployment Rate', category: 'Employment', currentValue: 4.1, previousValue: 4.0, changePercent: 2.5, period: 'Jan 2026', source: 'ABS', unit: '%' },
        { code: 'ABS_GDP', name: 'GDP Growth (Annual)', category: 'GDP', currentValue: 1.5, previousValue: 1.1, changePercent: 36.36, period: 'Sep 2025', source: 'ABS', unit: '%' },
        { code: 'ABS_WAGES', name: 'Wage Price Index', category: 'Wages', currentValue: 4.1, previousValue: 4.2, changePercent: -2.38, period: 'Sep 2025', source: 'ABS', unit: '%' },
        { code: 'RBA_DWELLING', name: 'Housing Credit Growth', category: 'Housing', currentValue: 5.3, previousValue: 5.1, changePercent: 3.92, period: 'Jan 2026', source: 'RBA', unit: '%' },
        { code: 'ABS_EMPLOYMENT_CHANGE', name: 'Employment Change', category: 'Employment', currentValue: 14200, previousValue: 61300, changePercent: -76.8, period: 'Jan 2026', source: 'ABS', unit: 'persons' },
        { code: 'RBA_INFLATION_EXPECT', name: 'Inflation Expectations', category: 'Inflation', currentValue: 4.3, previousValue: 4.5, changePercent: -4.44, period: 'Feb 2026', source: 'RBA', unit: '%' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, activeSource]);

  useEffect(() => {
    loadIndicators();
  }, [loadIndicators]);

  const toggleExpand = useCallback(async (code: string) => {
    if (expandedCode === code) {
      setExpandedCode(null);
      return;
    }
    setExpandedCode(code);
    if (!historyData[code]) {
      setHistoryLoading(code);
      try {
        const data = await fetchIndicatorHistory(code, 24);
        const points = Array.isArray(data) ? data : (data as { history: HistoryPoint[] }).history || [];
        setHistoryData(prev => ({ ...prev, [code]: points }));
      } catch {
        // Generate mock history
        const mockHistory: HistoryPoint[] = [];
        const now = new Date();
        for (let i = 23; i >= 0; i--) {
          const d = new Date(now);
          d.setMonth(d.getMonth() - i);
          mockHistory.push({
            date: d.toISOString().slice(0, 7),
            value: Number((Math.random() * 2 + 3).toFixed(2)),
          });
        }
        setHistoryData(prev => ({ ...prev, [code]: mockHistory }));
      } finally {
        setHistoryLoading(null);
      }
    }
  }, [expandedCode, historyData]);

  const filtered = indicators.filter((ind) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
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
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === cat
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
              onClick={() => setActiveSource(src)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSource === src
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="neu-inset pl-8 pr-3 py-1.5 rounded-lg text-xs text-white bg-transparent w-36 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs text-amber-400 neu-inset px-3 py-2 rounded-lg">{error}</div>
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
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5 animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 w-32 bg-zinc-700 rounded" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-4 w-16 bg-zinc-700 rounded ml-auto" /></td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell"><div className="h-4 w-12 bg-zinc-700 rounded ml-auto" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-4 w-14 bg-zinc-700 rounded ml-auto" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-20 bg-zinc-700 rounded" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-10 bg-zinc-700 rounded" /></td>
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
                            <span className="ml-2 text-[10px] text-zinc-600 uppercase">{ind.code}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-white whitespace-nowrap">
                            {ind.currentValue}{ind.unit === '%' ? '%' : ''}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-400 hidden sm:table-cell whitespace-nowrap">
                            {ind.previousValue ?? '-'}{ind.unit === '%' ? '%' : ''}
                          </td>
                          <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${getChangeColor(ind.changePercent)}`}>
                            {ind.changePercent != null ? `${ind.changePercent > 0 ? '+' : ''}${ind.changePercent.toFixed(1)}%` : '-'}
                          </td>
                          <td className="px-4 py-3 text-left text-zinc-400 hidden md:table-cell">
                            {ind.period ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-left hidden lg:table-cell">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              ind.source === 'RBA' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              {ind.source}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-500">
                            {expandedCode === ind.code ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </td>
                        </button>
                        {expandedCode === ind.code && (
                          <div className="px-4 py-4 bg-white/[0.02] border-b border-white/5">
                            {historyLoading === ind.code ? (
                              <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
                                Loading history...
                              </div>
                            ) : historyData[ind.code] && historyData[ind.code].length > 0 ? (
                              <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={historyData[ind.code]}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="date" stroke="#666" fontSize={11} />
                                    <YAxis stroke="#666" fontSize={11} />
                                    <Tooltip
                                      contentStyle={{
                                        backgroundColor: '#1a1a2e',
                                        border: '1px solid rgba(255,204,0,0.2)',
                                        borderRadius: '0.75rem',
                                        color: '#fff',
                                        fontSize: '12px',
                                      }}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="value"
                                      stroke="#FFCC00"
                                      strokeWidth={2}
                                      dot={false}
                                      activeDot={{ r: 4, fill: '#FFCC00' }}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
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
