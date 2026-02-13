import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Search, Filter, Loader2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { knowledgeApi } from '../../../api';
import { NodeDetailPanel } from './NodeDetailPanel';

interface KnowledgeGraphExplorerProps {
  datasetName: string;
  ontologyId?: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  neighbors?: Array<{ id: string; label: string; edgeType: string }>;
  properties?: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

const TYPE_COLORS: Record<string, string> = {
  entity: '#FFCC00',
  relationship: '#60a5fa',
  document: '#34d399',
  chunk: '#a78bfa',
  concept: '#f472b6',
  default: '#94a3b8',
};

export function KnowledgeGraphExplorer({ datasetName, ontologyId }: KnowledgeGraphExplorerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());
  const [allTypes, setAllTypes] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const loadGraph = useCallback(async () => {
    if (!datasetName) return;
    setLoading(true);
    setError(null);
    try {
      const data = await knowledgeApi.getGraph(datasetName, { maxNodes: 200, ontologyId });
      const nodes: GraphNode[] = (data.nodes ?? []).map((n: any, i: number) => ({
        id: n.id,
        label: n.label || n.id,
        type: n.type || 'default',
        x: Math.random() * 800 - 400,
        y: Math.random() * 600 - 300,
        vx: 0,
        vy: 0,
        neighbors: n.neighbors,
        properties: n.properties,
      }));
      const edges: GraphEdge[] = (data.edges ?? []).map((e: any) => ({
        source: e.source,
        target: e.target,
        type: e.type || 'related',
      }));
      nodesRef.current = nodes;
      edgesRef.current = edges;

      const types = [...new Set(nodes.map((n) => n.type))];
      setAllTypes(types);
      setTypeFilters(new Set(types));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [datasetName, ontologyId]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // Force-directed layout simulation
  useEffect(() => {
    if (loading || error) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    let iteration = 0;
    const maxIterations = 300;

    const simulate = () => {
      if (!running) return;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      // Cooling factor
      const temp = Math.max(0.1, 1 - iteration / maxIterations);
      const repulsionStrength = 5000 * temp;
      const attractionStrength = 0.01;
      const damping = 0.85;

      // Repulsion (node-node)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsionStrength / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      // Attraction (edges)
      for (const edge of edges) {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) continue;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = dist * attractionStrength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        src.vx += fx;
        src.vy += fy;
        tgt.vx -= fx;
        tgt.vy -= fy;
      }

      // Center gravity
      for (const node of nodes) {
        node.vx -= node.x * 0.001;
        node.vy -= node.y * 0.001;
      }

      // Update positions
      for (const node of nodes) {
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;
      }

      // Draw
      draw(ctx, canvas);
      iteration++;

      if (iteration < maxIterations) {
        animRef.current = requestAnimationFrame(simulate);
      } else {
        // Keep drawing for interactions
        const drawLoop = () => {
          if (!running) return;
          draw(ctx, canvas);
          animRef.current = requestAnimationFrame(drawLoop);
        };
        drawLoop();
      }
    };

    const resizeCanvas = () => {
      const container = containerRef.current;
      if (!container || !canvas) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    simulate();

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [loading, error, typeFilters, searchQuery, selectedNode, zoom, pan]);

  const draw = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const cx = canvas.width / 2 + pan.x;
    const cy = canvas.height / 2 + pan.y;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(zoom, zoom);

    const filteredIds = new Set(
      nodes
        .filter((n) => typeFilters.has(n.type))
        .filter((n) => !searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase()))
        .map((n) => n.id)
    );

    // Draw edges
    ctx.lineWidth = 0.5;
    for (const edge of edges) {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) continue;
      if (!filteredIds.has(src.id) || !filteredIds.has(tgt.id)) continue;

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      if (selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id)) {
        ctx.strokeStyle = 'rgba(255,204,0,0.4)';
        ctx.lineWidth = 1.5;
      }
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.stroke();
      ctx.lineWidth = 0.5;
    }

    // Draw nodes
    for (const node of nodes) {
      if (!filteredIds.has(node.id)) continue;
      const color = TYPE_COLORS[node.type] ?? TYPE_COLORS.default;
      const radius = selectedNode?.id === node.id ? 10 : 6;

      // Glow for selected
      if (selectedNode?.id === node.id) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Label
      if (zoom > 0.6 || selectedNode?.id === node.id) {
        ctx.font = `${Math.max(9, 11 / zoom)}px sans-serif`;
        ctx.fillStyle = selectedNode?.id === node.id ? '#FFCC00' : 'rgba(255,255,255,0.6)';
        ctx.textAlign = 'center';
        ctx.fillText(node.label.slice(0, 20), node.x, node.y + radius + 12);
      }
    }

    ctx.restore();
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - canvas.width / 2 - pan.x) / zoom;
    const my = (e.clientY - rect.top - canvas.height / 2 - pan.y) / zoom;

    const clickedNode = nodesRef.current.find((n) => {
      const dx = n.x - mx;
      const dy = n.y - my;
      return Math.sqrt(dx * dx + dy * dy) < 12;
    });

    setSelectedNode(clickedNode ?? null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0 && !e.shiftKey) return; // left click is for node selection
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => { setDragging(false); };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.2, Math.min(3, z - e.deltaY * 0.001)));
  };

  const handleNodeNavigate = (nodeId: string) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      setPan({ x: -node.x * zoom, y: -node.y * zoom });
    }
  };

  const handleFeedback = async (nodeId: string, feedbackType: string) => {
    try {
      await knowledgeApi.submitFeedback({
        entityId: nodeId,
        entityType: 'node',
        feedbackType,
        userId: 'current-user',
      });
    } catch {
      // silently fail for non-critical feedback
    }
  };

  const toggleTypeFilter = (type: string) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

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
        <p className="text-sm text-red-400">Failed to load graph: {error}</p>
        <button type="button" onClick={loadGraph} className="mt-3 text-xs text-[#FFCC00] hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="w-full pl-9 pr-3 py-2 neu-inset rounded-xl text-sm text-zinc-200 bg-transparent placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FFCC00]/30"
          />
        </div>

        {/* Type Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-4 h-4 text-zinc-500" />
          {allTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleTypeFilter(type)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                typeFilters.has(type)
                  ? 'text-zinc-100 ring-1'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
              style={{
                backgroundColor: typeFilters.has(type) ? `${TYPE_COLORS[type] ?? TYPE_COLORS.default}20` : undefined,
                borderColor: typeFilters.has(type) ? `${TYPE_COLORS[type] ?? TYPE_COLORS.default}40` : undefined,
                color: typeFilters.has(type) ? TYPE_COLORS[type] ?? TYPE_COLORS.default : undefined,
              }}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.2))} className="neu-raised-sm p-1.5 rounded-lg text-zinc-400 hover:text-white">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))} className="neu-raised-sm p-1.5 rounded-lg text-zinc-400 hover:text-white">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="neu-raised-sm p-1.5 rounded-lg text-zinc-400 hover:text-white">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Graph + Detail */}
      <div className="flex gap-4">
        <div ref={containerRef} className="flex-1 neu-inset rounded-xl overflow-hidden" style={{ height: 500 }}>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onContextMenu={(e) => { e.preventDefault(); handleMouseDown(e); }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-full cursor-crosshair"
          />
        </div>
        {selectedNode && (
          <div className="w-72 shrink-0 hidden lg:block">
            <NodeDetailPanel
              node={selectedNode}
              onNavigate={handleNodeNavigate}
              onFeedback={handleFeedback}
              onClose={() => setSelectedNode(null)}
            />
          </div>
        )}
      </div>

      {/* Node count info */}
      <p className="text-[10px] text-zinc-600 text-right">
        {nodesRef.current.length} nodes, {edgesRef.current.length} edges | Zoom: {(zoom * 100).toFixed(0)}%
      </p>
    </div>
  );
}
