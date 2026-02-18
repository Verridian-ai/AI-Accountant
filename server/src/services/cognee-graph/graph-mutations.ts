/**
 * Cognee Graph Visualization — Mutation / Transformation Helpers
 *
 * Pure functions for transforming, sizing, positioning, and analyzing graph data.
 */

import type { GraphNode, GraphEdge } from './types.js';
import { DEFAULT_NODE_COLORS } from './types.js';

/**
 * Transform Cognee's raw graph response into typed GraphNode/GraphEdge arrays.
 * Handles various field naming conventions from the Cognee API.
 */
export function transformCogneeGraph(rawData: { nodes: unknown[]; edges: unknown[] }): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const nodes: GraphNode[] = (rawData.nodes ?? []).map((raw: unknown, idx: number) => {
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

    const id = String(obj.id ?? obj.node_id ?? `node-${idx}`);
    const label = String(obj.label ?? obj.name ?? obj.text ?? obj.title ?? id);
    const type = String(obj.type ?? obj.node_type ?? obj.category ?? 'default');
    const color =
      typeof obj.color === 'string'
        ? obj.color
        : (DEFAULT_NODE_COLORS[type] ?? DEFAULT_NODE_COLORS.default);

    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (
        ![
          'id',
          'node_id',
          'label',
          'name',
          'text',
          'title',
          'type',
          'node_type',
          'category',
          'color',
        ].includes(key)
      ) {
        properties[key] = value;
      }
    }

    return { id, label, type, color, size: 1, properties };
  });

  const edges: GraphEdge[] = (rawData.edges ?? []).map((raw: unknown, idx: number) => {
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

    const id = String(obj.id ?? obj.edge_id ?? `edge-${idx}`);
    const source = String(obj.source ?? obj.from ?? obj.source_id ?? '');
    const target = String(obj.target ?? obj.to ?? obj.target_id ?? '');
    const label = String(
      obj.label ?? obj.relationship ?? obj.type ?? obj.edge_type ?? 'RELATED_TO',
    );
    const type = String(obj.type ?? obj.edge_type ?? obj.relationship ?? label);
    const weight = typeof obj.weight === 'number' ? obj.weight : 1;

    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (
        ![
          'id',
          'edge_id',
          'source',
          'from',
          'source_id',
          'target',
          'to',
          'target_id',
          'label',
          'relationship',
          'type',
          'edge_type',
          'weight',
        ].includes(key)
      ) {
        properties[key] = value;
      }
    }

    return {
      id,
      source,
      target,
      label,
      type,
      weight,
      properties: Object.keys(properties).length > 0 ? properties : undefined,
    };
  });

  return { nodes, edges };
}

/**
 * Apply ontology-defined colors to nodes based on their type.
 * Falls back to DEFAULT_NODE_COLORS for types not in the ontology.
 */
export function applyOntologyColors(
  nodes: GraphNode[],
  ontology: { nodeTypes: string } | Record<string, unknown>,
): GraphNode[] {
  let nodeTypesDef: Array<{ name: string; color?: string }>;
  try {
    const raw =
      typeof (ontology as Record<string, unknown>).nodeTypes === 'string'
        ? JSON.parse((ontology as Record<string, unknown>).nodeTypes as string)
        : (ontology as Record<string, unknown>).nodeTypes;
    nodeTypesDef = Array.isArray(raw) ? raw : [];
  } catch {
    nodeTypesDef = [];
  }

  const colorMap = new Map<string, string>();
  for (const nt of nodeTypesDef) {
    if (nt.color) {
      colorMap.set(nt.name, nt.color);
    }
  }

  return nodes.map((n) => ({
    ...n,
    color: colorMap.get(n.type) ?? DEFAULT_NODE_COLORS[n.type] ?? DEFAULT_NODE_COLORS.default,
  }));
}

/**
 * Size nodes by their connection count (degree centrality).
 * Scales linearly from 1 (no connections) to 10 (most connections).
 */
export function calculateNodeSizes(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const degreeMap = new Map<string, number>();
  for (const n of nodes) degreeMap.set(n.id, 0);
  for (const e of edges) {
    degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
  }

  const degrees = Array.from(degreeMap.values());
  const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0;

  return nodes.map((n) => ({
    ...n,
    size: maxDegree > 0 ? 1 + ((degreeMap.get(n.id) ?? 0) / maxDegree) * 9 : 1,
  }));
}

/**
 * Distribute nodes on the surface of a sphere for initial 3D layout seeding.
 * Uses the Fibonacci sphere algorithm for even distribution.
 */
export function generateInitialPositions(nodes: GraphNode[]): GraphNode[] {
  const count = nodes.length;
  if (count === 0) return nodes;

  const radius = Math.max(50, Math.sqrt(count) * 10);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  return nodes.map((n, i) => {
    const y = 1 - (i / (count - 1 || 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;

    return {
      ...n,
      position: {
        x: Math.cos(theta) * radiusAtY * radius,
        y: y * radius,
        z: Math.sin(theta) * radiusAtY * radius,
      },
    };
  });
}

/**
 * Graph density = |E| / (|V| * (|V| - 1)) for directed graphs.
 * Returns 0 for trivial graphs (0 or 1 node).
 */
export function calculateDensity(nodeCount: number, edgeCount: number): number {
  if (nodeCount <= 1) return 0;
  return edgeCount / (nodeCount * (nodeCount - 1));
}

/**
 * Count connected components using BFS over the undirected graph.
 */
export function findConnectedComponents(nodes: GraphNode[], edges: GraphEdge[]): number {
  if (nodes.length === 0) return 0;

  const adjacency = new Map<string, string[]>();
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) {
    adjacency.get(e.source)?.push(e.target);
    adjacency.get(e.target)?.push(e.source);
  }

  const visited = new Set<string>();
  let components = 0;

  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    components++;

    const queue = [node.id];
    visited.add(node.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  return components;
}

/**
 * Build node-type and edge-type distribution metadata from graph data.
 */
export function buildMetadata(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { nodeTypes: Record<string, number>; edgeTypes: Record<string, number> } {
  const nodeTypes: Record<string, number> = {};
  for (const n of nodes) {
    nodeTypes[n.type] = (nodeTypes[n.type] ?? 0) + 1;
  }
  const edgeTypes: Record<string, number> = {};
  for (const e of edges) {
    edgeTypes[e.type] = (edgeTypes[e.type] ?? 0) + 1;
  }
  return { nodeTypes, edgeTypes };
}
