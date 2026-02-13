# Agent W16-05: Graph Visualization Data Builder

## Role
Expose Cognee graph data for 3D visualization. Add methods to retrieve, transform, and prune graph nodes/edges for rendering with three.js.

## Priority: WAVE 16 (After W16-03 completes ontology service)

## Wait Condition
Check for `.agent-done-W16-03` marker file before starting.

## Context
- Cognee graph API: GET /v1/datasets/{name}/graph -- returns graph nodes and edges
- Cognee client: `server/src/services/cognee_client.ts` -- existing HTTP wrapper
- Ontology service: `server/src/services/cognee-ontologies.ts` -- provides node/edge type colors and structure
- Target: Three.js force-directed graph in client (built by W16-08)

## Files to CREATE

### 1. `server/src/services/cognee-graph.ts`
**Purpose**: Transform Cognee graph data into visualization-ready format for 3D rendering
**Pattern**: Follow `server/src/services/cognee_client.ts`

- [ ] Create `CogneeGraphService` class with the following methods:

  - `getGraphData(datasetName: string, options?: GraphDataOptions): Promise<GraphVisualizationData>` -- Fetches raw graph from Cognee API: `GET /v1/datasets/{datasetName}/graph`. Transforms into visualization format with positions, colors, sizes. Applies ontology colors if available. Limits node count (default 500 max).
    ```typescript
    interface GraphDataOptions {
      maxNodes?: number; // default 500
      ontologyId?: string; // apply ontology colors
      nodeFilter?: string; // filter by node type
      depthLimit?: number; // max traversal depth from root
      includeMetadata?: boolean;
    }
    interface GraphVisualizationData {
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
    interface GraphNode {
      id: string;
      label: string;
      type: string;
      color: string; // hex color from ontology or default
      size: number; // based on connection count
      properties: Record<string, unknown>;
      position?: { x: number; y: number; z: number }; // initial position hint
    }
    interface GraphEdge {
      id: string;
      source: string; // node ID
      target: string; // node ID
      label: string;
      type: string;
      weight: number; // edge thickness
      properties?: Record<string, unknown>;
    }
    ```

  - `getGraphStats(datasetName: string): Promise<GraphStats>` -- Returns graph statistics without full data. Node count, edge count, type distributions, density, connected components count, average degree.
    ```typescript
    interface GraphStats {
      nodeCount: number;
      edgeCount: number;
      density: number; // edges / (nodes * (nodes-1))
      averageDegree: number;
      connectedComponents: number;
      nodeTypeDistribution: Record<string, number>;
      edgeTypeDistribution: Record<string, number>;
      topConnectedNodes: Array<{ id: string; label: string; degree: number }>;
    }
    ```

  - `pruneNodes(datasetName: string, criteria: PruneCriteria): Promise<GraphVisualizationData>` -- Returns filtered graph data. Does NOT modify Cognee data (read-only pruning for viz).
    ```typescript
    interface PruneCriteria {
      minDegree?: number; // exclude nodes with fewer connections
      nodeTypes?: string[]; // include only these types
      excludeNodeTypes?: string[]; // exclude these types
      edgeTypes?: string[]; // include only these edge types
      maxAge?: number; // exclude nodes older than N days
      searchQuery?: string; // filter nodes by label/property text match
    }
    ```

  - `getSubgraph(datasetName: string, rootNodeId: string, depth: number): Promise<GraphVisualizationData>` -- BFS traversal from root node to specified depth. Returns connected subgraph only. Useful for "explore from this node" interaction.

  - `getNodeNeighbors(datasetName: string, nodeId: string): Promise<{ node: GraphNode; neighbors: GraphNode[]; edges: GraphEdge[] }>` -- Returns immediate neighbors of a specific node with connecting edges.

  - `searchNodes(datasetName: string, query: string, limit?: number): Promise<GraphNode[]>` -- Text search across node labels and properties. Returns matching nodes (for search-to-navigate in graph UI).

- [ ] Implement private helper methods:
  - `_transformCogneeGraph(rawData: unknown): { nodes: GraphNode[]; edges: GraphEdge[] }` -- Converts Cognee API response format to internal GraphNode/GraphEdge arrays
  - `_applyOntologyColors(nodes: GraphNode[], ontology: GraphSchema): GraphNode[]` -- Maps node types to ontology colors
  - `_calculateNodeSizes(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[]` -- Size nodes by connection count (min 1, max 10 scale)
  - `_generateInitialPositions(nodes: GraphNode[]): GraphNode[]` -- Random sphere distribution for initial layout
  - `_calculateDensity(nodeCount: number, edgeCount: number): number` -- Graph density metric

## Files to MODIFY

### 2. `server/src/services/cognee_client.ts`
- [ ] Add `getDatasetGraph(datasetName: string): Promise<unknown>` method:
  ```typescript
  async getDatasetGraph(datasetName: string): Promise<unknown> {
    return this.get(`/v1/datasets/${datasetName}/graph`);
  }
  ```
  (If method already exists from prior waves, verify it returns full graph data including node properties)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `CogneeGraphService` can be instantiated without errors
- [ ] `getGraphData()` returns valid GraphVisualizationData with nodes and edges
- [ ] Node colors correctly mapped from ontology when ontologyId provided
- [ ] Node sizes scale with connection count
- [ ] `pruneNodes()` with `minDegree: 3` excludes low-connectivity nodes
- [ ] `getSubgraph()` returns only nodes within specified depth
- [ ] `getGraphStats()` returns correct density and degree calculations
- [ ] Graph data limited to maxNodes (default 500) when graph is large
- [ ] Create marker file: `.agent-done-W16-05`

## Dependencies
- **Requires**: W16-03 (`.agent-done-W16-03`) -- ontology service for color mapping
- **Reuses**: cognee_client.ts, cognee-ontologies.ts
