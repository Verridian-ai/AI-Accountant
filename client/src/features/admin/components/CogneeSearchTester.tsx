import { useState, useEffect } from 'react';
import { testCogneeSearch, fetchCogneeAdminDatasets } from '../../../api';
import { Search, Play, Clock, Database, AlertCircle } from 'lucide-react';

const SEARCH_TYPES = [
  'CHUNKS',
  'CHUNKS_LEXICAL',
  'GRAPH_COMPLETION',
  'RAG_COMPLETION',
  'GRAPH_SUMMARY_COMPLETION',
  'GRAPH_COMPLETION_COT',
];

interface SearchResult {
  searchType: string;
  results: Array<{ text: string; score?: number; metadata?: Record<string, unknown> }>;
  latencyMs: number;
}

export function CogneeSearchTester() {
  const [query, setQuery] = useState('');
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['CHUNKS']);
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [datasets, setDatasets] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCogneeAdminDatasets()
      .then((res: { datasets?: Array<{ name: string }> } | Array<{ name: string }>) => {
        const ds = Array.isArray(res) ? res : res?.datasets || [];
        setDatasets(ds.map((d: { name: string }) => d.name));
      })
      .catch(() => {
        /* */
      });
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const res = await testCogneeSearch(query, {
        datasets: selectedDatasets.length > 0 ? selectedDatasets : undefined,
        searchTypes: selectedTypes,
        topK,
      });
      const searchRes = res as SearchResult[] | { results?: SearchResult[] };
      setResults(Array.isArray(searchRes) ? searchRes : searchRes?.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    }
    setLoading(false);
  };

  const toggleItem = (list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">Cognee Search Tester</h2>
        <p className="text-sm text-muted">Test search queries across knowledge base datasets</p>
      </div>

      {/* Search Form */}
      <div className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6 space-y-4">
        <div>
          <label htmlFor="search-query" className="block text-xs text-secondary mb-2">
            Search Query
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                id="search-query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-3 bg-[#1a1a2e] border border-border rounded-xl text-primary placeholder-zinc-600 focus:outline-none focus:border-cba-gold/50"
                placeholder="Enter search query..."
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="px-6 py-3 bg-cba-gold text-[#1a1a2e] font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Dataset Selection */}
        <div>
          <label htmlFor="cognee-f1" className="block text-xs text-secondary mb-2">
            <Database className="w-3 h-3 inline mr-1" /> Datasets{' '}
            {selectedDatasets.length > 0 && `(${selectedDatasets.length})`}
          </label>
          <div className="flex flex-wrap gap-2">
            {datasets.map((ds) => (
              <button
                key={ds}
                type="button"
                onClick={() => toggleItem(selectedDatasets, ds, setSelectedDatasets)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedDatasets.includes(ds)
                  ? 'bg-cba-gold/10 text-cba-gold border border-cba-gold/20'
                  : 'bg-[#1a1a2e] text-secondary border border-border/50 hover:border-border'
                  }`}
              >
                {ds}
              </button>
            ))}
            {datasets.length === 0 && (
              <p className="text-xs text-muted">No datasets available</p>
            )}
          </div>
        </div>

        {/* Search Types */}
        <div>
          <label htmlFor="cognee-f2" className="block text-xs text-secondary mb-2">Search Types</label>
          <div className="flex flex-wrap gap-2">
            {SEARCH_TYPES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => toggleItem(selectedTypes, st, setSelectedTypes)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedTypes.includes(st)
                  ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                  : 'bg-[#1a1a2e] text-secondary border border-border/50 hover:border-border'
                  }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Top K */}
        <div className="flex items-center gap-3">
          <label htmlFor="search-top-k" className="text-xs text-secondary">
            Top K:
          </label>
          <input
            id="search-top-k"
            type="number"
            min={1}
            max={20}
            value={topK}
            onChange={(e) => setTopK(parseInt(e.target.value) || 5)}
            className="w-20 px-3 py-1.5 bg-[#1a1a2e] border border-border rounded-lg text-primary text-sm text-center focus:outline-none focus:border-cba-gold/50"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((r, ri) => (
            <div
              key={ri}
              className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                  <Search className="w-4 h-4 text-violet-400" />
                  {r.searchType}
                </h3>
                <div className="flex items-center gap-1 text-xs text-muted">
                  <Clock className="w-3 h-3" />
                  {r.latencyMs}ms
                </div>
              </div>
              <div className="space-y-3">
                {r.results.map((item, ii) => (
                  <div
                    key={ii}
                    className="py-3 px-4 rounded-xl bg-[#1a1a2e] border-l-2 border-cba-gold/20"
                  >
                    <p className="text-sm text-primary whitespace-pre-wrap">{item.text}</p>
                    {item.score !== undefined && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-[#0a0a1a] overflow-hidden">
                          <div
                            className="h-full bg-cba-gold rounded-full transition-all duration-300"
                            ref={(el) => {
                              if (el && item.score !== undefined) {
                                el.style.width = `${item.score * 100}%`;
                              }
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-muted">
                          {(item.score * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                {r.results.length === 0 && <p className="text-xs text-muted">No results</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
