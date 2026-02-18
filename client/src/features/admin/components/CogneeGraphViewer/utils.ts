import type { ForceGraph3DInstance } from '3d-force-graph';
import type { GraphNode, GraphLink, RawGraphResponse, RawNode, RawLink } from './types.js';
import { NODE_COLORS, EDGE_COLORS, MAX_NODES, MAX_LINKS } from './constants.js';

export async function adminFetch(path: string): Promise<unknown> {
  const token = localStorage.getItem('admin_token');
  const BASE_URL = import.meta.env.VITE_API_URL || '';
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data: unknown = await res.json();
  return data;
}

export function nodeColor(type: string): string {
  return NODE_COLORS[type.toLowerCase()] ?? NODE_COLORS.default;
}

export function edgeColor(type: string): string {
  return EDGE_COLORS[type.toLowerCase()] ?? EDGE_COLORS.default;
}

export function sourceId(link: GraphLink): string {
  return typeof link.source === 'object' ? (link.source as GraphNode).id : String(link.source);
}

export function targetId(link: GraphLink): string {
  return typeof link.target === 'object' ? (link.target as GraphNode).id : String(link.target);
}

export function transformToGraphData(raw: RawGraphResponse): {
  nodes: GraphNode[];
  links: GraphLink[];
} {
  const rawNodes: RawNode[] = raw?.nodes ?? raw?.data?.nodes ?? [];
  const rawLinks: RawLink[] =
    raw?.links ?? raw?.edges ?? raw?.data?.links ?? raw?.data?.edges ?? [];

  const nodes: GraphNode[] = rawNodes.slice(0, MAX_NODES).map((n: RawNode) => {
    const type = (n.type || n.entity_type || 'default').toLowerCase();
    const connections = Number(n.connections ?? n.degree ?? 0);
    return {
      id: String(n.id),
      name: n.name ?? n.label ?? String(n.id),
      type,
      dataset: n.dataset ?? 'unknown',
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

export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

/** Safely remove all child nodes from an element (no innerHTML). */
export function clearChildren(el: HTMLElement): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

export function zoomToNode(graph: ForceGraph3DInstance, node: GraphNode): void {
  const distance = 100;
  const n = node as GraphNode & { x?: number; y?: number; z?: number };
  const x = n.x ?? 0;
  const y = n.y ?? 0;
  const z = n.z ?? 0;
  const hypot = Math.hypot(x, y, z) || 1;
  const distRatio = 1 + distance / hypot;
  graph.cameraPosition({ x: x * distRatio, y: y * distRatio, z: z * distRatio }, { x, y, z }, 1000);
}
