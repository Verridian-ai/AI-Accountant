import { useState, useEffect } from 'react';
import { Search, Save, Clock, Database, ChevronRight, Trash2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { intelligenceApi } from '../../../api';
import { cn } from '../../../lib/utils';

interface TemporalQueryBuilderProps {
  userId: string;
}

type QueryType = 'point_in_time' | 'time_range' | 'trend' | 'comparison' | 'evolution';
type EntityType = 'transactions' | 'forecasts' | 'compliance' | 'anomalies' | 'tax' | 'bas';

interface SavedQuery {
  id: string;
  name: string;
  queryType: QueryType;
  entity: EntityType;
  createdAt: string;
}

const queryTypes: { value: QueryType; label: string }[] = [
  { value: 'point_in_time', label: 'Point in Time' },
  { value: 'time_range', label: 'Time Range' },
  { value: 'trend', label: 'Trend Over Time' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'evolution', label: 'Evolution' },
];

const entityTypes: { value: EntityType; label: string }[] = [
  { value: 'transactions', label: 'Transactions' },
  { value: 'forecasts', label: 'Forecasts' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'anomalies', label: 'Anomalies' },
  { value: 'tax', label: 'Tax' },
  { value: 'bas', label: 'BAS' },
];

export function TemporalQueryBuilder({ userId }: TemporalQueryBuilderProps) {
  const [queryType, setQueryType] = useState<QueryType>('point_in_time');
  const [entity, setEntity] = useState<EntityType>('transactions');
  const [pointDate, setPointDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [queryName, setQueryName] = useState('');
  const [cached, setCached] = useState(false);

  useEffect(() => {
    loadSavedQueries();
  }, [userId]);

  const loadSavedQueries = async () => {
    try {
      const data = await intelligenceApi.listSavedQueries(userId);
      setSavedQueries(Array.isArray(data) ? data : (data.queries ?? []));
    } catch {
      // ignore
    }
  };

  const buildQueryPayload = () => {
    const payload: Record<string, unknown> = {
      userId,
      queryType,
      entity,
    };
    if (queryType === 'point_in_time') payload.timestamp = pointDate;
    else {
      payload.startDate = startDate;
      payload.endDate = endDate;
    }
    if (category) payload.category = category;
    if (minAmount) payload.minAmount = Number(minAmount);
    if (maxAmount) payload.maxAmount = Number(maxAmount);
    return payload;
  };

  const executeQuery = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await intelligenceApi.executeQuery(buildQueryPayload());
      setResults(data);
      setCached(!!data?.cached);
    } catch {
      setError('Query execution failed');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const saveQuery = async () => {
    if (!queryName.trim()) return;
    try {
      await intelligenceApi.saveQuery({ ...buildQueryPayload(), name: queryName });
      setQueryName('');
      loadSavedQueries();
    } catch {
      // ignore
    }
  };

  const renderTimeInputs = () => {
    if (queryType === 'point_in_time') {
      return (
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 font-medium">Date:</label>
          <input
            type="date"
            value={pointDate}
            onChange={(e) => setPointDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 flex-1"
          />
        </div>
      );
    }
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <div className="flex items-center gap-2 flex-1">
          <label className="text-xs text-zinc-500 font-medium">From:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 flex-1"
          />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <label className="text-xs text-zinc-500 font-medium">To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 flex-1"
          />
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!results) return null;

    // Trend data → line chart
    if (queryType === 'trend' && Array.isArray(results.dataPoints)) {
      return (
        <div className="neu-raised p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-zinc-200">Trend Results</h4>
            {cached && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#FFCC00]/20 text-[#FFCC00] font-bold">
                <Database className="w-3 h-3 inline mr-1" />
                CACHED
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={results.dataPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 11 }} />
              <YAxis tick={{ fill: '#888', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a2e',
                  border: '1px solid #333',
                  borderRadius: 8,
                }}
                labelStyle={{ color: '#FFCC00' }}
              />
              <Line type="monotone" dataKey="value" stroke="#FFCC00" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Table results
    const rows = results.records ?? results.data ?? (Array.isArray(results) ? results : []);
    if (rows.length > 0) {
      const keys = Object.keys(rows[0]).slice(0, 6);
      return (
        <div className="neu-raised rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-white/5">
            <h4 className="text-sm font-bold text-zinc-200">Results ({rows.length})</h4>
            {cached && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#FFCC00]/20 text-[#FFCC00] font-bold">
                <Database className="w-3 h-3 inline mr-1" />
                CACHED
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {keys.map((k) => (
                    <th
                      key={k}
                      className="text-left px-3 py-2 text-xs text-zinc-500 font-bold uppercase"
                    >
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row: Record<string, unknown>, i: number) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    {keys.map((k) => (
                      <td key={k} className="px-3 py-2 text-zinc-300 truncate max-w-[200px]">
                        {String(row[k] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="neu-raised p-4 rounded-lg text-center text-zinc-500">
        <p>No results returned.</p>
        {results.message && <p className="text-xs mt-1">{results.message}</p>}
      </div>
    );
  };

  return (
    <div className="flex gap-4">
      {/* Saved queries sidebar */}
      {showSaved && (
        <div className="w-64 shrink-0 neu-raised rounded-lg p-3 space-y-2 hidden lg:block">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
            Saved Queries
          </h4>
          {savedQueries.length === 0 ? (
            <p className="text-xs text-zinc-600">No saved queries yet.</p>
          ) : (
            savedQueries.map((sq) => (
              <button
                key={sq.id}
                className="w-full text-left p-2 rounded-lg hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300 truncate">{sq.name}</span>
                  <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-[#FFCC00]" />
                </div>
                <span className="text-[10px] text-zinc-600">
                  {sq.queryType} • {sq.entity}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 space-y-4">
        {/* Query Builder Form */}
        <div className="neu-raised p-4 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#FFCC00] flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Temporal Query Builder
            </h3>
            <button
              onClick={() => setShowSaved(!showSaved)}
              className="text-xs text-zinc-500 hover:text-[#FFCC00] transition-colors hidden lg:block"
            >
              {showSaved ? 'Hide' : 'Show'} Saved
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Query Type</label>
              <select
                value={queryType}
                onChange={(e) => setQueryType(e.target.value as QueryType)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
              >
                {queryTypes.map((qt) => (
                  <option key={qt.value} value={qt.value}>
                    {qt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Target Entity</label>
              <select
                value={entity}
                onChange={(e) => setEntity(e.target.value as EntityType)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
              >
                {entityTypes.map((et) => (
                  <option key={et.value} value={et.value}>
                    {et.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {renderTimeInputs()}

          {/* Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Office Expenses"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Min Amount</label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium block mb-1">Max Amount</label>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="10000"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={executeQuery}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FFCC00] text-[#0a0a0f] font-bold text-sm hover:bg-[#FFCC00]/90 transition-colors disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Executing...' : 'Execute Query'}
            </button>
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                placeholder="Query name..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600"
              />
              <button
                onClick={saveQuery}
                disabled={!queryName.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && <div className="neu-raised p-4 rounded-lg text-red-400 text-center">{error}</div>}

        {/* Results */}
        {renderResults()}
      </div>
    </div>
  );
}
