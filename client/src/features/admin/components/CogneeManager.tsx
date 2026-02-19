import { useState, useEffect } from 'react';
import {
  fetchCogneeAdminDatasets,
  reindexCogneeDataset,
  fetchCogneeGraphStats,
} from '../../../api';
import { Database, RefreshCw, BarChart3, Layers, FileText } from 'lucide-react';

interface Dataset {
  name: string;
  category?: string;
  documentCount?: number;
  entityCount?: number;
  lastIndexed?: string;
  status?: string;
}

interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodeTypes: Record<string, number>;
  edgeTypes: Record<string, number>;
}

export function CogneeManager() {
  const [fetchState, setFetchState] = useState<{
    datasets: Dataset[];
    graphStats: GraphStats | null;
    loading: boolean;
  }>({ datasets: [], graphStats: null, loading: true });
  const { datasets, graphStats, loading } = fetchState;
  const [reindexing, setReindexing] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const loadData = async () => {
    try {
      const [ds, gs] = await Promise.allSettled([
        fetchCogneeAdminDatasets(),
        fetchCogneeGraphStats(),
      ]);
      setFetchState({
        datasets:
          ds.status === 'fulfilled'
            ? Array.isArray(ds.value)
              ? ds.value
              : (ds.value as { datasets: Dataset[] })?.datasets ?? []
            : [],
        graphStats: gs.status === 'fulfilled' ? (gs.value as GraphStats) : null,
        loading: false,
      });
    } catch {
      setFetchState((s) => ({ ...s, loading: false }));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReindex = async (name: string) => {
    setReindexing(name);
    try {
      await reindexCogneeDataset(name);
      setMessage(`Reindex started for "${name}"`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Reindex failed');
    }
    setReindexing(null);
  };

  const handleReindexAll = async () => {
    setReindexing('all');
    for (const ds of datasets) {
      try {
        await reindexCogneeDataset(ds.name);
      } catch {
        /* continue */
      }
    }
    setMessage('Reindex started for all datasets');
    setTimeout(() => setMessage(''), 3000);
    setReindexing(null);
  };

  const categoryColors: Record<string, string> = {
    financial: 'bg-emerald-500/10 text-emerald-400',
    knowledge: 'bg-violet-500/10 text-violet-400',
    temporal: 'bg-blue-500/10 text-blue-400',
    default: 'bg-zinc-500/10 text-zinc-400',
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Cognee Manager</h2>
        <div className="animate-pulse h-64 rounded-2xl bg-[#16213e]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Cognee Manager</h2>
          <p className="text-sm text-zinc-500">Manage knowledge base datasets and graph</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReindexAll}
            disabled={reindexing !== null}
            className="px-4 py-2 rounded-lg bg-[#FFCC00] text-[#1a1a2e] font-bold text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${reindexing === 'all' ? 'animate-spin' : ''}`} />
            Reindex All
          </button>
          <button
            type="button"
            onClick={() => { setFetchState((s) => ({ ...s, loading: true })); void loadData(); }}
            className="p-2 rounded-xl bg-[#16213e] text-zinc-400 hover:text-[#FFCC00]"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`px-4 py-2 rounded-lg text-sm ${message.includes('failed') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}
        >
          {message}
        </div>
      )}

      {/* Graph Stats Summary */}
      {graphStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-[#16213e] p-4 text-center">
            <BarChart3 className="w-5 h-5 text-[#FFCC00] mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">
              {graphStats.totalNodes?.toLocaleString()}
            </p>
            <p className="text-[10px] text-zinc-500 uppercase">Nodes</p>
          </div>
          <div className="rounded-xl bg-[#16213e] p-4 text-center">
            <Layers className="w-5 h-5 text-violet-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">
              {graphStats.totalEdges?.toLocaleString()}
            </p>
            <p className="text-[10px] text-zinc-500 uppercase">Edges</p>
          </div>
          <div className="rounded-xl bg-[#16213e] p-4 text-center">
            <Database className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">
              {Object.keys(graphStats.nodeTypes || {}).length}
            </p>
            <p className="text-[10px] text-zinc-500 uppercase">Node Types</p>
          </div>
          <div className="rounded-xl bg-[#16213e] p-4 text-center">
            <FileText className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{datasets.length}</p>
            <p className="text-[10px] text-zinc-500 uppercase">Datasets</p>
          </div>
        </div>
      )}

      {/* Dataset Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {datasets.map((ds) => (
          <div
            key={ds.name}
            className="rounded-2xl bg-[#16213e] shadow-[6px_6px_12px_#0a0a1a,-6px_-6px_12px_#222244] p-5 border border-white/5 hover:border-[#FFCC00]/10 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#FFCC00]" />
                <h4 className="text-sm font-bold text-white truncate">{ds.name}</h4>
              </div>
              {ds.category && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${categoryColors[ds.category] || categoryColors.default}`}
                >
                  {ds.category}
                </span>
              )}
            </div>
            <div className="space-y-1 text-xs text-zinc-400 mb-4">
              <p>Documents: {ds.documentCount ?? '-'}</p>
              <p>Entities: {ds.entityCount ?? '-'}</p>
              {ds.lastIndexed && <p>Indexed: {new Date(ds.lastIndexed).toLocaleString()}</p>}
              {ds.status && (
                <p>
                  Status:{' '}
                  <span className={ds.status === 'ready' ? 'text-emerald-400' : 'text-yellow-400'}>
                    {ds.status}
                  </span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleReindex(ds.name)}
              disabled={reindexing !== null}
              className="w-full py-2 rounded-lg border border-white/10 text-xs font-medium text-zinc-400 hover:text-[#FFCC00] hover:border-[#FFCC00]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${reindexing === ds.name ? 'animate-spin' : ''}`} />
              Reindex
            </button>
          </div>
        ))}
      </div>

      {datasets.length === 0 && (
        <div className="rounded-2xl bg-[#16213e] p-12 text-center">
          <Database className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500">No datasets found</p>
        </div>
      )}
    </div>
  );
}
