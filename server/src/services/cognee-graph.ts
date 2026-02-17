/**
 * Cognee Graph Visualization Data Service
 *
 * Transforms raw Cognee knowledge graph data into 3D visualization-ready format.
 * Provides graph stats, pruning, subgraph extraction, and node search.
 *
 * Depends on:
 *  - cognee_client.ts for raw graph fetching
 *  - cognee-ontologies.ts for node-type color mapping
 */

import { cogneeClient } from './cognee_client.js';
import { CogneeOntologyService } from './cognee-ontologies.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface GraphDataOptions {
  maxNodes?: number;
  ontologyId?: string;
  nodeFilter?: string;
  depthLimit?: number;
  includeMetadata?: boolean;
}

export interface GraphVisualizationData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    nodeTypes: Record<string, number>;
    edgeTypes: Record<string, number>;
    truncated: boolean;
  };
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  color: string;
  size: number;
  properties: Record<string, unknown>;
  position?: { x: number; y: number; z: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
  weight: number;
  properties?: Record<string, unknown>;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
  connectedComponents: number;
  nodeTypeDistribution: Record<string, number>;
  edgeTypeDistribution: Record<string, number>;
  topConnectedNodes: Array<{ id: string; label: string; degree: number }>;
}

export interface PruneCriteria {
  minDegree?: number;
  nodeTypes?: string[];
  excludeNodeTypes?: string[];
  edgeTypes?: string[];
  maxAge?: number;
  searchQuery?: string;
}

// ============================================================================
// DEFAULT COLORS
// ============================================================================

const DEFAULT_NODE_COLORS: Record<string, string> = {
  default: '#888888',
  Account: '#FFCC00',
  Transaction: '#4CAF50',
  Merchant: '#2196F3',
  Category: '#9C27B0',
  TaxEntity: '#F44336',
  Person: '#00BCD4',
  Business: '#3F51B5',
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class CogneeGraphService {
  private ontologyService: CogneeOntologyService;

  constructor() {
    this.ontologyService = new CogneeOntologyService();
  }

  /**
   * Fetch graph data from Cognee and transform it for 3D visualization.
   * Applies ontology colors, calculates node sizes by degree, and generates
   * initial positions on a sphere for 3D force-layout seeding.
   */
  async getGraphData(
    datasetName: string,
    options: GraphDataOptions = {},
    userId?: string,
  ): Promise<GraphVisualizationData> {
    const { maxNodes = 500, ontologyId, nodeFilter, includeMetadata = true } = options;

    // Fetch raw graph from Cognee
    const rawData = await cogneeClient.getDatasetGraph(datasetName, userId);

    // Transform to typed nodes/edges
    let { nodes, edges } = this._transformCogneeGraph(rawData);

    // Apply ontology colors if an ontology is specified
    if (ontologyId) {
      const ontology = await this.ontologyService.getOntology(ontologyId);
      if (ontology) {
        nodes = this._applyOntologyColors(nodes, ontology);
      }
    }

    // Apply node type filter
    if (nodeFilter) {
      const filterTypes = new Set(nodeFilter.split(',').map((t) => t.trim().toLowerCase()));
      const filteredNodes = nodes.filter((n) => filterTypes.has(n.type.toLowerCase()));
      const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
      nodes = filteredNodes;
      edges = edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));
    }

    // Calculate node sizes based on connectivity
    nodes = this._calculateNodeSizes(nodes, edges);

    // Track whether we truncated
    const totalNodes = nodes.length;
    const totalEdges = edges.length;
    const truncated = nodes.length > maxNodes;

    // Truncate to maxNodes — keep the most-connected nodes
    if (truncated) {
      nodes.sort((a, b) => b.size - a.size);
      nodes = nodes.slice(0, maxNodes);
      const keptIds = new Set(nodes.map((n) => n.id));
      edges = edges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target));
    }

    // Generate initial 3D positions (sphere distribution)
    nodes = this._generateInitialPositions(nodes);

    // Build metadata
    const nodeTypes: Record<string, number> = {};
    for (const n of nodes) {
      nodeTypes[n.type] = (nodeTypes[n.type] ?? 0) + 1;
    }
    const edgeTypes: Record<string, number> = {};
    for (const e of edges) {
      edgeTypes[e.type] = (edgeTypes[e.type] ?? 0) + 1;
    }

    // Strip properties if metadata not requested
    if (!includeMetadata) {
      for (const n of nodes) n.properties = {};
      for (const e of edges) delete e.properties;
    }

    return {
      nodes,
      edges,
      metadata: {
        totalNodes,
        totalEdges,
        nodeTypes,
        edgeTypes,
        truncated,
      },
    };
  }

  /**
   * Calculate graph statistics: density, degree distribution, components, etc.
   */
  async getGraphStats(datasetName: string, userId?: string): Promise<GraphStats> {
    const rawData = await cogneeClient.getDatasetGraph(datasetName, userId);
    const { nodes, edges } = this._transformCogneeGraph(rawData);

    const nodeCount = nodes.length;
    const edgeCount = edges.length;

    // Degree map
    const degreeMap = new Map<string, number>();
    for (const n of nodes) degreeMap.set(n.id, 0);
    for (const e of edges) {
      degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
      degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
    }

    const averageDegree =
      nodeCount > 0 ? Array.from(degreeMap.values()).reduce((sum, d) => sum + d, 0) / nodeCount : 0;

    // Node type distribution
    const nodeTypeDistribution: Record<string, number> = {};
    for (const n of nodes) {
      nodeTypeDistribution[n.type] = (nodeTypeDistribution[n.type] ?? 0) + 1;
    }

    // Edge type distribution
    const edgeTypeDistribution: Record<string, number> = {};
    for (const e of edges) {
      edgeTypeDistribution[e.type] = (edgeTypeDistribution[e.type] ?? 0) + 1;
    }

    // Top connected nodes (top 10)
    const sortedByDegree = Array.from(degreeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const topConnectedNodes = sortedByDegree.map(([id, degree]) => ({
      id,
      label: nodeMap.get(id)?.label ?? id,
      degree,
    }));

    return {
      nodeCount,
      edgeCount,
      density: this._calculateDensity(nodeCount, edgeCount),
      averageDegree,
      connectedComponents: this._findConnectedComponents(nodes, edges),
      nodeTypeDistribution,
      edgeTypeDistribution,
      topConnectedNodes,
    };
  }

  /**
   * Return a filtered (pruned) view of the graph without modifying Cognee data.
   * Useful for focusing on high-degree nodes, specific types, or text search.
   */
  async pruneNodes(
    datasetName: string,
    criteria: PruneCriteria,
    userId?: string,
  ): Promise<GraphVisualizationData> {
    const rawData = await cogneeClient.getDatasetGraph(datasetName, userId);
    let { nodes, edges } = this._transformCogneeGraph(rawData);
    nodes = this._calculateNodeSizes(nodes, edges);

    const totalNodes = nodes.length;
    const totalEdges = edges.length;

    // Build degree map for minDegree filter
    const degreeMap = new Map<string, number>();
    for (const n of nodes) degreeMap.set(n.id, 0);
    for (const e of edges) {
      degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
      degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
    }

    // Apply node-level filters
    if (criteria.minDegree !== undefined) {
      nodes = nodes.filter((n) => (degreeMap.get(n.id) ?? 0) >= criteria.minDegree!);
    }
    if (criteria.nodeTypes && criteria.nodeTypes.length > 0) {
      const allowed = new Set(criteria.nodeTypes.map((t) => t.toLowerCase()));
      nodes = nodes.filter((n) => allowed.has(n.type.toLowerCase()));
    }
    if (criteria.excludeNodeTypes && criteria.excludeNodeTypes.length > 0) {
      const excluded = new Set(criteria.excludeNodeTypes.map((t) => t.toLowerCase()));
      nodes = nodes.filter((n) => !excluded.has(n.type.toLowerCase()));
    }
    if (criteria.searchQuery) {
      const query = criteria.searchQuery.toLowerCase();
      nodes = nodes.filter(
        (n) =>
          n.label.toLowerCase().includes(query) ||
          n.type.toLowerCase().includes(query) ||
          JSON.stringify(n.properties).toLowerCase().includes(query),
      );
    }
    if (criteria.maxAge !== undefined) {
      const cutoff = Date.now() - criteria.maxAge * 86400_000;
      nodes = nodes.filter((n) => {
        const created = n.properties.created_at ?? n.properties.date;
        if (typeof created === 'string') {
          const ts = new Date(created).getTime();
          return !isNaN(ts) ? ts >= cutoff : true;
        }
        return true;
      });
    }

    // Rebuild edge set for surviving nodes
    const keptIds = new Set(nodes.map((n) => n.id));
    edges = edges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target));

    // Apply edge type filter
    if (criteria.edgeTypes && criteria.edgeTypes.length > 0) {
      const allowedEdges = new Set(criteria.edgeTypes.map((t) => t.toLowerCase()));
      edges = edges.filter((e) => allowedEdges.has(e.type.toLowerCase()));
    }

    nodes = this._generateInitialPositions(nodes);

    const nodeTypes: Record<string, number> = {};
    for (const n of nodes) nodeTypes[n.type] = (nodeTypes[n.type] ?? 0) + 1;
    const edgeTypes: Record<string, number> = {};
    for (const e of edges) edgeTypes[e.type] = (edgeTypes[e.type] ?? 0) + 1;

    return {
      nodes,
      edges,
      metadata: {
        totalNodes,
        totalEdges,
        nodeTypes,
        edgeTypes,
        truncated: nodes.length < totalNodes,
      },
    };
  }

  /**
   * BFS from a root node to a given depth, returning the connected subgraph.
   * Useful for exploring neighborhood around a selected node in the 3D view.
   */
  async getSubgraph(
    datasetName: string,
    rootNodeId: string,
    depth: number = 2,
    userId?: string,
  ): Promise<GraphVisualizationData> {
    const rawData = await cogneeClient.getDatasetGraph(datasetName, userId);
    const { nodes: allNodes, edges: allEdges } = this._transformCogneeGraph(rawData);

    // Build adjacency list
    const adjacency = new Map<string, Array<{ neighborId: string; edgeIdx: number }>>();
    for (const n of allNodes) adjacency.set(n.id, []);
    for (let i = 0; i < allEdges.length; i++) {
      const e = allEdges[i];
      adjacency.get(e.source)?.push({ neighborId: e.target, edgeIdx: i });
      adjacency.get(e.target)?.push({ neighborId: e.source, edgeIdx: i });
    }

    // BFS
    const visited = new Set<string>();
    const visitedEdges = new Set<number>();
    const queue: Array<{ nodeId: string; level: number }> = [{ nodeId: rootNodeId, level: 0 }];
    visited.add(rootNodeId);

    while (queue.length > 0) {
      const { nodeId, level } = queue.shift()!;
      if (level >= depth) continue;

      const neighbors = adjacency.get(nodeId) ?? [];
      for (const { neighborId, edgeIdx } of neighbors) {
        visitedEdges.add(edgeIdx);
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({ nodeId: neighborId, level: level + 1 });
        }
      }
    }

    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    let nodes = Array.from(visited)
      .map((id) => nodeMap.get(id))
      .filter((n): n is GraphNode => n !== undefined);
    const edges = Array.from(visitedEdges)
      .map((idx) => allEdges[idx])
      .filter((e) => visited.has(e.source) && visited.has(e.target));

    nodes = this._calculateNodeSizes(nodes, edges);
    nodes = this._generateInitialPositions(nodes);

    const nodeTypes: Record<string, number> = {};
    for (const n of nodes) nodeTypes[n.type] = (nodeTypes[n.type] ?? 0) + 1;
    const edgeTypes: Record<string, number> = {};
    for (const e of edges) edgeTypes[e.type] = (edgeTypes[e.type] ?? 0) + 1;

    return {
      nodes,
      edges,
      metadata: {
        totalNodes: allNodes.length,
        totalEdges: allEdges.length,
        nodeTypes,
        edgeTypes,
        truncated: nodes.length < allNodes.length,
      },
    };
  }

  /**
   * Get immediate neighbors (1-hop) of a node with their connecting edges.
   */
  async getNodeNeighbors(
    datasetName: string,
    nodeId: string,
    userId?: string,
  ): Promise<{ node: GraphNode | null; neighbors: GraphNode[]; edges: GraphEdge[] }> {
    const rawData = await cogneeClient.getDatasetGraph(datasetName, userId);
    const { nodes: allNodes, edges: allEdges } = this._transformCogneeGraph(rawData);

    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    const centerNode = nodeMap.get(nodeId) ?? null;

    if (!centerNode) {
      return { node: null, neighbors: [], edges: [] };
    }

    const neighborIds = new Set<string>();
    const connectedEdges: GraphEdge[] = [];

    for (const e of allEdges) {
      if (e.source === nodeId) {
        neighborIds.add(e.target);
        connectedEdges.push(e);
      } else if (e.target === nodeId) {
        neighborIds.add(e.source);
        connectedEdges.push(e);
      }
    }

    const neighbors = Array.from(neighborIds)
      .map((id) => nodeMap.get(id))
      .filter((n): n is GraphNode => n !== undefined);

    return { node: centerNode, neighbors, edges: connectedEdges };
  }

  /**
   * Full-text search across node labels and properties.
   * Case-insensitive substring match.
   */
  async searchNodes(
    datasetName: string,
    query: string,
    limit: number = 20,
    userId?: string,
  ): Promise<GraphNode[]> {
    const rawData = await cogneeClient.getDatasetGraph(datasetName, userId);
    const { nodes } = this._transformCogneeGraph(rawData);

    const q = query.toLowerCase();
    const matches: GraphNode[] = [];

    for (const node of nodes) {
      if (matches.length >= limit) break;

      if (
        node.label.toLowerCase().includes(q) ||
        node.id.toLowerCase().includes(q) ||
        node.type.toLowerCase().includes(q) ||
        JSON.stringify(node.properties).toLowerCase().includes(q)
      ) {
        matches.push(node);
      }
    }

    return matches;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Transform Cognee's raw graph response into typed GraphNode/GraphEdge arrays.
   * Handles various field naming conventions from the Cognee API.
   */
  _transformCogneeGraph(rawData: { nodes: unknown[]; edges: unknown[] }): {
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

      // Collect remaining properties
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

      // Collect remaining properties
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
  _applyOntologyColors(
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
  _calculateNodeSizes(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
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
  _generateInitialPositions(nodes: GraphNode[]): GraphNode[] {
    const count = nodes.length;
    if (count === 0) return nodes;

    const radius = Math.max(50, Math.sqrt(count) * 10);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~2.399 radians

    return nodes.map((n, i) => {
      // Fibonacci sphere: even distribution without clustering at poles
      const y = 1 - (i / (count - 1 || 1)) * 2; // Range [-1, 1]
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
  _calculateDensity(nodeCount: number, edgeCount: number): number {
    if (nodeCount <= 1) return 0;
    return edgeCount / (nodeCount * (nodeCount - 1));
  }

  /**
   * Count connected components using BFS over the undirected graph.
   */
  _findConnectedComponents(nodes: GraphNode[], edges: GraphEdge[]): number {
    if (nodes.length === 0) return 0;

    // Build undirected adjacency list
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

      // BFS from this unvisited node
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
}

export const cogneeGraphService = new CogneeGraphService();
