import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import ForceGraph3D, { type ForceGraph3DInstance } from '3d-force-graph';
import {
  Search,
  RotateCcw,
  Maximize2,
  Loader2,
  AlertTriangle,
  Database,
  GitBranch,
} from 'lucide-react';
import type { CogneeGraphViewerProps, GraphNode, GraphLink, RawGraphResponse } from './types.js';
import {
  adminFetch,
  nodeColor,
  sourceId,
  targetId,
  transformToGraphData,
  detectWebGL,
  clearChildren,
  zoomToNode,
} from './utils.js';
import { StatsOverlay } from './components/StatsOverlay.js';
import { DetailPanel } from './components/DetailPanel.js';
import { MultiSelect } from './components/MultiSelect.js';

export function CogneeGraphViewer({
  datasetName,
  initialFocus,
  height: propHeight,
  width: propWidth,
}: CogneeGraphViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraph3DInstance | null>(null);

  const [allNodes, setAllNodes] = useState<GraphNode[]>([]);
  const [allLinks, setAllLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [webglSupported] = useState(() => detectWebGL());

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedEdgeTypes, setSelectedEdgeTypes] = useState<string[]>([]);
  const [minConnections, setMinConnections] = useState(1);

  const allEntityTypes = useMemo(
    () => [...new Set(allNodes.map((n) => n.type))].sort(),
    [allNodes],
  );
  const allDatasets = useMemo(
    () => [...new Set(allNodes.map((n) => n.dataset))].sort(),
    [allNodes],
  );
  const allEdgeTypes = useMemo(() => [...new Set(allLinks.map((l) => l.type))].sort(), [allLinks]);

  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const graphWidth = propWidth ?? containerSize.w;
  const graphHeight = propHeight ?? Math.max(400, window.innerHeight - 200);

  const filteredData = useMemo(() => {
    let nodes = allNodes;
    let links = allLinks;

    if (selectedTypes.length > 0) nodes = nodes.filter((n) => selectedTypes.includes(n.type));
    if (selectedDataset) nodes = nodes.filter((n) => n.dataset === selectedDataset);
    if (minConnections > 1) nodes = nodes.filter((n) => n.connections >= minConnections);

    const nodeIds = new Set(nodes.map((n) => n.id));
    links = links.filter((l) => nodeIds.has(sourceId(l)) && nodeIds.has(targetId(l)));

    if (selectedEdgeTypes.length > 0)
      links = links.filter((l) => selectedEdgeTypes.includes(l.type));

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let raw: RawGraphResponse;
      if (datasetName) {
        raw = (await adminFetch(
          `/api/admin/cognee/datasets/${encodeURIComponent(datasetName)}`,
        )) as RawGraphResponse;
      } else {
        raw = (await adminFetch('/api/admin/cognee/graph/stats')) as RawGraphResponse;
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

  useEffect(() => {
    if (!webglSupported || loading || error || !graphContainerRef.current) return;
    if (filteredData.nodes.length === 0) return;

    if (graphRef.current) {
      graphRef.current._destructor();
      graphRef.current = null;
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData, graphWidth, graphHeight, webglSupported, loading, error]);

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

  useEffect(() => {
    if (!searchQuery || !graphRef.current) return;
    const q = searchQuery.toLowerCase();
    const match = filteredData.nodes.find((n) => n.name.toLowerCase().includes(q));
    if (match) zoomToNode(graphRef.current, match);
  }, [searchQuery, filteredData.nodes]);

  // Suppress unused variable warning — isFullscreen used for future styling
  void isFullscreen;

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
      {/* Filter Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 p-2 bg-[#1a1a2e]/80 backdrop-blur-sm border-b border-white/5 flex-wrap">
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

        <MultiSelect
          label="Types"
          options={allEntityTypes}
          selected={selectedTypes}
          onChange={setSelectedTypes}
        />

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

        <MultiSelect
          label="Edges"
          options={allEdgeTypes}
          selected={selectedEdgeTypes}
          onChange={setSelectedEdgeTypes}
        />

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

      <div ref={graphContainerRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e]/90 z-20">
          <Loader2 className="w-10 h-10 text-[#FFCC00] animate-spin mb-3" />
          <p className="text-sm text-gray-400">Loading knowledge graph…</p>
        </div>
      )}

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

      {!loading && !error && allNodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <Database className="w-12 h-12 text-gray-600 mb-3" />
          <h3 className="text-lg font-semibold text-gray-400 mb-1">No Graph Data</h3>
          <p className="text-sm text-gray-500 max-w-sm text-center">
            Index data to Cognee to see the knowledge graph visualization.
          </p>
        </div>
      )}

      {!loading && !error && filteredData.nodes.length > 0 && (
        <StatsOverlay
          nodeCount={filteredData.nodes.length}
          linkCount={filteredData.links.length}
          datasetCount={new Set(filteredData.nodes.map((n) => n.dataset)).size}
          typeCount={new Set(filteredData.nodes.map((n) => n.type)).size}
        />
      )}

      {selectedNode && (
        <DetailPanel
          node={selectedNode}
          links={allLinks}
          allNodes={allNodes}
          onClose={() => setSelectedNode(null)}
          onNavigate={handleNavigateToNode}
        />
      )}

      <div className="absolute bottom-4 right-4 text-[10px] text-gray-600 pointer-events-none select-none">
        R: Reset &middot; F: Fullscreen &middot; Esc: Deselect
      </div>
    </div>
  );
}

export default CogneeGraphViewer;
