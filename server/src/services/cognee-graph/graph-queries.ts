/**
 * Cognee Graph Visualization — Query Operations
 *
 * Read-only graph operations: getGraphData, getGraphStats, pruneNodes,
 * getSubgraph, getNodeNeighbors, searchNodes.
 */

import { cogneeClient } from '../cognee_client.js';
import { CogneeOntologyService } from '../cognee-ontologies.js';
import type {
  GraphDataOptions,
  GraphVisualizationData,
  GraphStats,
  PruneCriteria,
  GraphNode,
  GraphEdge,
} from './types.js';
import {
  transformCogneeGraph,
  applyOntologyColors,
  calculateNodeSizes,
  generateInitialPositions,
  calculateDensity,
  findConnectedComponents,
  buildMetadata,
} from './graph-mutations.js';
import {
  pruneGraphNodes,
  getGraphSubgraph,
  getGraphNodeNeighbors,
  searchGraphNodes,
} from './graph-traversal.js';

export class CogneeGraphService {
  private ontologyService: CogneeOntologyService;

  constructor() {
    this.ontologyService = new CogneeOntologyService();
  }

  /** Fetch graph data from Cognee and transform it for 3D visualization. */
  async getGraphData(
    datasetName: string,
    options: GraphDataOptions = {},
    userId?: string,
  ): Promise<GraphVisualizationData> {
    const { maxNodes = 500, ontologyId, nodeFilter, includeMetadata = true } = options;

    const rawData = await cogneeClient.getDatasetGraph(datasetName, userId);
    let { nodes, edges } = transformCogneeGraph(rawData);

    if (ontologyId) {
      const ontology = await this.ontologyService.getOntology(ontologyId);
      if (ontology) {
        nodes = applyOntologyColors(nodes, ontology);
      }
    }

    if (nodeFilter) {
      const filterTypes = new Set(nodeFilter.split(',').map((t) => t.trim().toLowerCase()));
      const filteredNodes = nodes.filter((n) => filterTypes.has(n.type.toLowerCase()));
      const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
      nodes = filteredNodes;
      edges = edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));
    }

    nodes = calculateNodeSizes(nodes, edges);

    const totalNodes = nodes.length;
    const totalEdges = edges.length;
    const truncated = nodes.length > maxNodes;

    if (truncated) {
      nodes.sort((a, b) => b.size - a.size);
      nodes = nodes.slice(0, maxNodes);
      const keptIds = new Set(nodes.map((n) => n.id));
      edges = edges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target));
    }

    nodes = generateInitialPositions(nodes);

    if (!includeMetadata) {
      for (const n of nodes) n.properties = {};
      for (const e of edges) delete e.properties;
    }

    const { nodeTypes, edgeTypes } = buildMetadata(nodes, edges);

    return {
      nodes,
      edges,
      metadata: { totalNodes, totalEdges, nodeTypes, edgeTypes, truncated },
    };
  }

  /** Calculate graph statistics: density, degree distribution, components, etc. */
  async getGraphStats(datasetName: string, userId?: string): Promise<GraphStats> {
    const rawData = await cogneeClient.getDatasetGraph(datasetName, userId);
    const { nodes, edges } = transformCogneeGraph(rawData);

    const nodeCount = nodes.length;
    const edgeCount = edges.length;

    const degreeMap = new Map<string, number>();
    for (const n of nodes) degreeMap.set(n.id, 0);
    for (const e of edges) {
      degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
      degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
    }

    const averageDegree =
      nodeCount > 0 ? Array.from(degreeMap.values()).reduce((sum, d) => sum + d, 0) / nodeCount : 0;

    const nodeTypeDistribution: Record<string, number> = {};
    for (const n of nodes) {
      nodeTypeDistribution[n.type] = (nodeTypeDistribution[n.type] ?? 0) + 1;
    }

    const edgeTypeDistribution: Record<string, number> = {};
    for (const e of edges) {
      edgeTypeDistribution[e.type] = (edgeTypeDistribution[e.type] ?? 0) + 1;
    }

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
      density: calculateDensity(nodeCount, edgeCount),
      averageDegree,
      connectedComponents: findConnectedComponents(nodes, edges),
      nodeTypeDistribution,
      edgeTypeDistribution,
      topConnectedNodes,
    };
  }

  /** Return a filtered (pruned) view of the graph without modifying Cognee data. */
  async pruneNodes(
    datasetName: string,
    criteria: PruneCriteria,
    userId?: string,
  ): Promise<GraphVisualizationData> {
    return pruneGraphNodes(datasetName, criteria, userId);
  }

  /** BFS from a root node to a given depth, returning the connected subgraph. */
  async getSubgraph(
    datasetName: string,
    rootNodeId: string,
    depth: number = 2,
    userId?: string,
  ): Promise<GraphVisualizationData> {
    return getGraphSubgraph(datasetName, rootNodeId, depth, userId);
  }

  /** Get immediate neighbors (1-hop) of a node with their connecting edges. */
  async getNodeNeighbors(
    datasetName: string,
    nodeId: string,
    userId?: string,
  ): Promise<{ node: GraphNode | null; neighbors: GraphNode[]; edges: GraphEdge[] }> {
    return getGraphNodeNeighbors(datasetName, nodeId, userId);
  }

  /** Full-text search across node labels and properties. */
  async searchNodes(
    datasetName: string,
    query: string,
    limit: number = 20,
    userId?: string,
  ): Promise<GraphNode[]> {
    return searchGraphNodes(datasetName, query, limit, userId);
  }
}

export const cogneeGraphService = new CogneeGraphService();
