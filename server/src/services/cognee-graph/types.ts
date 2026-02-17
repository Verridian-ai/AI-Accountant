/**
 * Cognee Graph Visualization — Type Definitions
 *
 * Shared types and constants for the graph visualization service.
 */

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

export const DEFAULT_NODE_COLORS: Record<string, string> = {
  default: '#888888',
  Account: '#FFCC00',
  Transaction: '#4CAF50',
  Merchant: '#2196F3',
  Category: '#9C27B0',
  TaxEntity: '#F44336',
  Person: '#00BCD4',
  Business: '#3F51B5',
};
