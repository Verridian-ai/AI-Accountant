import React, { useEffect, useState } from 'react';
import { BarChart3, CircleDot, Minus, Layers, Network, Loader2 } from 'lucide-react';
import { knowledgeApi } from '../../../api';

interface GraphStatsPanelProps {
  datasetName: string;
}

interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  density: number;
  avgDegree: number;
  components: number;
  nodeTypes: Record<string, number>;
  edgeTypes: Record<string, number>;
  topConnected: Array<{ id: string; label: string; degree: number; type: string }>;
}

export function GraphStatsPanel({ datasetName }: GraphStatsPanelProps) {
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!datasetName) return;
    setLoading(true);
    setError(null);
    knowledgeApi
      .graphStats(datasetName)
      .then(setStats)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, [datasetName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="neu-inset rounded-xl p-6 text-center">
        <p className="text-sm text-red-400">Failed to load graph stats: {error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="neu-inset rounded-xl p-6 text-center">
        <p className="text-sm text-zinc-500">No stats available. Select a dataset first.</p>
      </div>
    );
  }

  const statCards = [
    { label: 'Nodes', value: stats.nodeCount, icon: CircleDot, color: 'text-[#FFCC00]' },
    { label: 'Edges', value: stats.edgeCount, icon: Minus, color: 'text-blue-400' },
    { label: 'Density', value: stats.density.toFixed(4), icon: Layers, color: 'text-emerald-400' },
    {
      label: 'Avg Degree',
      value: stats.avgDegree.toFixed(2),
      icon: Network,
      color: 'text-purple-400',
    },
    { label: 'Components', value: stats.components, icon: BarChart3, color: 'text-amber-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className="neu-raised rounded-xl p-4 text-center">
            <card.icon className={`w-5 h-5 mx-auto mb-2 ${card.color}`} />
            <p className="text-lg font-bold text-zinc-100">{card.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Node Type Distribution */}
        <div className="neu-raised rounded-xl p-4">
          <h4 className="text-sm font-bold text-zinc-200 mb-3">Node Types</h4>
          <div className="space-y-2">
            {Object.entries(stats.nodeTypes)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => {
                const pct = stats.nodeCount > 0 ? (count / stats.nodeCount) * 100 : 0;
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400 w-24 truncate">{type}</span>
                    <div className="flex-1 neu-inset rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#FFCC00]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-300 w-12 text-right">{count}</span>
                  </div>
                );
              })}
            {Object.keys(stats.nodeTypes).length === 0 && (
              <p className="text-xs text-zinc-500">No node types found</p>
            )}
          </div>
        </div>

        {/* Edge Type Distribution */}
        <div className="neu-raised rounded-xl p-4">
          <h4 className="text-sm font-bold text-zinc-200 mb-3">Edge Types</h4>
          <div className="space-y-2">
            {Object.entries(stats.edgeTypes)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => {
                const pct = stats.edgeCount > 0 ? (count / stats.edgeCount) * 100 : 0;
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400 w-24 truncate">{type}</span>
                    <div className="flex-1 neu-inset rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-300 w-12 text-right">{count}</span>
                  </div>
                );
              })}
            {Object.keys(stats.edgeTypes).length === 0 && (
              <p className="text-xs text-zinc-500">No edge types found</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Connected Nodes */}
      {stats.topConnected.length > 0 && (
        <div className="neu-raised rounded-xl p-4">
          <h4 className="text-sm font-bold text-zinc-200 mb-3">Most Connected Nodes</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 uppercase tracking-wider text-[10px]">
                  <th className="text-left pb-2 pr-3">Node</th>
                  <th className="text-left pb-2 pr-3">Type</th>
                  <th className="text-right pb-2">Connections</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.topConnected.slice(0, 10).map((node) => (
                  <tr key={node.id}>
                    <td className="py-2 pr-3 text-zinc-300 font-medium truncate max-w-[200px]">
                      {node.label || node.id}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-zinc-400">
                        {node.type}
                      </span>
                    </td>
                    <td className="py-2 text-right text-[#FFCC00] font-bold">{node.degree}</td>
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
