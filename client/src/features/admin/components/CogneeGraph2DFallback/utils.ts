import { NODE_COLORS, EDGE_COLORS, MAX_NODES } from './constants';
import type { GraphNode, GraphLink, RawNode2D, RawLink2D, RawGraphResponse2D } from './types';

export const adminFetch = async (path: string): Promise<unknown> => {
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

export function getNodeColor(type: string): string {
  return NODE_COLORS[type.toLowerCase()] ?? NODE_COLORS.default;
}

export function getEdgeColor(type: string): string {
  return EDGE_COLORS[type.toLowerCase()] ?? EDGE_COLORS.default;
}

export function transformData(raw: RawGraphResponse2D): { nodes: GraphNode[]; links: GraphLink[] } {
  const rawNodes: RawNode2D[] = raw?.nodes ?? raw?.data?.nodes ?? [];
  const rawLinks: RawLink2D[] =
    raw?.links ?? raw?.edges ?? raw?.data?.links ?? raw?.data?.edges ?? [];

  const nodes: GraphNode[] = rawNodes.slice(0, MAX_NODES).map((n: RawNode2D) => {
    const type = (n.type || n.entity_type || 'default').toLowerCase();
    const connections = Number(n.connections ?? n.degree ?? 0);
    return {
      id: String(n.id),
      name: n.name || n.label || String(n.id),
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
    .filter((l: RawLink2D) => nodeIds.has(String(l.source)) && nodeIds.has(String(l.target)))
    .slice(0, 1500)
    .map((l: RawLink2D) => {
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
