import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Search, RotateCcw, Loader2, AlertTriangle, Database, X, ExternalLink } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (mirror 3D viewer)
// ---------------------------------------------------------------------------

interface CogneeGraph2DFallbackProps {
  datasetName?: string;
  initialFocus?: string;
  height?: number;
  width?: number;
}

interface GraphNode {
  id: string;
  name: string;
  type: string;
  dataset: string;
  properties: Record<string, unknown>;
  connections: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Colors
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

const MAX_NODES = 500;

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

function getNodeColor(type: string): string {
  return NODE_COLORS[type.toLowerCase()] ?? NODE_COLORS.default;
}

function getEdgeColor(type: string): string {
  return EDGE_COLORS[type.toLowerCase()] ?? EDGE_COLORS.default;
}

function transformData(raw: any): { nodes: GraphNode[]; links: GraphLink[] } {
  const rawNodes: any[] = raw?.nodes ?? raw?.data?.nodes ?? [];
  const rawLinks: any[] = raw?.links ?? raw?.edges ?? raw?.data?.links ?? raw?.data?.edges ?? [];

  const nodes: GraphNode[] = rawNodes.slice(0, MAX_NODES).map((n: any) => {
    const type = (n.type || n.entity_type || 'default').toLowerCase();
    const connections = Number(n.connections ?? n.degree ?? 0);
    return {
      id: String(n.id),
      name: n.name || n.label || n.id,
      type,
      dataset: n.dataset || 'unknown',
      properties: n.properties ?? {},
      connections,
      x: Math.random() * 800 - 400,
      y: Math.random() * 600 - 300,
      vx: 0,
      vy: 0,
      color: getNodeColor(type),
      radius: Math.max(4, Math.min(connections * 2, 16)),
    };
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const links: GraphLink[] = rawLinks
    .filter((l: any) => nodeIds.has(String(l.source)) && nodeIds.has(String(l.target)))
    .slice(0, 1500)
    .map((l: any) => {
      const type = (l.type || l.relationship || 'related_to').toLowerCase();
      return {
        source: String(l.source),
        target: String(l.target),
        type,
        color: getEdgeColor(type),
      };
    });

  return { nodes, links };
}

// ---------------------------------------------------------------------------
// Simple Force Simulation
// ---------------------------------------------------------------------------

function forceStep(nodes: GraphNode[], links: GraphLink[], alpha: number) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Repulsion
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (alpha * 200) / (dist * dist);
      dx *= force;
      dy *= force;
      a.vx -= dx;
      a.vy -= dy;
      b.vx += dx;
      b.vy += dy;
    }
  }

  // Attraction via links
  for (const link of links) {
    const a = nodeMap.get(link.source);
    const b = nodeMap.get(link.target);
    if (!a || !b) continue;
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = (dist - 80) * alpha * 0.005;
    dx = (dx / dist) * force;
    dy = (dy / dist) * force;
    a.vx += dx;
    a.vy += dy;
    b.vx -= dx;
    b.vy -= dy;
  }

  // Center gravity
  for (const node of nodes) {
    node.vx -= node.x * alpha * 0.001;
    node.vy -= node.y * alpha * 0.001;
  }

  // Apply + dampen
  for (const node of nodes) {
    node.vx *= 0.6;
    node.vy *= 0.6;
    node.x += node.vx;
    node.y += node.vy;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CogneeGraph2DFallback({
  datasetName,
  height: propHeight,
  width: propWidth,
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
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [nodeCount, setNodeCount] = useState(0);
  const [linkCount, setLinkCount] = useState(0);

  const graphHeight = propHeight ?? Math.max(400, window.innerHeight - 200);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let raw: any;
      if (datasetName) {
        raw = await adminFetch(`/api/admin/cognee/datasets/${encodeURIComponent(datasetName)}`);
      } else {
        raw = await adminFetch('/api/admin/cognee/graph/stats');
      }
      const { nodes, links } = transformData(raw);
      nodesRef.current = nodes;
      linksRef.current = links;
      setNodeCount(nodes.length);
      setLinkCount(links.length);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load graph');
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
    let frame = 0;

    const render = () => {
      const nodes = nodesRef.current;
      const links = linksRef.current;
      const w = canvas.width;
      const h = canvas.height;

      // Force simulation (decay alpha over time)
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

        // Labels for larger / selected nodes
        if (node.radius > 6 || isSelected || isMatch) {
          ctx.fillStyle = isDimmed ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.8)';
          ctx.font = `${Math.max(8, node.radius * 0.8)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(node.name, node.x, node.y + node.radius + 10);
        }
      }

      ctx.restore();

      frame++;
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

  // Mouse interaction
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
        setDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) {
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      }
    },
    [dragging, dragStart],
  );

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSearchQuery('');
    setSelectedNode(null);
  }, []);

  // Render
  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-[#1a1a2e] rounded-xl border border-[#FFCC00]/10"
        style={{ height: graphHeight }}
      >
        <Loader2 className="w-10 h-10 text-[#FFCC00] animate-spin mb-3" />
        <p className="text-sm text-gray-400">Loading 2D graph…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-[#1a1a2e] rounded-xl border border-[#FFCC00]/10"
        style={{ height: graphHeight }}
      >
        <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-sm text-red-300 mb-3">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-1.5 bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded text-sm text-[#FFCC00] hover:bg-[#FFCC00]/20 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (nodeCount === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-[#1a1a2e] rounded-xl border border-[#FFCC00]/10"
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
      className="relative bg-[#1a1a2e] rounded-xl border border-[#FFCC00]/10 overflow-hidden"
      style={{ height: graphHeight }}
    >
      {/* Controls */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 p-2 bg-[#1a1a2e]/80 backdrop-blur-sm border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
          <input
            type="text"
            placeholder="Search nodes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 pr-2 py-1 w-44 bg-white/5 border border-white/10 rounded text-xs text-gray-200 placeholder:text-gray-500 focus:border-[#FFCC00]/40 focus:outline-none"
          />
        </div>
        <div className="flex-1" />
        <span className="text-[10px] text-gray-500">
          {nodeCount} nodes &middot; {linkCount} edges
        </span>
        <button
          onClick={handleReset}
          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
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
        <div className="absolute top-10 right-2 w-64 bg-[#1a1a2e]/95 border border-[#FFCC00]/20 rounded-lg p-3 z-20 space-y-2 max-h-[70%] overflow-y-auto">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-sm font-semibold text-white truncate">{selectedNode.name}</h4>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: selectedNode.color + '30', color: selectedNode.color }}
              >
                {selectedNode.type}
              </span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-0.5 rounded hover:bg-white/10 text-gray-400"
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
                    className="text-[10px] flex justify-between bg-white/5 rounded px-1.5 py-0.5"
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
