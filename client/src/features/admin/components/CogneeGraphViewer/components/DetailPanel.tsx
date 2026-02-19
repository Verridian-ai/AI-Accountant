import { X, ExternalLink } from 'lucide-react';
import type { GraphNode, GraphLink } from '../types.js';
import { sourceId, targetId } from '../utils.js';

interface DetailPanelProps {
  node: GraphNode;
  links: GraphLink[];
  allNodes: GraphNode[];
  onClose: () => void;
  onNavigate: (id: string) => void;
}

export function DetailPanel({ node, links, allNodes, onClose, onNavigate }: DetailPanelProps) {
  const connectedLinks = links.filter((l) => sourceId(l) === node.id || targetId(l) === node.id);
  const connectedNodes = connectedLinks.map((l) => {
    const otherId = sourceId(l) === node.id ? targetId(l) : sourceId(l);
    const other = allNodes.find((n) => n.id === otherId);
    return { id: otherId, name: other?.name ?? otherId, type: l.type };
  });

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-[#1a1a2e]/95 border-l border-cba-gold/20 overflow-y-auto z-20 animate-slide-in-right">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-primary truncate">{node.name}</h3>
            <div className="flex gap-2 mt-1">
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: node.color + '30', color: node.color }}
              >
                {node.type}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300">
                {node.dataset}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-overlay-hover text-gray-400 hover:text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-overlay rounded px-2 py-1.5">
            <span className="text-gray-400">Connections</span>
            <span className="block text-primary font-medium">{node.connections}</span>
          </div>
          <div className="bg-overlay rounded px-2 py-1.5">
            <span className="text-gray-400">ID</span>
            <span className="block text-primary font-medium truncate text-[10px]">{node.id}</span>
          </div>
        </div>

        {/* Properties */}
        {Object.keys(node.properties).length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
              Properties
            </h4>
            <div className="space-y-1">
              {Object.entries(node.properties)
                .slice(0, 12)
                .map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between text-xs bg-overlay rounded px-2 py-1"
                  >
                    <span className="text-gray-400 truncate mr-2">{key}</span>
                    <span className="text-gray-200 truncate">{String(value)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Connected Entities */}
        {connectedNodes.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
              Connected ({connectedNodes.length})
            </h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {connectedNodes.map((cn, i) => (
                <button
                  key={`${cn.id}-${i}`}
                  onClick={() => onNavigate(cn.id)}
                  className="w-full flex items-center gap-2 text-xs bg-overlay rounded px-2 py-1.5 hover:bg-overlay-hover transition-colors text-left"
                >
                  <ExternalLink className="w-3 h-3 text-gray-500 flex-shrink-0" />
                  <span className="text-gray-200 truncate flex-1">{cn.name}</span>
                  <span className="text-gray-500 text-[10px]">{cn.type}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
