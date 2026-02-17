import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import ForceGraph3D, { type ForceGraph3DInstance } from '3d-force-graph';
import type { NodeObject, LinkObject } from 'three-forcegraph';
import {
  Search,
  Filter,
  RotateCcw,
  Maximize2,
  X,
  ExternalLink,
  ChevronDown,
  Loader2,
  AlertTriangle,
  Database,
  GitBranch,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CogneeGraphViewerProps {
  datasetName?: string;
  initialFocus?: string;
  height?: number;
  width?: number;
}

interface GraphNode extends NodeObject {
  id: string;
  name: string;
  type: string;
  dataset: string;
  properties: Record<string, unknown>;
  connections: number;
  val: number;
  color: string;
}

interface GraphLink extends LinkObject<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  properties: Record<string, unknown>;
  color: string;
}

// ---------------------------------------------------------------------------
// Color Maps
// ---------------------------------------------------------------------------

const NODE_COLORS: Record<string, string> = {
  merchant: '#FFCC00',
  transaction: '#4CAF50',
  category: '#2196F3',
  account: '#FF9800',
  product: '#E91E63',
  rate: '#9C27B0',
  indicator: '#00BCD4',
  person: '#FF5722',
  organization: '#795548',
  concept: '#607D8B',
  default: '#9E9E9E',
};

const EDGE_COLORS: Record<string, string> = {
  categorized_as: '#4CAF50',
  paid_to: '#FFCC00',
  belongs_to: '#2196F3',
  has_rate: '#9C27B0',
  related_to: '#607D8B',
  default: '#424242',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_NODES = 1000;
const MAX_LINKS = 2000;

const adminFetch = async (path: string) => {
  const token = localStorage.getItem('admin_token');
  const BASE_URL = import.meta.env.VITE_API_URL || '';
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

function nodeColor(type: string): string {
  return NODE_COLORS[type.toLowerCase()] ?? NODE_COLORS.default;
}

function edgeColor(type: string): string {
  return EDGE_COLORS[type.toLowerCase()] ?? EDGE_COLORS.default;
}

function sourceId(link: GraphLink): string {
  return typeof link.source === 'object' ? (link.source as GraphNode).id : String(link.source);
}

function targetId(link: GraphLink): string {
  return typeof link.target === 'object' ? (link.target as GraphNode).id : String(link.target);
}

interface RawGraphResponse {
  nodes?: RawNode[];
  links?: RawLink[];
  edges?: RawLink[];
  data?: {
    nodes?: RawNode[];
    links?: RawLink[];
    edges?: RawLink[];
  };
}

interface RawNode {
  id: string | number;
  name?: string;
  label?: string;
  type?: string;
  entity_type?: string;
  dataset?: string;
  connections?: number;
  degree?: number;
  properties?: Record<string, unknown>;
}

interface RawLink {
  source: string | number;
  target: string | number;
  type?: string;
  relationship?: string;
  properties?: Record<string, unknown>;
}

/** Transform raw API response into typed graph data. */
function transformToGraphData(raw: RawGraphResponse): { nodes: GraphNode[]; links: GraphLink[] } {
  const rawNodes: RawNode[] = raw?.nodes ?? raw?.data?.nodes ?? [];
  const rawLinks: RawLink[] = raw?.links ?? raw?.edges ?? raw?.data?.links ?? raw?.data?.edges ?? [];

  const nodes: GraphNode[] = rawNodes.slice(0, MAX_NODES).map((n: RawNode) => {
    const type = (n.type || n.entity_type || 'default').toLowerCase();
    const connections = Number(n.connections ?? n.degree ?? 0);
    return {
      id: String(n.id),
      name: n.name || n.label || n.id,
      type,
      dataset: n.dataset || 'unknown',
      properties: n.properties ?? {},
      connections,
      val: Math.max(1, Math.min(connections, 20)),
      color: nodeColor(type),
    };
  });

  const nodeIds = new Set(nodes.map((n) => n.id));

  const links: GraphLink[] = rawLinks
    .filter((l: RawLink) => nodeIds.has(String(l.source)) && nodeIds.has(String(l.target)))
    .slice(0, MAX_LINKS)
    .map((l: RawLink) => {
      const type = (l.type || l.relationship || 'related_to').toLowerCase();
      return {
        source: String(l.source),
        target: String(l.target),
        type,
        properties: l.properties ?? {},
        color: edgeColor(type),
      };
    });

  return { nodes, links };
}

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

/** Safely remove all child nodes from an element (no innerHTML). */
function clearChildren(el: HTMLElement) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatsOverlay({
  nodeCount,
  linkCount,
  datasetCount,
  typeCount,
}: {
  nodeCount: number;
  linkCount: number;
  datasetCount: number;
  typeCount: number;
}) {
  return (
    <div className="absolute bottom-4 left-4 bg-[#1a1a2e]/90 border border-[#FFCC00]/20 rounded-lg px-3 py-2 text-xs font-mono text-gray-400 space-y-0.5 pointer-events-none select-none">
      <div>
        Nodes: <span className="text-[#FFCC00]">{nodeCount}</span>
      </div>
      <div>
        Edges: <span className="text-[#FFCC00]">{linkCount}</span>
      </div>
      <div>
        Datasets: <span className="text-[#FFCC00]">{datasetCount}</span>
      </div>
      <div>
        Types: <span className="text-[#FFCC00]">{typeCount}</span>
      </div>
    </div>
  );
}

function DetailPanel({
  node,
  links,
  allNodes,
  onClose,
  onNavigate,
}: {
  node: GraphNode;
  links: GraphLink[];
  allNodes: GraphNode[];
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const connectedLinks = links.filter((l) => sourceId(l) === node.id || targetId(l) === node.id);
  const connectedNodes = connectedLinks.map((l) => {
    const otherId = sourceId(l) === node.id ? targetId(l) : sourceId(l);
    const other = allNodes.find((n) => n.id === otherId);
    return { id: otherId, name: other?.name ?? otherId, type: l.type };
  });

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-[#1a1a2e]/95 border-l border-[#FFCC00]/20 overflow-y-auto z-20 animate-slide-in-right">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white truncate">{node.name}</h3>
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
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white/5 rounded px-2 py-1.5">
            <span className="text-gray-400">Connections</span>
            <span className="block text-white font-medium">{node.connections}</span>
          </div>
          <div className="bg-white/5 rounded px-2 py-1.5">
            <span className="text-gray-400">ID</span>
            <span className="block text-white font-medium truncate text-[10px]">{node.id}</span>
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
                    className="flex justify-between text-xs bg-white/5 rounded px-2 py-1"
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
                  className="w-full flex items-center gap-2 text-xs bg-white/5 rounded px-2 py-1.5 hover:bg-white/10 transition-colors text-left"
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

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-gray-300 hover:border-[#FFCC00]/40 transition-colors"
      >
        <Filter className="w-3 h-3" />
        {label}
        {selected.length > 0 && (
          <span className="ml-1 px-1 bg-[#FFCC00]/20 text-[#FFCC00] rounded text-[10px]">
            {selected.length}
          </span>
        )}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-[#1a1a2e] border border-[#FFCC00]/20 rounded-lg shadow-xl z-30 min-w-[160px] max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="accent-[#FFCC00]"
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CogneeGraphViewer({
  datasetName,
  initialFocus,
  height: propHeight,
  width: propWidth,
}: CogneeGraphViewerProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraph3DInstance | null>(null);

  // Raw data
  const [allNodes, setAllNodes] = useState<GraphNode[]>([]);
  const [allLinks, setAllLinks] = useState<GraphLink[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [webglSupported] = useState(() => detectWebGL());

  // Filter state
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedEdgeTypes, setSelectedEdgeTypes] = useState<string[]>([]);
  const [minConnections, setMinConnections] = useState(1);

  // Derived lists
  const allEntityTypes = useMemo(
    () => [...new Set(allNodes.map((n) => n.type))].sort(),
    [allNodes],
  );
  const allDatasets = useMemo(
    () => [...new Set(allNodes.map((n) => n.dataset))].sort(),
    [allNodes],
  );
  const allEdgeTypes = useMemo(() => [...new Set(allLinks.map((l) => l.type))].sort(), [allLinks]);

  // Dimension calc
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const graphWidth = propWidth ?? containerSize.w;
  const graphHeight = propHeight ?? Math.max(400, window.innerHeight - 200);

  // ---------------------------------------------------------------------------
  // Filtered graph data
  // ---------------------------------------------------------------------------

  const filteredData = useMemo(() => {
    let nodes = allNodes;
    let links = allLinks;

    if (selectedTypes.length > 0) {
      nodes = nodes.filter((n) => selectedTypes.includes(n.type));
    }
    if (selectedDataset) {
      nodes = nodes.filter((n) => n.dataset === selectedDataset);
    }
    if (minConnections > 1) {
      nodes = nodes.filter((n) => n.connections >= minConnections);
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    links = links.filter((l) => nodeIds.has(sourceId(l)) && nodeIds.has(targetId(l)));

    if (selectedEdgeTypes.length > 0) {
      links = links.filter((l) => selectedEdgeTypes.includes(l.type));
    }

    // Apply search dimming
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.map((n) => ({
        ...n,
        color: n.name.toLowerCase().includes(q) ? '#FFFFFF' : nodeColor(n.type) + '40',
      }));
    }

    return { nodes, links };
  }, [
    allNodes,
    allLinks,
    selectedTypes,
    selectedDataset,
    selectedEdgeTypes,
    minConnections,
    searchQuery,
  ]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let raw: RawGraphResponse;
      if (datasetName) {
        raw = await adminFetch(`/api/admin/cognee/datasets/${encodeURIComponent(datasetName)}`);
      } else {
        raw = await adminFetch('/api/admin/cognee/graph/stats');
      }
      const { nodes, links } = transformToGraphData(raw);
      setAllNodes(nodes);
      setAllLinks(links);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  }, [datasetName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // 3D Graph lifecycle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!webglSupported || loading || error || !graphContainerRef.current) return;
    if (filteredData.nodes.length === 0) return;

    // Destroy previous instance
    if (graphRef.current) {
      graphRef.current._destructor();
      graphRef.current = null;
    }

    // Clear container safely (no innerHTML)
    clearChildren(graphContainerRef.current);

    const graph = new ForceGraph3D(graphContainerRef.current)
      .graphData({ nodes: [...filteredData.nodes], links: [...filteredData.links] })
      .nodeLabel((node: GraphNode) => `${node.name} (${node.type})`)
      .nodeColor((node: GraphNode) => node.color)
      .nodeVal((node: GraphNode) => node.val)
      .nodeOpacity(0.9)
      .nodeResolution(16)
      .linkColor((link: GraphLink) => link.color)
      .linkOpacity(0.4)
      .linkWidth(1)
      .linkDirectionalArrowLength(3)
      .linkDirectionalArrowRelPos(1)
      .linkLabel((link: GraphLink) => link.type)
      .backgroundColor('#1a1a2e')
      .width(graphWidth)
      .height(graphHeight)
      .showNavInfo(false)
      .warmupTicks(50)
      .cooldownTicks(100)
      .onNodeClick((node: GraphNode) => {
        setSelectedNode(node);
        zoomToNode(graph, node);
      })
      .onBackgroundClick(() => {
        setSelectedNode(null);
      });

    graphRef.current = graph;

    // If initial focus specified, zoom to it
    if (initialFocus) {
      const focusNode = filteredData.nodes.find((n) => n.id === initialFocus);
      if (focusNode) {
        setTimeout(() => {
          setSelectedNode(focusNode);
          zoomToNode(graph, focusNode);
        }, 1500);
      }
    }

    return () => {
      graph._destructor();
      graphRef.current = null;
    };
    // Re-init on data or size change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData, graphWidth, graphHeight, webglSupported, loading, error]);

  // ---------------------------------------------------------------------------
  // Camera helpers
  // ---------------------------------------------------------------------------

  function zoomToNode(graph: ForceGraph3DInstance, node: GraphNode) {
    const distance = 100;
    const n = node as GraphNode & { x?: number; y?: number; z?: number };
    const x = n.x ?? 0;
    const y = n.y ?? 0;
    const z = n.z ?? 0;
    const hypot = Math.hypot(x, y, z) || 1;
    const distRatio = 1 + distance / hypot;
    graph.cameraPosition(
      { x: x * distRatio, y: y * distRatio, z: z * distRatio },
      { x, y, z },
      1000,
    );
  }

  const handleResetView = useCallback(() => {
    graphRef.current?.zoomToFit(400, 40);
    setSelectedNode(null);
    setSearchQuery('');
    setSelectedTypes([]);
    setSelectedDataset('');
    setSelectedEdgeTypes([]);
    setMinConnections(1);
  }, []);

  const handleNavigateToNode = useCallback(
    (nodeId: string) => {
      const node = allNodes.find((n) => n.id === nodeId);
      if (node && graphRef.current) {
        setSelectedNode(node);
        zoomToNode(graphRef.current, node);
      }
    },
    [allNodes],
  );

  const handleToggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'r' || e.key === 'R') handleResetView();
      if (e.key === 'f' || e.key === 'F') handleToggleFullscreen();
      if (e.key === 'Escape') setSelectedNode(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleResetView, handleToggleFullscreen]);

  // Search zoom: zoom to first match whenever search changes
  useEffect(() => {
    if (!searchQuery || !graphRef.current) return;
    const q = searchQuery.toLowerCase();
    const match = filteredData.nodes.find((n) => n.name.toLowerCase().includes(q));
    if (match) {
      zoomToNode(graphRef.current, match);
    }
  }, [searchQuery, filteredData.nodes]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // No WebGL
  if (!webglSupported) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center text-gray-400 bg-[#1a1a2e] rounded-xl border border-[#FFCC00]/10">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">WebGL Not Available</h3>
        <p className="text-sm max-w-md">
          Your browser does not support WebGL, which is required for the 3D graph viewer. Please try
          a modern browser or use the 2D fallback view.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative bg-[#1a1a2e] rounded-xl border border-[#FFCC00]/10 overflow-hidden"
      style={{ height: graphHeight }}
    >
      {/* ---- Filter Bar ---- */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 p-2 bg-[#1a1a2e]/80 backdrop-blur-sm border-b border-white/5 flex-wrap">
        {/* Search */}
        <div className="relative flex-shrink-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
          <input
            type="text"
            placeholder="Search nodes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 pr-2 py-1 w-44 bg-white/5 border border-white/10 rounded text-xs text-gray-200 placeholder:text-gray-500 focus:border-[#FFCC00]/40 focus:outline-none"
          />
        </div>

        {/* Entity type filter */}
        <MultiSelect
          label="Types"
          options={allEntityTypes}
          selected={selectedTypes}
          onChange={setSelectedTypes}
        />

        {/* Dataset filter */}
        <select
          value={selectedDataset}
          onChange={(e) => setSelectedDataset(e.target.value)}
          className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 hover:border-[#FFCC00]/40 focus:outline-none"
        >
          <option value="">All datasets</option>
          {allDatasets.map((ds) => (
            <option key={ds} value={ds}>
              {ds}
            </option>
          ))}
        </select>

        {/* Edge type filter */}
        <MultiSelect
          label="Edges"
          options={allEdgeTypes}
          selected={selectedEdgeTypes}
          onChange={setSelectedEdgeTypes}
        />

        {/* Connection threshold */}
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <GitBranch className="w-3 h-3" />
          <span className="hidden sm:inline">Min:</span>
          <input
            type="range"
            min={1}
            max={Math.max(20, Math.max(...allNodes.map((n) => n.connections), 1))}
            value={minConnections}
            onChange={(e) => setMinConnections(Number(e.target.value))}
            className="w-16 accent-[#FFCC00]"
          />
          <span className="text-[#FFCC00] w-4 text-center">{minConnections}</span>
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <button
          onClick={handleResetView}
          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="Reset view (R)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleToggleFullscreen}
          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="Fullscreen (F)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ---- Graph Canvas Container ---- */}
      <div ref={graphContainerRef} className="w-full h-full" />

      {/* ---- Loading Overlay ---- */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e]/90 z-20">
          <Loader2 className="w-10 h-10 text-[#FFCC00] animate-spin mb-3" />
          <p className="text-sm text-gray-400">Loading knowledge graph…</p>
        </div>
      )}

      {/* ---- Error Overlay ---- */}
      {error && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e]/90 z-20">
          <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
          <p className="text-sm text-red-300 mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-1.5 bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded text-sm text-[#FFCC00] hover:bg-[#FFCC00]/20 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ---- Empty State ---- */}
      {!loading && !error && allNodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <Database className="w-12 h-12 text-gray-600 mb-3" />
          <h3 className="text-lg font-semibold text-gray-400 mb-1">No Graph Data</h3>
          <p className="text-sm text-gray-500 max-w-sm text-center">
            Index data to Cognee to see the knowledge graph visualization.
          </p>
        </div>
      )}

      {/* ---- Stats Overlay ---- */}
      {!loading && !error && filteredData.nodes.length > 0 && (
        <StatsOverlay
          nodeCount={filteredData.nodes.length}
          linkCount={filteredData.links.length}
          datasetCount={new Set(filteredData.nodes.map((n) => n.dataset)).size}
          typeCount={new Set(filteredData.nodes.map((n) => n.type)).size}
        />
      )}

      {/* ---- Node Detail Panel ---- */}
      {selectedNode && (
        <DetailPanel
          node={selectedNode}
          links={allLinks}
          allNodes={allNodes}
          onClose={() => setSelectedNode(null)}
          onNavigate={handleNavigateToNode}
        />
      )}

      {/* ---- Keyboard hint ---- */}
      <div className="absolute bottom-4 right-4 text-[10px] text-gray-600 pointer-events-none select-none">
        R: Reset &middot; F: Fullscreen &middot; Esc: Deselect
      </div>
    </div>
  );
}

export default CogneeGraphViewer;
