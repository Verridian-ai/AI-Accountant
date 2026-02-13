# Agent 9: 3D Graph Visualization Builder

## Role
Build an interactive 3D knowledge graph viewer using three.js and 3d-force-graph that renders Cognee's knowledge graph with clickable nodes, filterable edges, color-coded entity types, and smooth navigation for the admin dashboard.

## Priority: WAVE 20 (After Agent 5)

## Wait Condition
Check for `.agent-done-W20-05` marker file before starting.

## Files to CREATE

### 1. `client/src/features/admin/components/CogneeGraphViewer.tsx`
**Purpose**: Interactive 3D force-directed graph visualization of Cognee knowledge graph
**Pattern**: React component wrapping three.js + 3d-force-graph library

- [ ] **Dependencies to Install**:
  ```bash
  npm install 3d-force-graph three @types/three
  ```
  - `3d-force-graph`: WebGL force-directed graph renderer
  - `three`: three.js 3D engine (peer dependency)
  - Falls back to 2D canvas if WebGL unavailable

- [ ] **Component Structure**:
  ```typescript
  interface CogneeGraphViewerProps {
    datasetName?: string;             // filter to single dataset, or all if undefined
    initialFocus?: string;            // node ID to center on initial load
    height?: number;                  // default: window.innerHeight - 200
    width?: number;                   // default: container width
  }

  interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
  }

  interface GraphNode {
    id: string;
    name: string;
    type: string;                     // entity type: merchant, transaction, category, product, indicator, etc.
    dataset: string;                  // which Cognee dataset this belongs to
    properties: Record<string, any>;  // additional node properties
    connections: number;              // degree (number of edges)
    val: number;                      // node size (based on connections)
    color: string;                    // computed from type
    x?: number;
    y?: number;
    z?: number;
  }

  interface GraphLink {
    source: string;
    target: string;
    type: string;                     // relationship type
    properties: Record<string, any>;
    color: string;
  }
  ```

- [ ] **Color Scheme by Entity Type**:
  ```typescript
  const NODE_COLORS: Record<string, string> = {
    merchant: '#FFCC00',              // gold
    transaction: '#4CAF50',           // green
    category: '#2196F3',              // blue
    account: '#FF9800',               // orange
    product: '#E91E63',               // pink
    rate: '#9C27B0',                  // purple
    indicator: '#00BCD4',             // cyan
    person: '#FF5722',               // deep orange
    organization: '#795548',          // brown
    concept: '#607D8B',              // blue grey
    default: '#9E9E9E'               // grey
  };

  const EDGE_COLORS: Record<string, string> = {
    categorized_as: '#4CAF50',
    paid_to: '#FFCC00',
    belongs_to: '#2196F3',
    has_rate: '#9C27B0',
    related_to: '#607D8B',
    default: '#424242'
  };
  ```

- [ ] **3D Graph Initialization**:
  ```typescript
  useEffect(() => {
    const graph = ForceGraph3D()(containerRef.current)
      .graphData(graphData)
      .nodeLabel((node: GraphNode) => `${node.name} (${node.type})`)
      .nodeColor((node: GraphNode) => node.color)
      .nodeVal((node: GraphNode) => node.val)
      .nodeOpacity(0.9)
      .nodeResolution(16)
      .linkColor((link: GraphLink) => link.color)
      .linkOpacity(0.4)
      .linkWidth(1)
      .linkDirectionalArrowLength(3)
      .linkDirectionalArrowRelPos(1)
      .linkLabel((link: GraphLink) => link.type)
      .backgroundColor('#1a1a2e')     // match dark theme
      .width(width)
      .height(height)
      .onNodeClick(handleNodeClick)
      .onNodeHover(handleNodeHover)
      .onLinkClick(handleLinkClick)
      .cooldownTicks(100)
      .d3Force('charge', d3.forceManyBody().strength(-50))
      .d3Force('link', d3.forceLink().distance(50));

    graphRef.current = graph;

    return () => {
      graph._destructor?.();
    };
  }, [graphData]);
  ```

- [ ] **Node Click Handler**:
  ```typescript
  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
    // Zoom to node with smooth animation
    const distance = 100;
    const distRatio = 1 + distance / Math.hypot(node.x!, node.y!, node.z!);
    graphRef.current?.cameraPosition(
      { x: node.x! * distRatio, y: node.y! * distRatio, z: node.z! * distRatio },
      node,
      1000  // 1 second animation
    );
  };
  ```

- [ ] **Node Detail Panel** (right sidebar, slides in on node click):
  - Entity name (large text)
  - Entity type badge
  - Dataset badge
  - Properties list (key-value pairs)
  - Connection count
  - Connected entities list (click to navigate)
  - "Find in Cognee" button (search for this entity)

- [ ] **Filter Controls** (top bar):
  - **Entity Type Filter**: multi-select dropdown of entity types (show/hide by type)
  - **Dataset Filter**: dropdown to filter by dataset or show all
  - **Edge Type Filter**: multi-select dropdown of relationship types
  - **Connection Threshold**: slider (min connections to show, e.g., 1-50)
  - **Search**: text input to highlight nodes matching name
  - **Reset View**: button to reset camera and filters

- [ ] **Filter Implementation**:
  ```typescript
  const filteredGraphData = useMemo(() => {
    let nodes = allNodes;
    let links = allLinks;

    // Filter by entity type
    if (selectedTypes.length > 0) {
      nodes = nodes.filter(n => selectedTypes.includes(n.type));
      const nodeIds = new Set(nodes.map(n => n.id));
      links = links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));
    }

    // Filter by dataset
    if (selectedDataset) {
      nodes = nodes.filter(n => n.dataset === selectedDataset);
      const nodeIds = new Set(nodes.map(n => n.id));
      links = links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));
    }

    // Filter by edge type
    if (selectedEdgeTypes.length > 0) {
      links = links.filter(l => selectedEdgeTypes.includes(l.type));
    }

    // Filter by connection threshold
    if (minConnections > 1) {
      nodes = nodes.filter(n => n.connections >= minConnections);
      const nodeIds = new Set(nodes.map(n => n.id));
      links = links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));
    }

    return { nodes, links };
  }, [allNodes, allLinks, selectedTypes, selectedDataset, selectedEdgeTypes, minConnections]);
  ```

- [ ] **Search Highlight**:
  ```typescript
  const handleSearch = (query: string) => {
    if (!query) {
      // Reset all node colors
      graphRef.current?.nodeColor((node: GraphNode) => node.color);
      return;
    }
    const lowerQuery = query.toLowerCase();
    graphRef.current?.nodeColor((node: GraphNode) =>
      node.name.toLowerCase().includes(lowerQuery) ? '#FFFFFF' : node.color + '40'  // dim non-matching
    );
    // Zoom to first match
    const match = graphData.nodes.find(n => n.name.toLowerCase().includes(lowerQuery));
    if (match) handleNodeClick(match);
  };
  ```

- [ ] **Performance Optimizations**:
  - Limit initial load to 1000 nodes + 2000 edges (paginate if larger)
  - Use `nodeThreeObject` for custom sprites only on hover/select (not all nodes)
  - Disable link particles by default (enable as toggle)
  - Use `warmupTicks` to pre-compute layout before rendering
  - LOD (Level of Detail): show labels only when zoomed in
  - Frame rate monitor: warn if < 30fps

- [ ] **Graph Statistics Overlay** (bottom-left corner):
  - Nodes: {count}
  - Edges: {count}
  - Datasets: {count}
  - Entity Types: {count}
  - FPS: {current}

- [ ] **Camera Controls**:
  - Left drag: rotate
  - Right drag: pan
  - Scroll: zoom
  - Double-click node: zoom to node
  - `R` key: reset camera
  - `F` key: toggle fullscreen

- [ ] **Data Fetching**:
  ```typescript
  useEffect(() => {
    const fetchGraphData = async () => {
      setLoading(true);
      try {
        // Fetch graph data from Cognee admin API
        const stats = await fetchCogneeGraphStats();
        const detail = datasetName
          ? await fetchCogneeDatasetDetail(datasetName)
          : await fetchAllDatasetsGraph();

        // Transform to 3d-force-graph format
        const { nodes, links } = transformToGraphData(detail);
        setAllNodes(nodes);
        setAllLinks(links);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchGraphData();
  }, [datasetName]);
  ```

- [ ] **Loading State**: animated placeholder while graph loads
- [ ] **Error State**: fallback message if WebGL not available, with link to 2D view
- [ ] **Empty State**: message if no graph data with "Index data to Cognee" CTA

### 2. `client/src/features/admin/components/CogneeGraph2DFallback.tsx`
**Purpose**: 2D fallback for browsers without WebGL

- [ ] Use `react-force-graph-2d` (2D canvas version)
- [ ] Same data format and interactions as 3D version
- [ ] Auto-detect WebGL availability and fall back
- [ ] Simpler but functional: click nodes, filter, search

## Files to MODIFY

### 3. `client/src/features/admin/components/CogneeManager.tsx`
- [ ] Add "View Graph" button per dataset that navigates to `/admin/cognee/:name/graph`
- [ ] Add "View All Graphs" button for full knowledge graph view

### 4. `client/src/features/admin/components/CogneeDatasetDetail.tsx`
- [ ] Add embedded `CogneeGraphViewer` component at bottom of detail page
- [ ] Pass `datasetName` prop to filter to current dataset

### 5. `client/src/App.tsx`
- [ ] Add route: `<Route path="cognee/:name/graph" element={<CogneeGraphViewer />} />`
- [ ] Add route: `<Route path="cognee/graph" element={<CogneeGraphViewer />} />`

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] `npm install 3d-force-graph three @types/three` succeeds
- [ ] CogneeGraphViewer renders 3D graph with nodes and edges
- [ ] Nodes colored by entity type using defined color scheme
- [ ] Node click zooms to node with smooth animation and opens detail panel
- [ ] Entity type filter shows/hides nodes by type
- [ ] Dataset filter isolates single dataset's graph
- [ ] Search highlights matching nodes and dims others
- [ ] Connection threshold filter removes low-degree nodes
- [ ] Graph renders at 60fps with 500 nodes (test with Chrome DevTools)
- [ ] Falls back to 2D if WebGL unavailable
- [ ] Camera controls work: rotate, pan, zoom, reset
- [ ] Statistics overlay shows correct node/edge counts
- [ ] Create marker file: `.agent-done-W20-09`

## Dependencies
- **Requires**: Agent 5 (`.agent-done-W20-05`) for Cognee admin service (graph data API)
- **New NPM deps**: `3d-force-graph`, `three`, `@types/three`
- **Optional fallback dep**: `react-force-graph-2d`
