import React from 'react';
import { X, ThumbsUp, ThumbsDown, Navigation, Tag, Link2 } from 'lucide-react';

interface GraphNode {
  id: string;
  label?: string;
  type?: string;
  neighbors?: Array<{ id: string; label: string; edgeType: string }>;
  properties?: Record<string, unknown>;
}

interface NodeDetailPanelProps {
  node: GraphNode;
  onNavigate: (nodeId: string) => void;
  onFeedback: (nodeId: string, type: string) => void;
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  entity: '#FFCC00',
  relationship: '#60a5fa',
  document: '#34d399',
  chunk: '#a78bfa',
  concept: '#f472b6',
  default: '#94a3b8',
};

export function NodeDetailPanel({ node, onNavigate, onFeedback, onClose }: NodeDetailPanelProps) {
  const color = TYPE_COLORS[node.type] ?? TYPE_COLORS.default;

  const neighbors: Array<{ id: string; label: string; edgeType: string }> = node.neighbors ?? [];
  const grouped = neighbors.reduce<Record<string, typeof neighbors>>((acc, n) => {
    const key = n.edgeType || 'related';
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});

  const properties: Record<string, unknown> = node.properties ?? {};

  return (
    <div className="neu-raised rounded-2xl border border-white/5 overflow-hidden animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-4 h-4 rounded-full shrink-0 ring-2 ring-white/10"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-zinc-100 truncate">{node.label || node.id}</h3>
            <span
              className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {node.type || 'unknown'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="neu-raised-sm p-1.5 rounded-lg text-zinc-400 hover:text-white shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Properties */}
      {Object.keys(properties).length > 0 && (
        <div className="p-4 border-b border-white/5">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
            <Tag className="w-3 h-3" /> Properties
          </h4>
          <div className="space-y-1.5">
            {Object.entries(properties).map(([key, val]) => (
              <div key={key} className="flex items-start gap-2 text-xs">
                <span className="text-zinc-500 font-medium shrink-0">{key}:</span>
                <span className="text-zinc-300 break-all">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Neighbors */}
      {Object.keys(grouped).length > 0 && (
        <div className="p-4 border-b border-white/5">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
            <Link2 className="w-3 h-3" /> Neighbors
          </h4>
          <div className="space-y-3">
            {Object.entries(grouped).map(([edgeType, nodes]) => (
              <div key={edgeType}>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  {edgeType}
                </p>
                <div className="space-y-1">
                  {nodes.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onNavigate(n.id)}
                      className="w-full text-left text-xs text-zinc-300 hover:text-[#FFCC00] py-1 px-2 rounded-lg hover:bg-white/5 transition-colors truncate"
                    >
                      {n.label || n.id}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onFeedback(node.id, 'positive')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-emerald-400 hover:bg-emerald-400/10 neu-raised-sm transition-colors"
        >
          <ThumbsUp className="w-3.5 h-3.5" /> Helpful
        </button>
        <button
          type="button"
          onClick={() => onFeedback(node.id, 'negative')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-400/10 neu-raised-sm transition-colors"
        >
          <ThumbsDown className="w-3.5 h-3.5" /> Incorrect
        </button>
        <button
          type="button"
          onClick={() => onNavigate(node.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-[#FFCC00] hover:bg-[#FFCC00]/10 neu-raised-sm transition-colors"
        >
          <Navigation className="w-3.5 h-3.5" /> Explore
        </button>
      </div>
    </div>
  );
}
