/**
 * Cognee Graph Visualization — Traversal & Filter Operations
 *
 * Standalone functions for pruneNodes, getSubgraph, getNodeNeighbors, searchNodes.
 */

import { cogneeClient } from '../cognee_client.js';
import type { GraphVisualizationData, PruneCriteria, GraphNode, GraphEdge } from './types.js';
import {
  transformCogneeGraph,
  calculateNodeSizes,
  generateInitialPositions,
  buildMetadata,
} from './graph-mutations.js';

/** Return a filtered (pruned) view of the graph without modifying Cognee data. */
export async function pruneGraphNodes(
  datasetName: string,
  criteria: PruneCriteria,
  userId?: string,
): Promise<GraphVisualizationData> {
  const rawData = await cogneeClient.getDatasetGraph(datasetName, userId);
  let { nodes, edges } = transformCogneeGraph(rawData);
  nodes = calculateNodeSizes(nodes, edges);

  const totalNodes = nodes.length;
  const totalEdges = edges.length;

  const degreeMap = new Map<string, number>();
  for (const n of nodes) degreeMap.set(n.id, 0);
  for (const e of edges) {
    degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
  }

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

  const keptIds = new Set(nodes.map((n) => n.id));
  edges = edges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target));

  if (criteria.edgeTypes && criteria.edgeTypes.length > 0) {
    const allowedEdges = new Set(criteria.edgeTypes.map((t) => t.toLowerCase()));
    edges = edges.filter((e) => allowedEdges.has(e.type.toLowerCase()));
  }

  nodes = generateInitialPositions(nodes);
  const { nodeTypes, edgeTypes } = buildMetadata(nodes, edges);

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

/** BFS from a root node to a given depth, returning the connected subgraph. */
export async function getGraphSubgraph(
  datasetName: string,
  rootNodeId: string,
  depth: number = 2,
  userId?: string,
): Promise<GraphVisualizationData> {
  const rawData = await cogneeClient.getDatasetGraph(datasetName, userId);
  const { nodes: allNodes, edges: allEdges } = transformCogneeGraph(rawData);

  const adjacency = new Map<string, Array<{ neighborId: string; edgeIdx: number }>>();
  for (const n of allNodes) adjacency.set(n.id, []);
  for (let i = 0; i < allEdges.length; i++) {
    const e = allEdges[i];
    adjacency.get(e.source)?.push({ neighborId: e.target, edgeIdx: i });
    adjacency.get(e.target)?.push({ neighborId: e.source, edgeIdx: i });
  }

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

  nodes = calculateNodeSizes(nodes, edges);
  nodes = generateInitialPositions(nodes);
  const { nodeTypes, edgeTypes } = buildMetadata(nodes, edges);

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

/** Get immediate neighbors (1-hop) of a node with their connecting edges. */
export async function getGraphNodeNeighbors(
  datasetName: string,
  nodeId: string,
  userId?: string,
): Promise<{ node: GraphNode | null; neighbors: GraphNode[]; edges: GraphEdge[] }> {
  const rawData = await cogneeClient.getDatasetGraph(datasetName, userId);
  const { nodes: allNodes, edges: allEdges } = transformCogneeGraph(rawData);

  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  const centerNode = nodeMap.get(nodeId) ?? null;
  if (!centerNode) return { node: null, neighbors: [], edges: [] };

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

/** Full-text search across node labels and properties. */
export async function searchGraphNodes(
  datasetName: string,
  query: string,
  limit: number = 20,
  userId?: string,
): Promise<GraphNode[]> {
  const rawData = await cogneeClient.getDatasetGraph(datasetName, userId);
  const { nodes } = transformCogneeGraph(rawData);

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
