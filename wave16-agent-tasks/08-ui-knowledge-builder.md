# Agent W16-08: UI Knowledge Graph Builder

## Role
Build 7 React components for the knowledge management feature in `client/src/features/knowledge/`, including a 3D force-directed knowledge graph explorer using three.js.

## Priority: WAVE 16 (After W16-07 completes API routes)

## Wait Condition
Check for `.agent-done-W16-07` marker file before starting.

## Context
- UI library: shadcn/ui at `client/src/components/ui/`
- Icons: lucide-react (Network, Database, GitBranch, MessageSquare, Layers, Eye, Search, Filter, ThumbsUp, ThumbsDown, Zap)
- Design: Gold (#FFCC00) accent, neumorphic dark theme (`neu-raised`, `neu-inset` classes)
- 3D library: three.js + @react-three/fiber + @react-three/drei (must be installed)
- Existing pattern: `client/src/features/analytics/components/AnalyticsDashboard.tsx`

## Files to CREATE

### 1. `client/src/features/knowledge/components/KnowledgeDashboard.tsx`
**Purpose**: Main knowledge management page with tabbed navigation

- [ ] Tabbed layout: "Knowledge Graph" | "DataPoints" | "Ontologies" | "Feedback" | "Graph Stats"
- [ ] Dataset selector dropdown (populated from API)
- [ ] Quick stats row: Total Nodes, Total Edges, DataPoints Active, Feedback Score
- [ ] Render sub-components in each tab

### 2. `client/src/features/knowledge/components/KnowledgeGraphExplorer.tsx`
**Purpose**: Interactive 3D force-directed graph visualization using three.js

- [ ] Install dependencies: `npm install three @react-three/fiber @react-three/drei`
- [ ] 3D Canvas using `@react-three/fiber`:
  - `<Canvas>` with OrbitControls for rotation/zoom/pan
  - Force-directed layout simulation (use custom force simulation or d3-force-3d)
  - Nodes rendered as `<Sphere>` meshes with color from ontology, size from degree
  - Edges rendered as `<Line>` geometries between connected nodes
  - Node labels rendered as `<Html>` overlays (drei) on hover
- [ ] Interaction:
  - Click node: select and highlight, show detail panel
  - Hover node: show tooltip with label and type
  - Double-click node: expand neighbors (fetch subgraph)
  - Right-click node: context menu (explore, filter type, hide)
  - Search bar: search nodes by label, zoom to result
- [ ] Controls panel:
  - Node type filter checkboxes (show/hide by type)
  - Edge type filter checkboxes
  - Min degree slider (prune low-connectivity nodes)
  - Layout algorithm toggle (force-directed / radial / hierarchical)
  - Reset view button
- [ ] Performance: limit to 500 nodes, use instanced meshes for large graphs, LOD for distant nodes
- [ ] Selected node detail sidebar: properties, neighbors list, connected edges
- [ ] Props: `{ datasetName: string; ontologyId?: string }`

### 3. `client/src/features/knowledge/components/DataPointManager.tsx`
**Purpose**: CRUD interface for DataPoint configurations

- [ ] DataPoint list table:
  - Columns: Name, Type, Dataset, Active, Extractions, Accuracy, Actions
  - Predefined DataPoints marked with shield icon (non-deletable)
  - Active toggle switch per DataPoint
  - Accuracy displayed as colored bar (green >0.8, yellow >0.5, red <0.5)
- [ ] "Create DataPoint" button opens modal form:
  - Name, Description, Type (dropdown), Dataset Name
  - Schema builder: dynamic field list with add/remove
    - Field name input, type dropdown (string/number/date/boolean/array), required checkbox
  - Custom extraction prompt textarea (optional)
- [ ] Inline actions: Activate Extraction, Deactivate, View Stats, Delete (custom only)
- [ ] Props: `{ userId: string }`

### 4. `client/src/features/knowledge/components/OntologyManager.tsx`
**Purpose**: CRUD interface for graph ontology definitions

- [ ] Ontology list with cards:
  - Each card: name, type badge, node count, edge count, applied datasets list, version
  - Predefined ontologies marked (non-editable)
- [ ] "Create Ontology" button opens multi-step form:
  - Step 1: Name, Description, Type (dropdown)
  - Step 2: Node Types builder -- name, properties list, color picker
  - Step 3: Edge Types builder -- name, source type (dropdown from step 2), target type (dropdown)
  - Step 4: Preview graph schema as mini-visualization
- [ ] "Apply to Dataset" button with dataset name dropdown
- [ ] "Validate Graph" button to check current graph against ontology constraints
- [ ] Props: `{ userId: string }`

### 5. `client/src/features/knowledge/components/FeedbackPanel.tsx`
**Purpose**: View and manage Cognee feedback with learning loop controls

- [ ] Feedback stats summary:
  - Total feedback count, accuracy rate gauge, trend indicator
  - Pie chart: feedback by type (correct/incorrect/partial/irrelevant/missing)
  - Bar chart: feedback by entity type over time
- [ ] Feedback history list:
  - Each entry: entity type, feedback type badge, original value (truncated), corrected value, date
  - Filter by: feedback type, entity type, date range
- [ ] "Trigger Memify" button:
  - Shows count of unapplied feedback
  - Optional dataset filter
  - Min feedback threshold input (default 10)
  - Force run checkbox
  - Result display: processed count, datasets affected, new accuracy scores
- [ ] Per-DataPoint accuracy breakdown table
- [ ] Props: `{ userId: string }`

### 6. `client/src/features/knowledge/components/GraphStatsPanel.tsx`
**Purpose**: Display graph statistics and health metrics

- [ ] Dataset selector (if not inherited from parent)
- [ ] Stats cards grid:
  - Node Count (large number + type breakdown list)
  - Edge Count (large number + type breakdown list)
  - Graph Density (gauge 0-1)
  - Average Degree (number)
  - Connected Components (number)
- [ ] Top Connected Nodes table: rank, label, type, degree count
- [ ] Node type distribution bar chart
- [ ] Edge type distribution bar chart
- [ ] Refresh button
- [ ] Props: `{ datasetName: string }`

### 7. `client/src/features/knowledge/components/NodeDetailPanel.tsx`
**Purpose**: Sidebar panel showing details for a selected graph node

- [ ] Node header: label, type badge, color swatch
- [ ] Properties table: key-value pairs from node properties
- [ ] Neighbors list: grouped by edge type, clickable to navigate to neighbor
- [ ] Connected edges list with edge type and target node
- [ ] Feedback controls: thumbs up/down buttons for this node's data quality
- [ ] "Explore from here" button to re-center graph on this node
- [ ] "Hide this node" button
- [ ] Props: `{ node: GraphNode; onNavigate: (nodeId: string) => void; onFeedback: (nodeId: string, type: string) => void }`

## Files to MODIFY

### 8. `client/src/api.ts`
- [ ] Add `knowledgeApi` object:
  ```typescript
  export const knowledgeApi = {
    // DataPoints
    createDataPoint: (data: CreateDataPointRequest) => post('/api/knowledge/datapoints', data),
    listDataPoints: (userId: string, filters?: DataPointFilters) => get(`/api/knowledge/datapoints/${userId}`, filters),
    getDataPoint: (datapointId: string) => get(`/api/knowledge/datapoints/detail/${datapointId}`),
    activateDataPoint: (datapointId: string) => post(`/api/knowledge/datapoints/${datapointId}/activate`),
    deactivateDataPoint: (datapointId: string) => post(`/api/knowledge/datapoints/${datapointId}/deactivate`),
    // Ontologies
    createOntology: (data: CreateOntologyRequest) => post('/api/knowledge/ontologies', data),
    listOntologies: (userId: string, filters?: OntologyFilters) => get(`/api/knowledge/ontologies/${userId}`, filters),
    applyOntology: (ontologyId: string, datasetName: string) => post(`/api/knowledge/ontologies/${ontologyId}/apply`, { datasetName }),
    validateOntology: (ontologyId: string, graphData: unknown) => post(`/api/knowledge/ontologies/${ontologyId}/validate`, { graphData }),
    // Feedback
    submitFeedback: (data: FeedbackSubmission) => post('/api/knowledge/feedback', data),
    feedbackStats: (userId: string, filters?: FeedbackFilters) => get(`/api/knowledge/feedback/${userId}/stats`, filters),
    triggerMemify: (userId: string, options?: MemifyOptions) => post(`/api/knowledge/feedback/${userId}/memify`, options),
    // Graph
    getGraph: (datasetName: string, options?: GraphOptions) => get(`/api/knowledge/graph/${datasetName}`, options),
    graphStats: (datasetName: string) => get(`/api/knowledge/graph/${datasetName}/stats`),
    pruneGraph: (datasetName: string, criteria: PruneCriteria) => post(`/api/knowledge/graph/${datasetName}/prune`, criteria),
    getSubgraph: (datasetName: string, nodeId: string, depth?: number) => get(`/api/knowledge/graph/${datasetName}/subgraph/${nodeId}`, { depth }),
  };
  ```

### 9. `client/src/App.tsx`
- [ ] Add "Knowledge" navigation tab and route to KnowledgeDashboard
- [ ] Import KnowledgeDashboard from `./features/knowledge/components/KnowledgeDashboard`

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] `npm install three @react-three/fiber @react-three/drei` succeeds
- [ ] All 7 components render without errors
- [ ] KnowledgeGraphExplorer renders 3D graph with nodes and edges
- [ ] Nodes are colored by ontology type
- [ ] Click node shows NodeDetailPanel
- [ ] DataPointManager lists predefined + custom DataPoints
- [ ] OntologyManager displays predefined ontologies
- [ ] FeedbackPanel shows stats and enables memify trigger
- [ ] Navigation to /knowledge works from main nav
- [ ] Create marker file: `.agent-done-W16-08`

## Dependencies
- **Requires**: W16-07 (`.agent-done-W16-07`) -- API routes must exist
- **IMPORTANT**: Only W16-08 modifies client/src/App.tsx and client/src/api.ts in Wave 16
- **npm install**: Must install three.js ecosystem packages before building components
