import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Search, RotateCcw, Loader2, AlertTriangle, Database, X } from 'lucide-react';
import type { CogneeGraph2DFallbackProps, GraphNode, GraphLink, RawGraphResponse2D } from './types';
import { adminFetch, transformData } from './utils';
import { forceStep } from './forceSimulation';

export function CogneeGraph2DFallback({
  datasetName,
  height: propHeight,
}: CogneeGraph2DFallbackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState({ active: false, startX: 0, startY: 0 });
  const [counts, setCounts] = useState({ nodes: 0, links: 0 });

  const graphHeight = propHeight ?? Math.max(400, window.innerHeight - 200);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let raw: RawGraphResponse2D;
      if (datasetName) {
        raw = (await adminFetch(
          `/api/admin/cognee/datasets/${encodeURIComponent(datasetName)}`,
        )) as RawGraphResponse2D;
      } else {
        raw = (await adminFetch('/api/admin/cognee/graph/stats')) as RawGraphResponse2D;
      }
      const { nodes, links } = transformData(raw);
      nodesRef.current = nodes;
      linksRef.current = links;
      setCounts({ nodes: nodes.length, links: links.length });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, [datasetName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Canvas rendering loop
  useEffect(() => {
    if (loading || error || nodesRef.current.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let alpha = 0.3;

    const render = () => {
      const nodes = nodesRef.current;
      const links = linksRef.current;
      const w = canvas.width;
      const h = canvas.height;

      if (alpha > 0.001) {
        forceStep(nodes, links, alpha);
        alpha *= 0.995;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(w / 2 + pan.x, h / 2 + pan.y);
      ctx.scale(zoom, zoom);

      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      const lowerQuery = searchQuery.toLowerCase();

      // Draw links
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.3;
      for (const link of links) {
        const a = nodeMap.get(link.source);
        const b = nodeMap.get(link.target);
        if (!a || !b) continue;
        ctx.strokeStyle = link.color;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Draw nodes
      ctx.globalAlpha = 1;
      for (const node of nodes) {
        const isMatch = lowerQuery && node.name.toLowerCase().includes(lowerQuery);
        const isDimmed = lowerQuery && !isMatch;
        const isSelected = selectedNode?.id === node.id;

        ctx.globalAlpha = isDimmed ? 0.2 : 1;
        ctx.fillStyle = isMatch ? '#FFFFFF' : node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = '#FFCC00';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        if (node.radius > 6 || isSelected || isMatch) {
          ctx.fillStyle = isDimmed ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.8)';
          ctx.font = `${Math.max(8, node.radius * 0.8)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(node.name, node.x, node.y + node.radius + 10);
        }
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [loading, error, zoom, pan, searchQuery, selectedNode]);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ro = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    });
    ro.observe(container);
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    return () => ro.disconnect();
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - canvas.width / 2 - pan.x) / zoom;
      const my = (e.clientY - rect.top - canvas.height / 2 - pan.y) / zoom;

      let closest: GraphNode | null = null;
      let closestDist = Infinity;
      for (const node of nodesRef.current) {
        const dx = node.x - mx;
        const dy = node.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < node.radius + 4 && dist < closestDist) {
          closest = node;
          closestDist = dist;
        }
      }
      setSelectedNode(closest);
    },
    [pan, zoom],
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.1, Math.min(5, z - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        setDrag({ active: true, startX: e.clientX - pan.x, startY: e.clientY - pan.y });
      }
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (drag.active) {
        setPan({ x: e.clientX - drag.startX, y: e.clientY - drag.startY });
      }
    },
    [drag],
  );

  const handleMouseUp = useCallback(() => setDrag((d) => ({ ...d, active: false })), []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSearchQuery('');
    setSelectedNode(null);
  }, []);

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-[#1a1a2e] rounded-xl border border-cba-gold/10"
        style={{ height: graphHeight }}
      >
        <Loader2 className="w-10 h-10 text-cba-gold animate-spin mb-3" />
        <p className="text-sm text-gray-400">Loading 2D graph…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-[#1a1a2e] rounded-xl border border-cba-gold/10"
        style={{ height: graphHeight }}
      >
        <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-sm text-red-300 mb-3">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-1.5 bg-cba-gold/10 border border-cba-gold/30 rounded text-sm text-cba-gold hover:bg-cba-gold/20 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (counts.nodes === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-[#1a1a2e] rounded-xl border border-cba-gold/10"
        style={{ height: graphHeight }}
      >
        <Database className="w-12 h-12 text-gray-600 mb-3" />
        <h3 className="text-lg font-semibold text-gray-400 mb-1">No Graph Data</h3>
        <p className="text-sm text-gray-500">
          Index data to Cognee to visualize the knowledge graph.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative bg-[#1a1a2e] rounded-xl border border-cba-gold/10 overflow-hidden"
      style={{ height: graphHeight }}
    >
      {/* Controls */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 p-2 bg-[#1a1a2e]/80 backdrop-blur-sm border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
          <input
            type="text"
            placeholder="Search nodes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 pr-2 py-1 w-44 bg-overlay border border-border rounded text-xs text-gray-200 placeholder:text-gray-500 focus:border-cba-gold/40 focus:outline-none"
          />
        </div>
        <div className="flex-1" />
        <span className="text-[10px] text-gray-500">
          {counts.nodes} nodes &middot; {counts.links} edges
        </span>
        <button
          onClick={handleReset}
          className="p-1.5 rounded hover:bg-overlay-hover text-gray-400 hover:text-primary transition-colors"
          title="Reset view"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onClick={handleCanvasClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Selected node panel */}
      {selectedNode && (
        <div className="absolute top-10 right-2 w-64 bg-[#1a1a2e]/95 border border-cba-gold/20 rounded-lg p-3 z-20 space-y-2 max-h-[70%] overflow-y-auto">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-sm font-semibold text-primary truncate">{selectedNode.name}</h4>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: selectedNode.color + '30', color: selectedNode.color }}
              >
                {selectedNode.type}
              </span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-0.5 rounded hover:bg-overlay-hover text-gray-400"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="text-[10px] text-gray-400 space-y-0.5">
            <div>
              Dataset: <span className="text-gray-300">{selectedNode.dataset}</span>
            </div>
            <div>
              Connections: <span className="text-gray-300">{selectedNode.connections}</span>
            </div>
          </div>
          {Object.keys(selectedNode.properties).length > 0 && (
            <div className="space-y-0.5">
              {Object.entries(selectedNode.properties)
                .slice(0, 8)
                .map(([k, v]) => (
                  <div
                    key={k}
                    className="text-[10px] flex justify-between bg-overlay rounded px-1.5 py-0.5"
                  >
                    <span className="text-gray-500 truncate mr-1">{k}</span>
                    <span className="text-gray-300 truncate">{String(v)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* 2D badge */}
      <div className="absolute bottom-2 left-2 text-[10px] text-gray-600 pointer-events-none select-none">
        2D Fallback &middot; Scroll to zoom &middot; Drag to pan
      </div>
    </div>
  );
}

export default CogneeGraph2DFallback;
